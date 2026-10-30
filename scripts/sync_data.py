#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
一键同步脚本：把本地 FastAPI 后端的真实数据，同步到 Netlify Functions 的数据目录，
并推送到 GitHub（Netlify 会自动重新部署），线上站点随即显示最新数据。

用法（在项目根目录执行）：
    python scripts/sync_data.py              # 采集 + 提交 + 推送
    python scripts/sync_data.py --no-push    # 只采集生成，不提交推送
    python scripts/sync_data.py --port 8125  # 指定本地后端端口（默认自动选空闲端口）

也可以直接双击 scripts/sync-data.cmd。
"""

import argparse
import json
import re
import socket
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime
from pathlib import Path

# 访问本机后端时绕过系统代理（本机若装有网络加速器，urllib 会读取 http_proxy 环境变量导致请求失败）
_OPENER = urllib.request.build_opener(urllib.request.ProxyHandler({}))

ROOT = Path(__file__).resolve().parent.parent
BACKEND_DIR = ROOT / "backend"
FUNCTIONS_DIR = ROOT / "netlify" / "functions"
DATA_DIR = FUNCTIONS_DIR / "data"
DATA_JS = FUNCTIONS_DIR / "data.js"
# 灾害评估结果是「快照 + 模型」的确定性输出，直接生成为静态文件走 CDN，
# 前端切换评估对象时无需经过函数冷启动（netlify.toml 里把 /api/damage/* 指向这里）。
STATIC_DATA_DIR = ROOT / "public" / "data"
ASSESS_DIR = STATIC_DATA_DIR / "assessment"

# 无参数端点：接口路径 -> 数据文件名（与 netlify/functions/data/index.json 保持一致）
BASE_ENDPOINTS = [
    ("/api/hainan-outline", "hainan-outline.json"),
    ("/api/stations", "stations.json"),
    ("/api/alerts", "alerts.json"),
    ("/api/overview", "overview.json"),
    ("/api/weekly-scenes", "weekly-scenes.json"),
    ("/api/water-grade", "water-grade.json"),
    ("/api/ecology/shoreline", "ecology-shoreline.json"),
    ("/api/ecology/mangrove", "ecology-mangrove.json"),
    # 台风列表拆成两份快照：history（数据库历史台风）+ live（本年度实时台风），
    # 线上实时源不可达时仍能展示「历史 / 现有台风」两组评估对象，见 sync_typhoons()。
    ("/api/typhoon/history", "typhoon-history.json"),
    ("/api/damage/summary", "damage-summary.json"),
    ("/api/damage/building", "damage-building.json"),
    ("/api/damage/ndvi", "damage-ndvi.json"),
    ("/api/damage/city", "damage-city.json"),
    ("/api/damage/inundation", "damage-inundation.json"),
    ("/api/satellite/catalog", "satellite-catalog.json"),
]

# 生态序列端点：需要按站点逐个采集
SERIES_KINDS = ["chla", "sst"]


def find_free_port():
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


def fetch_json(base_url, path, timeout=20):
    url = base_url + path
    with _OPENER.open(url, timeout=timeout) as resp:
        if resp.status != 200:
            raise RuntimeError(f"{path} 返回 HTTP {resp.status}")
        return json.loads(resp.read().decode("utf-8"))


def wait_for_backend(base_url, proc, timeout=60):
    deadline = time.time() + timeout
    while time.time() < deadline:
        if proc.poll() is not None:
            return False
        try:
            fetch_json(base_url, "/api/health", timeout=3)
            return True
        except Exception:
            time.sleep(0.6)
    return False


def write_json(path, data):
    """统一用 2 空格缩进 + UTF-8，保证每次生成的格式稳定、便于 diff。"""
    text = json.dumps(data, ensure_ascii=False, indent=2) + "\n"
    if path.exists() and path.read_text(encoding="utf-8") == text:
        return False
    path.write_text(text, encoding="utf-8")
    return True


def camel(varname):
    parts = [p for p in re.split(r"[^0-9A-Za-z]+", varname) if p]
    if not parts:
        return "f"
    head = parts[0].lower()
    if head[0].isdigit():
        head = "f" + head
    return head + "".join(p[:1].upper() + p[1:] for p in parts[1:])


def regenerate_data_js():
    """根据 data 目录里实际存在的 json 文件，重建 data.js 的静态导入。

    这样后端新增站点或台风后，无需手动修改 data.js。
    """
    files = sorted(p.name for p in DATA_DIR.glob("*.json") if p.name != "index.json")

    used = {}
    imports = []
    entries = []
    for name in files:
        var = camel(name[:-5])
        while var in used:
            var = var + "X"
        used[var] = name
        imports.append(f"import {var} from './data/{name}' with {{ type: 'json' }}")
        entries.append(f"  '{name}': {var},")

    lines = [
        "// 本文件由 scripts/sync_data.py 自动生成，请勿手动编辑。",
        "// 数据来源：本地 FastAPI 后端（backend/database.py）的真实响应快照。",
        "// 使用 JSON import attributes（with { type: 'json' }）：Netlify 构建函数时",
        "// 由 esbuild 打包，JSON 会被内联进函数产物，无需运行时读取文件。",
        "import routeIndex from './data/index.json' with { type: 'json' }",
        "",
        *imports,
        "",
        "export { routeIndex }",
        "",
        "export const files = {",
        *entries,
        "}",
        "",
    ]
    text = "\n".join(lines)
    if DATA_JS.exists() and DATA_JS.read_text(encoding="utf-8") == text:
        return False
    DATA_JS.write_text(text, encoding="utf-8")
    return True


def run_git(args, check=False):
    result = subprocess.run(
        ["git"] + args, cwd=str(ROOT), capture_output=True, text=True, encoding="utf-8", errors="replace"
    )
    if check and result.returncode != 0:
        raise RuntimeError(f"git {' '.join(args)} 失败：{result.stderr.strip()}")
    return result


def git_add_with_retry(paths):
    """git add 在本机偶发 'unable to create temporary file: Permission denied'，
    用 hash-object -w 预写对象后重试可绕过。"""
    for attempt in range(1, 4):
        result = run_git(["add", "--"] + paths)
        if result.returncode == 0:
            return True
        print(f"  git add 第 {attempt} 次失败，改用 hash-object 预写对象后重试…")
        for p in paths:
            target = ROOT / p
            if target.is_file():
                run_git(["hash-object", "-w", p])
            elif target.is_dir():
                for f in sorted(target.rglob("*")):
                    if f.is_file():
                        run_git(["hash-object", "-w", str(f.relative_to(ROOT))])
        time.sleep(0.5)
    result = run_git(["add", "--"] + paths)
    return result.returncode == 0


def sync_typhoons(base_url, written):
    """采集历史台风 + 本年度实时台风（含轨迹），返回 (history, live, tracks)。

    线上 Netlify Functions 运行在境外机房，浙江水利厅台风接口常因网络原因超时，
    因此这里把本年度实时台风与轨迹一起写进快照：线上优先用实时接口，
    取不到时自动回退到本快照，「现有台风」分组仍然可用。
    """
    history = fetch_json(base_url, "/api/typhoon/history")
    if write_json(DATA_DIR / "typhoon-history.json", history):
        written.append("typhoon-history.json")

    # /api/damage/targets 已合并「实时台风 + 历史台风」，这里只取实时部分
    targets = fetch_json(base_url, "/api/damage/targets")
    live = [t for t in targets if t.get("source") == "实时台风"]
    year = (live[0].get("date") or "")[:4] or datetime.now().strftime("%Y")
    payload = {
        "generatedAt": datetime.now().astimezone().isoformat(),
        "year": year,
        "items": live,
    }
    if write_json(DATA_DIR / "typhoon-live.json", payload):
        written.append("typhoon-live.json")

    tracks = {}
    rows = list(history) + live
    print(f"采集 {len(rows)} 条台风轨迹（历史 {len(history)} + 实时 {len(live)}）…")
    for ty in rows:
        tid = ty.get("id")
        if not tid or str(tid) in tracks:
            continue
        try:
            data = fetch_json(base_url, f"/api/typhoon/track/{urllib.parse.quote(str(tid))}")
        except Exception as e:
            print(f"  跳过轨迹 {tid}：{e}")
            continue
        filename = f"track-{tid}.json"
        if write_json(DATA_DIR / filename, data):
            written.append(filename)
        tracks[str(tid)] = filename
    return history, live, tracks


def sync_assessments(base_url, written):
    """把每个评估对象的灾害评估结果预先算成静态 JSON，线上由 CDN 直接返回。

    /api/damage/assessment/{id} 的计算只依赖台风快照与轨迹，同步时算一次即可；
    静态文件响应在几十毫秒内，切换评估对象不再受函数冷启动影响。
    """
    ASSESS_DIR.mkdir(parents=True, exist_ok=True)
    targets = fetch_json(base_url, "/api/damage/targets")
    ids = [str(t["id"]) for t in targets if t.get("id")]
    print(f"生成 {len(ids)} 个台风的静态灾害评估结果…")
    for tid in ids:
        try:
            data = fetch_json(base_url, f"/api/damage/assessment/{urllib.parse.quote(tid)}")
        except Exception as e:
            print(f"  跳过评估 {tid}：{e}")
            continue
        if write_json(ASSESS_DIR / f"{tid}.json", data):
            written.append(f"public/data/assessment/{tid}.json")
    # 清理已不在列表中的旧台风，避免线上还能打开过期评估
    for stale in {p.stem for p in ASSESS_DIR.glob("*.json")} - set(ids):
        (ASSESS_DIR / f"{stale}.json").unlink(missing_ok=True)
        print(f"  移除过期评估 {stale}.json")
    if write_json(STATIC_DATA_DIR / "damage-targets.json", targets):
        written.append("public/data/damage-targets.json")


def main():
    parser = argparse.ArgumentParser(description="同步后端真实数据到 Netlify 并推送上线")
    parser.add_argument("--no-push", action="store_true", help="只生成数据文件，不提交推送")
    parser.add_argument("--port", type=int, default=0, help="本地后端端口，默认自动选择空闲端口")
    args = parser.parse_args()

    if not BACKEND_DIR.is_dir():
        sys.exit(f"找不到后端目录：{BACKEND_DIR}")
    DATA_DIR.mkdir(parents=True, exist_ok=True)

    port = args.port or find_free_port()
    base_url = f"http://127.0.0.1:{port}"
    print(f"启动本地后端：{base_url}")

    log_path = Path(tempfile.gettempdir()) / "hainan_sync_uvicorn.log"
    log_file = open(log_path, "w", encoding="utf-8", errors="replace")

    proc = subprocess.Popen(
        [sys.executable, "-m", "uvicorn", "main:app", "--host", "127.0.0.1", "--port", str(port)],
        cwd=str(BACKEND_DIR),
        stdout=log_file,
        stderr=subprocess.STDOUT,
    )

    written = []
    try:
        if not wait_for_backend(base_url, proc):
            log_file.close()
            detail = ""
            if log_path.exists():
                detail = "\n".join(log_path.read_text(encoding="utf-8", errors="replace").splitlines()[-15:])
            sys.exit("本地后端启动失败。后端日志最后几行：\n" + (detail or "（无输出）"))

        # 1. 无参数端点
        print("采集基础端点…")
        for path, filename in BASE_ENDPOINTS:
            data = fetch_json(base_url, path)
            if write_json(DATA_DIR / filename, data):
                written.append(filename)

        # 2. 站点序列（chla / sst）
        stations = fetch_json(base_url, "/api/stations")
        station_series = {kind: {} for kind in SERIES_KINDS}
        print(f"采集 {len(stations)} 个站点的生态序列…")
        for st in stations:
            sid, name = st.get("id"), st.get("name")
            if not sid or not name:
                continue
            for kind in SERIES_KINDS:
                query = urllib.parse.urlencode({"station": name})
                data = fetch_json(base_url, f"/api/ecology/{kind}?{query}")
                filename = f"{kind}-{sid}.json"
                if write_json(DATA_DIR / filename, data):
                    written.append(filename)
                station_series[kind][name] = filename

        # 3. 台风：历史台风 + 本年度实时台风（含各自轨迹）
        history, live, tracks = sync_typhoons(base_url, written)

        # 3.1 灾害评估对象与结果（静态文件，走 CDN 直出）
        sync_assessments(base_url, written)

        # 4. 索引
        index = {
            "generatedAt": datetime.now().astimezone().isoformat(),
            "source": "backend/database.py（本地 FastAPI 后端真实响应）",
            "routes": {path: filename for path, filename in BASE_ENDPOINTS},
            "stationSeries": station_series,
            "typhoonTracks": tracks,
        }
        # 兼容旧代码：/api/typhoon/list 的兜底快照仍然指历史台风
        index["routes"]["/api/typhoon/list"] = "typhoon-history.json"
        if write_json(DATA_DIR / "index.json", index):
            written.append("index.json")

        # 5. 重建 data.js（新增站点/台风时自动补上 import）
        data_js_changed = regenerate_data_js()
        if data_js_changed:
            written.append("data.js")
    finally:
        proc.terminate()
        try:
            proc.wait(timeout=10)
        except subprocess.TimeoutExpired:
            proc.kill()
        if not log_file.closed:
            log_file.close()

    if written:
        print(f"已更新 {len(written)} 个数据文件：{', '.join(written)}")
    else:
        print("数据内容与线上快照一致，无变化。")

    if args.no_push:
        print("已跳过提交推送（--no-push）。")
        return

    if not written:
        print("无变化，无需推送。")
        return

    print("提交并推送…")
    paths = ["netlify/functions/data", "netlify/functions/data.js", "public/data"]
    if not git_add_with_retry(paths):
        sys.exit("git add 失败，请手动执行 git add netlify/functions/data netlify/functions/data.js")

    stamp = datetime.now().strftime("%Y-%m-%d %H:%M")
    commit = run_git(
        [
            "-c",
            "user.name=hainan-rs-system",
            "-c",
            "user.email=deploy@local",
            "commit",
            "-m",
            f"chore: 同步后端真实数据快照（{stamp}）",
        ]
    )
    if commit.returncode != 0 and "nothing to commit" not in (commit.stdout + commit.stderr):
        sys.exit(f"git commit 失败：{commit.stderr.strip()}")

    sha = run_git(["rev-parse", "--short", "HEAD"]).stdout.strip()
    push = run_git(["push", "origin", "HEAD:main"])
    if push.returncode != 0:
        sys.exit(f"git push 失败：{push.stderr.strip()}")

    print(f"✅ 已推送提交 {sha}")
    print("Netlify 会自动重新部署，约 1-2 分钟后线上生效：")
    print("   https://dazzling-frangipane-0a0b3c.netlify.app")


if __name__ == "__main__":
    main()
