# -*- coding: utf-8 -*-
"""
手动触发 Netlify Deploy Hook，让线上站点按最新提交重新构建。

用法（在项目根目录执行）：
    python scripts/trigger_deploy.py                  # 读取环境变量 NETLIFY_BUILD_HOOK
    python scripts/trigger_deploy.py --hook <url>      # 直接指定 hook 地址
    python scripts/trigger_deploy.py --file .netlify-hook-url

hook 地址的获取与保存方式见 DEPLOY.md；它相当于「发布按钮」的私密链接，
不要提交到仓库（本地文件 .netlify-hook-url 已在 .gitignore 中忽略）。
"""

import argparse
import json
import os
import sys
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DEFAULT_FILE = ROOT / ".netlify-hook-url"
SITE_URL = "https://dazzling-frangipane-0a0b3c.netlify.app"

# 线上 hook 是公网地址，本机若开着网络加速器，走系统代理反而会失败
_OPENER = urllib.request.build_opener(urllib.request.ProxyHandler({}))


def resolve_hook(explicit: str = "", hook_file: str = "") -> str:
    """按优先级取 hook 地址：命令行参数 > 环境变量 > 本地文件"""
    if explicit:
        return explicit.strip()
    env = (os.environ.get("NETLIFY_BUILD_HOOK") or "").strip()
    if env:
        return env
    path = Path(hook_file) if hook_file else DEFAULT_FILE
    if path.exists():
        text = path.read_text(encoding="utf-8").strip()
        if text:
            return text
    return ""


def trigger(hook_url: str, timeout: int = 30):
    """POST 一个空 JSON 触发构建，返回 (HTTP 状态码, 响应文本)"""
    req = urllib.request.Request(
        hook_url,
        data=b"{}",
        method="POST",
        headers={"Content-Type": "application/json", "User-Agent": "hainan-rs-system-deploy"},
    )
    with _OPENER.open(req, timeout=timeout) as resp:
        return resp.status, resp.read().decode("utf-8", "replace")


def _describe(body: str) -> str:
    """从 Netlify 的响应里挑出 build_id / deploy_id，便于在面板里对照"""
    try:
        data = json.loads(body)
    except ValueError:
        return body.strip()[:200]
    parts = [f"{k}={data[k]}" for k in ("build_id", "deploy_id") if k in data]
    return "，".join(parts) or body.strip()[:200]


def main():
    parser = argparse.ArgumentParser(description="触发 Netlify Deploy Hook")
    parser.add_argument("--hook", default="", help="hook 地址（默认读 NETLIFY_BUILD_HOOK 或 .netlify-hook-url）")
    parser.add_argument("--file", default="", help="从指定文件读取 hook 地址")
    args = parser.parse_args()

    hook = resolve_hook(args.hook, args.file)
    if not hook:
        print("未找到 Deploy Hook 地址。请任选一种方式配置：")
        print("  1) 环境变量：set NETLIFY_BUILD_HOOK=<hook 地址>")
        print("  2) 本地文件：把 hook 地址写入项目根目录的 .netlify-hook-url")
        print("  3) 直接传参：python scripts/trigger_deploy.py --hook <hook 地址>")
        print("获取 hook 地址的步骤见 DEPLOY.md。")
        return 1

    print("触发 Netlify 构建 …")
    try:
        status, body = trigger(hook)
    except urllib.error.HTTPError as e:
        print(f"❌ 触发失败：HTTP {e.code}（hook 地址可能已失效或被删除）")
        return 1
    except (urllib.error.URLError, TimeoutError) as e:
        print(f"❌ 触发失败：{e}")
        return 1

    print(f"✅ 已触发构建（HTTP {status}）：{_describe(body)}")
    print(f"约 1-2 分钟后线上生效：{SITE_URL}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
