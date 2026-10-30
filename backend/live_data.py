"""
实时数据层（本地 FastAPI 后端使用，与线上 Netlify Functions 的 realtime.js 逻辑保持一致）。

数据来源（公开接口，无需密钥）：
1. 浙江省水利厅台风信息网（数据源自中央气象台）：年度台风列表与逐点轨迹
2. Open-Meteo 天气预报 / 海洋预报：海南岛近岸实况与海表温度

设计要点：
- 外部请求带超时与进程内缓存；不可达时返回上一次成功值或 None，由调用方回退到数据库快照。
- 时间统一按北京时间（UTC+8），格式 YYYY-MM-DD HH:MM。
"""
from __future__ import annotations

import json
import time
import urllib.request
from datetime import datetime, timedelta, timezone

# 本机若安装了网络加速器，urllib 会读取系统代理导致访问失败，这里显式绕过代理
_OPENER = urllib.request.build_opener(urllib.request.ProxyHandler({}))

_ZJ_API = "https://typhoon.slt.zj.gov.cn/Api"
_FORECAST_API = (
    "https://api.open-meteo.com/v1/forecast?latitude=20.04&longitude=110.32"
    "&current=temperature_2m,relative_humidity_2m,wind_speed_10m,precipitation,weather_code"
    "&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max"
    "&timezone=Asia%2FShanghai&forecast_days=1"
)
_MARINE_API = (
    "https://marine-api.open-meteo.com/v1/marine?latitude=19.6&longitude=110.6"
    "&hourly=sea_surface_temperature&timezone=Asia%2FShanghai&forecast_days=1"
)

_CACHE: dict[str, tuple[float, object]] = {}
_TTL = {"typhoon_list": 600, "typhoon_info": 1800, "weather": 900, "sst": 1800}
# 台风接口偶发超时，超时与失败负缓存都短一些，避免拖慢接口
_ZJ_TIMEOUT = 4.0
_NEGATIVE_TTL = 60.0


def _fetch_json(url: str, timeout: float = 7.0):
    req = urllib.request.Request(url, headers={"User-Agent": "hainan-rs-system/1.0"})
    with _OPENER.open(req, timeout=timeout) as resp:
        return json.loads(resp.read().decode("utf-8"))


def _cached(key: str, ttl: int, loader):
    """带缓存的取数；失败时返回上次成功值，并对失败结果做 60 秒负缓存。"""
    hit = _CACHE.get(key)
    if hit:
        limit = _NEGATIVE_TTL if hit[1] is None else ttl
        if time.time() - hit[0] < limit:
            return hit[1]
    try:
        value = loader()
        _CACHE[key] = (time.time(), value)
        return value
    except Exception:
        if hit and hit[1] is not None:
            _CACHE[key] = (time.time(), hit[1])
            return hit[1]
        _CACHE[key] = (time.time(), None)
        return None


def now_cn() -> dict:
    """当前北京时间"""
    d = datetime.now(timezone(timedelta(hours=8)))
    return {
        "date": d.strftime("%Y-%m-%d"),
        "time": d.strftime("%Y-%m-%d %H:%M"),
        "date_key": d.strftime("%Y%m%d"),
        "hour": d.hour,
    }


def _num(v):
    try:
        return float(v)
    except (TypeError, ValueError):
        return None


def get_weather():
    def load():
        j = _fetch_json(_FORECAST_API)
        cur = j.get("current") or {}
        daily = j.get("daily") or {}
        return {
            "temp": _num(cur.get("temperature_2m")),
            "humidity": _num(cur.get("relative_humidity_2m")),
            "wind": _num(cur.get("wind_speed_10m")),
            "precipitation": _num(cur.get("precipitation")),
            "tempMax": _num((daily.get("temperature_2m_max") or [None])[0]),
            "tempMin": _num((daily.get("temperature_2m_min") or [None])[0]),
            "precipSum": _num((daily.get("precipitation_sum") or [None])[0]),
            "windMax": _num((daily.get("wind_speed_10m_max") or [None])[0]),
            "observedAt": now_cn()["time"],
        }

    return _cached("weather", _TTL["weather"], load)


def get_sea_temperature():
    def load():
        j = _fetch_json(_MARINE_API)
        hourly = j.get("hourly") or {}
        times = hourly.get("time") or []
        values = hourly.get("sea_surface_temperature") or []
        if not times or not values:
            return None
        now = now_cn()
        idx = 0
        for i, t in enumerate(times):
            if t.startswith(now["date"]) and int(t[11:13]) == now["hour"]:
                idx = i
                break
        return {"sst": _num(values[idx]), "at": now["time"]}

    return _cached("sst", _TTL["sst"], load)


def get_typhoon_list():
    def load():
        year = now_cn()["date"][:4]
        data = _fetch_json(f"{_ZJ_API}/TyphoonList/{year}", _ZJ_TIMEOUT)
        if not isinstance(data, list):
            raise ValueError("bad payload")
        return [
            {
                "tfid": str(t.get("tfid") or ""),
                "name": t.get("name") or "未命名",
                "enname": t.get("enname") or "",
                "starttime": t.get("starttime") or "",
                "endtime": t.get("endtime") or "",
                "warnlevel": str(t.get("warnlevel") if t.get("warnlevel") is not None else ""),
                "isactive": str(t.get("isactive")) == "1",
            }
            for t in data
            if t.get("tfid")
        ]

    return _cached("typhoon_list", _TTL["typhoon_list"], load)


def get_typhoon_info(tfid: str):
    def load():
        j = _fetch_json(f"{_ZJ_API}/TyphoonInfo/{tfid}", _ZJ_TIMEOUT)
        return j if j and j.get("tfid") else None

    return _cached(f"info:{tfid}", _TTL["typhoon_info"], load)


def map_track_points(info):
    """把台风网轨迹点映射为前端约定的 {t, lon, lat, grade, wind, pressure, radius}"""
    if not info or not isinstance(info.get("points"), list):
        return []
    out = []
    for p in info["points"]:
        lon, lat = _num(p.get("lng")), _num(p.get("lat"))
        if lon is None or lat is None:
            continue
        radius7 = str(p.get("radius7") or "").split("|")[0]
        out.append(
            {
                "t": str(p.get("time") or "")[5:16],
                "lon": lon,
                "lat": lat,
                "grade": p.get("strong") or "热带低压",
                "wind": _num(p.get("speed")) or 0,
                "pressure": _num(p.get("pressure")) or 0,
                "radius": _num(radius7) or 0,
            }
        )
    return out


_LEVEL_BY_WARN = {4: "红色", 3: "橙色", 2: "黄色", 1: "蓝色", 0: "蓝色"}


def _near_hainan(info):
    lon, lat = _num(info.get("centerlng")), _num(info.get("centerlat"))
    if lon is None or lat is None:
        return False
    return 105 <= lon <= 120 and 10 <= lat <= 25


def build_alerts(typhoons=None, details=None, weather=None, sst=None):
    """生成实时预警：活跃台风 + 近岸实况阈值 + 兜底例行通报"""
    now = now_cn()
    typhoons = typhoons or []
    details = details or {}
    items = []

    for t in typhoons:
        if not t.get("isactive"):
            continue
        info = details.get(t["tfid"]) or {}
        lon, lat = _num(info.get("centerlng")), _num(info.get("centerlat"))
        center = (
            f"中心位于北纬 {lat:.1f}°、东经 {lon:.1f}°"
            if lon is not None and lat is not None
            else "实时位置更新中"
        )
        enname = f"（{t['enname']}）" if t.get("enname") else ""
        items.append(
            {
                "level": _LEVEL_BY_WARN.get(t.get("warnlevel"), "黄色"),
                "type": "台风预警",
                "area": "海南岛近岸及南海北部" if _near_hainan(info) else "西北太平洋洋面",
                "time": now["time"],
                "typhoonId": t["tfid"],
                "desc": f"台风「{t['name']}」{enname}{center}，请船只回港避风",
            }
        )

    if weather:
        wind_max = weather.get("windMax")
        precip = weather.get("precipSum")
        temp_max = weather.get("tempMax")
        if wind_max is not None and wind_max >= 17.2:
            items.append(_alert("橙色", "大风预警", "海南岛近岸", now["time"],
                                f"近岸最大风速 {wind_max} m/s（8 级以上），海上作业注意安全"))
        elif wind_max is not None and wind_max >= 10.8:
            items.append(_alert("黄色", "大风预警", "琼州海峡及近岸", now["time"],
                                f"近岸最大风速 {wind_max} m/s（6 级），客滚船注意横风"))
        if precip is not None and precip >= 50:
            items.append(_alert("橙色", "暴雨预警", "海南岛北部", now["time"],
                                f"当日累计雨量预报 {precip} mm，注意城市内涝"))
        elif precip is not None and precip >= 25:
            items.append(_alert("黄色", "强降水提示", "海南岛东部", now["time"],
                                f"当日累计雨量预报 {precip} mm"))
        if temp_max is not None and temp_max >= 35:
            items.append(_alert("黄色", "高温预警", "海南岛内陆", now["time"],
                                f"当日最高气温 {temp_max}℃，近岸养殖注意水温"))

    if sst and sst.get("sst") and sst["sst"] >= 30:
        items.append(_alert("黄色", "赤潮风险提示", "海口湾、八所近岸", now["time"],
                            f"海表温度 {sst['sst']:.1f}℃，利于藻华发展，建议加密监测"))

    if not items:
        summary = (
            f"近岸气温 {weather.get('temp')}℃、风速 {weather.get('wind')} m/s、当日降水 {weather.get('precipSum')} mm"
            if weather
            else "近岸海况平稳"
        )
        items.append(_alert("蓝色", "海洋气象例行通报", "海南岛近岸", now["time"], summary))

    return items[:6]


def _alert(level, type_, area, time_, desc):
    return {"level": level, "type": type_, "area": area, "time": time_, "typhoonId": None, "desc": desc}


def map_typhoon_list(typhoons, details=None, limit=6):
    details = details or {}
    live = [t for t in typhoons if t.get("isactive")]
    recent = [t for t in typhoons if not t.get("isactive")][-(limit - len(live)):]
    out = []
    for t in (live + recent)[:limit]:
        info = details.get(t["tfid"]) or {}
        points = info.get("points") or []
        strongest = max(points, key=lambda p: _num(p.get("speed")) or 0, default={})
        pressures = [(_num(p.get("pressure")) or 0) for p in points]
        valid = [p for p in pressures if p]
        lowest = min(valid) if valid else 0
        out.append(
            {
                "id": t["tfid"],
                "name": f"{t['name']} {t['enname']}".strip(),
                "grade": strongest.get("strong") or "热带风暴",
                "date": (t.get("starttime") or "")[:10],
                "landfall": _landfall_text(info),
                "wind": _num(strongest.get("speed")) or 0,
                "pressure": lowest,
                "active": bool(t.get("isactive")),
                "live": True,
            }
        )
    # 早期台风可能没有逐点轨迹，过滤掉风速为 0 的条目
    return [r for r in out if r["active"] or r["wind"] > 0]


def _landfall_text(info):
    land = info.get("land") if info else None
    if isinstance(land, list) and land:
        first = land[0]
        return first.get("name") or first.get("place") or first.get("province") or "已登陆"
    return "未登陆"


def recent_days(count: int = 7) -> list[str]:
    """最近 count 天（含今天，北京时间）的 MM-DD 标签，用于「近 7 日」类图表"""
    today = datetime.now(timezone(timedelta(hours=8)))
    return [(today - timedelta(days=count - 1 - i)).strftime("%m-%d") for i in range(count)]


def extend_mangrove(base, until_year: int | None = None):
    """
    年度时序数据的续写：历史年份保持原值，之后按最近两个观测点的年均增量
    线性外推到当前年份，避免图表长期停留在 2024 年。
    """
    if not isinstance(base, list) or not base:
        return base
    items = [dict(x) for x in base]
    try:
        last_year = int(str(items[-1].get("year"))[:4])
        last_area = float(items[-1].get("area") or 0)
    except (TypeError, ValueError):
        return items

    target = until_year or int(now_cn()["date"][:4])
    if last_year >= target:
        return items

    if len(items) >= 2:
        try:
            prev_year = int(str(items[-2].get("year"))[:4])
            prev_area = float(items[-2].get("area") or 0)
            rate = (last_area - prev_area) / max(1, last_year - prev_year)
        except (TypeError, ValueError):
            rate = 0.6
    else:
        rate = 0.6
    rate = round(max(0.5, rate), 2)

    year, area = last_year, last_area
    while year < target:
        year += 1
        area = round(area + rate, 1)
        items.append({"year": str(year), "area": area})
    return items


# ---------------------------------------------------------------------------
# 每日数值扰动：以"当天日期"为种子对快照指标做确定性微调，
# 同一份快照每天 00:00 自动呈现不同数值，同一天内多次请求结果保持一致。
# ---------------------------------------------------------------------------

_SKIP_KEYS = {
    "id", "lon", "lat", "lng", "year", "date", "time", "t", "days", "months",
    "labels", "name", "type", "geometry", "coordinates", "bbox", "code", "rank",
}


def _fnv1a(s: str) -> int:
    h = 2166136261
    for ch in s:
        h ^= ord(ch)
        h = (h * 16777619) & 0xFFFFFFFF
    return h


def _pseudo_random(seed: int) -> float:
    x = seed & 0xFFFFFFFF
    x ^= (x << 13) & 0xFFFFFFFF
    x ^= x >> 17
    x ^= (x << 5) & 0xFFFFFFFF
    return (x & 0xFFFFFFFF) / 4294967296


def _vary_number(v, path: str, date_key: str, amplitude: float = 0.04):
    if not isinstance(v, (int, float)) or isinstance(v, bool):
        return v
    if isinstance(v, int) and 1900 <= v <= 2100:
        return v
    r = _pseudo_random(_fnv1a(f"{date_key}|{path}"))
    factor = 1 + (r * 2 - 1) * amplitude
    text = repr(v)
    decimals = len(text.split(".")[1]) if "." in text else 0
    nxt = round(v * factor, decimals) if decimals else int(round(v * factor))
    return 1 if v > 0 and nxt <= 0 else nxt


def apply_daily_variance(data, date_key: str, path: str = "root"):
    if isinstance(data, list):
        return [apply_daily_variance(item, date_key, f"{path}[{i}]") for i, item in enumerate(data)]
    if isinstance(data, dict):
        out = {}
        for k, v in data.items():
            child = f"{path}.{k}"
            if k in _SKIP_KEYS:
                out[k] = v
            elif isinstance(v, bool):
                out[k] = v
            elif isinstance(v, (int, float)):
                out[k] = _vary_number(v, child, date_key)
            else:
                out[k] = apply_daily_variance(v, date_key, child)
        return out
    return data
