"""
台风灾害快速评估模型（Python 版，与 netlify/functions/damage_model.js 保持一致）。

不依赖人工灾情台账：以「台风强度（最大风速）」和「轨迹到海南岛的最短距离」为驱动，
用幂律外推各项灾情总量，再按各市县到登陆点的距离分摊，因此
- 历史台风与实时台风都能评估；
- 弱台风、远距离台风得到的灾情明显更小，不会出现"每个台风都同样惨重"；
- 同一输入始终得到同一结果（无随机数），便于逐日复现。

口径校准：以 2411「摩羯」（62 m/s、正面登陆文昌）为 1.0 基准，
其计算结果与数据库快照 DAMAGE_SUMMARY 一致（淹没 312.8 km²、损失 285.6 亿元等）。
"""
from __future__ import annotations

import math
from datetime import datetime, timedelta, timezone

REF_WIND = 62.0                      # 基准台风最大风速（摩羯）
HAINAN_CENTER = (109.80, 19.50)      # 海南岛几何中心，用于算轨迹逼近距离
REF_LANDFALL = (110.78, 19.62)       # 基准登陆点（文昌）
TOTAL_BUILDINGS = 506060             # 快照建筑总数（无损坏+轻微+严重+摧毁）

# 市县基准分布：数值来自 2411 快照，仅用于计算分摊比例
CITY_BASE = [
    {"city": "文昌", "lon": 110.80, "lat": 19.55, "inundation": 86.4, "buildings": 41200, "vegetation": 486.2},
    {"city": "海口", "lon": 110.32, "lat": 20.04, "inundation": 62.8, "buildings": 36800, "vegetation": 268.5},
    {"city": "澄迈", "lon": 110.00, "lat": 19.74, "inundation": 41.5, "buildings": 15600, "vegetation": 214.3},
    {"city": "临高", "lon": 109.69, "lat": 19.91, "inundation": 35.2, "buildings": 11200, "vegetation": 186.7},
    {"city": "琼海", "lon": 110.47, "lat": 19.26, "inundation": 28.6, "buildings": 8600, "vegetation": 172.5},
    {"city": "儋州", "lon": 109.58, "lat": 19.52, "inundation": 24.1, "buildings": 7900, "vegetation": 158.9},
    {"city": "定安", "lon": 110.35, "lat": 19.68, "inundation": 14.8, "buildings": 3200, "vegetation": 142.1},
    {"city": "其他", "lon": 109.50, "lat": 18.60, "inundation": 19.4, "buildings": 13860, "vegetation": 233.2},
]

# 文昌登陆区淹没多边形模板，评估时按登陆点平移并按强度缩放
POLY_TEMPLATE = [
    [[110.72, 19.98], [110.95, 20.02], [111.02, 19.82], [110.88, 19.62], [110.66, 19.68], [110.6, 19.85]],
    [[110.18, 20.0], [110.42, 20.06], [110.46, 19.9], [110.22, 19.88]],
]

# 海南岛范围框与常见登陆市县坐标，用于判定"是否正面影响海南"及淹没区锚点
HAINAN_BOX = (108.4, 17.8, 111.3, 20.3)
CITY_ANCHORS = {
    "文昌": (110.80, 19.62),
    "琼海": (110.47, 19.26),
    "万宁": (110.39, 18.80),
    "海口": (110.32, 20.04),
    "澄迈": (110.00, 19.74),
    "临高": (109.69, 19.91),
    "儋州": (109.58, 19.52),
    "三亚": (109.51, 18.25),
}


def _in_hainan(lon: float, lat: float) -> bool:
    return HAINAN_BOX[0] <= lon <= HAINAN_BOX[2] and HAINAN_BOX[1] <= lat <= HAINAN_BOX[3]


def _rnd(x: float, digits: int = 1) -> float:
    """四舍五入（与 JS Math.round 的 .5 进位行为保持一致，避免 Python 银行家舍入）"""
    m = 10 ** digits
    return math.floor(x * m + 0.5) / m


def _round_int(x: float) -> int:
    """先按 1 位小数取整，再按 .5 进位转成整数——与 JS 的 Math.round(rnd(x, 1)) 完全一致"""
    return int(math.floor(_rnd(x, 1) + 0.5))


def _clamp(x: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, x))


def _dist_km(lon1: float, lat1: float, lon2: float, lat2: float) -> float:
    """等距圆柱近似距离（海南岛尺度下与球面距离误差可忽略，且两端实现简单一致）"""
    dx = (lon2 - lon1) * math.cos(math.radians((lat1 + lat2) / 2)) * 111.0
    dy = (lat2 - lat1) * 111.0
    return math.sqrt(dx * dx + dy * dy)


def _landfall_point(track):
    """登陆点：优先取标有「登陆」的轨迹点；未登陆时取距离海南岛最近的点"""
    if not track:
        return None
    for p in track:
        if "登陆" in str(p.get("grade") or ""):
            return p
    return min(track, key=lambda p: _dist_km(HAINAN_CENTER[0], HAINAN_CENTER[1], p["lon"], p["lat"]))


def _landed(track, landfall_text: str) -> bool:
    """
    是否已经登陆：轨迹里出现「登陆」标注，或文字描述给出了登陆地。
    只有「未登陆」「海南近海」这类没有登陆事实的描述才算未登陆——
    尚未登陆的台风（含预报路径、远海转向）只做风险评估，不生成实况灾情数字。
    """
    for p in track or []:
        if "登陆" in str(p.get("grade") or ""):
            return True
    text = (landfall_text or "").strip()
    if not text or "未登陆" in text:
        return False
    # 「近海」「掠过」只是靠近，不等于登陆
    return not ("近海" in text or "掠过" in text)


def _impact_level(economic: float) -> str:
    """按经济损失量级给出影响等级"""
    return "特别重大" if economic >= 100 else "重大" if economic >= 50 else "较大" if economic >= 10 else "一般"


def _proximity(track, landfall_text: str = "") -> tuple[float, float]:
    """
    逼近程度 p∈[0.03,1]：取轨迹上离海南岛最近的点，距离每 250 km 衰减到 1/e。
    若台风文字描述里出现「海南」，或登陆点本身落在海南岛范围内，则视为正面影响（p=1）。
    """
    if not track:
        return 0.4, 999.0
    dmin = min(
        _dist_km(HAINAN_CENTER[0], HAINAN_CENTER[1], p["lon"], p["lat"]) for p in track
    )
    lf = _landfall_point(track)
    hit_hainan = "海南" in (landfall_text or "") or (
        lf is not None and _in_hainan(lf["lon"], lf["lat"])
    )
    p = 1.0 if hit_hainan else math.exp(-dmin / 250.0)
    return _clamp(p, 0.03, 1.0), round(dmin, 1)


def _impact_anchor(track, landfall_text: str):
    """
    灾情分摊与淹没区锚点：
    1) 描述里带具体市县名（如"海南文昌""海南琼海"）→ 用该市县坐标；
    2) 登陆点本身在海南岛范围内 → 用登陆点；
    3) 其余情况 → 取轨迹上最接近海南岛的点（仍可能离岛较远，淹没区不再绘制）。
    """
    text = landfall_text or ""
    for city, (lon, lat) in CITY_ANCHORS.items():
        if city in text:
            return {"lon": lon, "lat": lat, "inside": True}
    lf = _landfall_point(track)
    if lf and _in_hainan(lf["lon"], lf["lat"]):
        return {**lf, "inside": True}
    closest = None
    if track:
        closest = min(
            track, key=lambda p: _dist_km(HAINAN_CENTER[0], HAINAN_CENTER[1], p["lon"], p["lat"])
        )
    if closest:
        return {**closest, "inside": _in_hainan(closest["lon"], closest["lat"])}
    return {"lon": REF_LANDFALL[0], "lat": REF_LANDFALL[1], "inside": False}


def _landfall_city(text: str, anchor: dict) -> str:
    """登陆/影响市县名：优先取描述中的市县，否则取离锚点最近的市县（60 km 内）"""
    text = text or ""
    for city in CITY_ANCHORS:
        if city in text:
            return city
    best_city, best_dist = "", 999.0
    for city, (lon, lat) in CITY_ANCHORS.items():
        d = _dist_km(anchor["lon"], anchor["lat"], lon, lat)
        if d < best_dist:
            best_city, best_dist = city, d
    return best_city if best_dist <= 60 else ""


def _track_points(track) -> list:
    """前端地图需要的轨迹点（经纬度顺序为 [lon, lat]，与淹没区一致）"""
    out = []
    for p in track or []:
        if p.get("lon") is None or p.get("lat") is None:
            continue
        out.append({
            "t": str(p.get("t") or ""),
            "lon": p.get("lon"),
            "lat": p.get("lat"),
            "grade": str(p.get("grade") or ""),
            "wind": p.get("wind"),
            "pressure": p.get("pressure"),
            "radius": p.get("radius"),
        })
    return out


def _ndvi_series(r: float, landfall_t: str, year: int, impact: bool = True) -> dict:
    """
    台风前后 NDVI 时序：以登陆日为界，前段正常值、后段骤降再逐步恢复。
    impact=False（台风尚未登陆）时只给基线序列，表示「尚无过境影响」。
    """
    try:
        base = datetime(year, int(landfall_t[0:2]), int(landfall_t[3:5]), tzinfo=timezone.utc)
    except (ValueError, TypeError):
        base = datetime(year, 9, 6, tzinfo=timezone.utc)

    offsets = [-12, -9, -6, -3, 0, 3, 6, 9, 12, 15]
    dates = [(base + timedelta(days=o)).strftime("%m-%d") for o in offsets]

    before = [0.78, 0.77, 0.78, 0.76, 0.75] + [None] * 5
    if not impact:
        return {
            "dates": dates,
            "before": before,
            "after": [None] * 5,
            "landfallDate": "",
            "low": None,
        }
    low = _clamp(0.78 - 0.27 * (r ** 1.1), 0.25, 0.75)
    after_vals = [_rnd(low + 0.028 * i, 2) for i in range(5)]
    after = [None] * 5 + after_vals
    return {
        "dates": dates,
        "before": before,
        "after": after,
        "landfallDate": dates[4],
        "low": _rnd(low, 2),
    }


def _distribute(total: float, weights, digits: int = 1) -> list[float]:
    s = sum(weights) or 1.0
    return [_rnd(total * w / s, digits) for w in weights]


def assess(typhoon: dict, track: list) -> dict:
    """根据台风属性与轨迹生成一份完整的灾害评估结果"""
    track = track or []
    wind = float(typhoon.get("wind") or 0)
    r = _clamp(wind / REF_WIND, 0.05, 1.7)
    p, dmin = _proximity(track, str(typhoon.get("landfall") or ""))

    lf = _landfall_point(track) or {"lon": REF_LANDFALL[0], "lat": REF_LANDFALL[1], "t": ""}
    anchor = _impact_anchor(track, str(typhoon.get("landfall") or ""))

    inundation = _rnd(312.8 * (r ** 2.2) * p, 1)
    vegetation = _rnd(1862.4 * (r ** 1.8) * p, 1)
    economic = _rnd(285.6 * (r ** 2.6) * p, 1)
    population = _rnd(283.6 * (r ** 1.6) * p, 1)

    destroyed = _round_int(5860 * (r ** 2.8) * p)
    major = _round_int(21300 * (r ** 2.4) * p)
    minor = _round_int(92400 * (r ** 1.8) * p)
    none = max(0, TOTAL_BUILDINGS - destroyed - major - minor)

    power = _rnd(_clamp(100 - 86.5 * (r ** 2) * p, 3, 100), 1)
    road = _rnd(_clamp(100 - 32 * (r ** 1.5) * p, 20, 100), 1)
    ndvi_recover = _rnd(_clamp(100 - 58 * (r ** 1.5) * p, 10, 100), 1)

    # 市县分摊：基准份额（开 0.6 次方削弱文昌的先天权重）× 到影响锚点的距离衰减，
    # 使登陆点所在市县的灾情最重，同时保留周边市县梯度。
    w_in, w_bd, w_veg = [], [], []
    for c in CITY_BASE:
        decay = math.exp(-_dist_km(anchor["lon"], anchor["lat"], c["lon"], c["lat"]) / 45.0)
        w_in.append((c["inundation"] ** 0.6) * decay)
        w_bd.append((c["buildings"] ** 0.6) * decay)
        w_veg.append((c["vegetation"] ** 0.6) * decay)

    damaged_total = minor + major + destroyed
    ins = _distribute(inundation, w_in, 1)
    bld = _distribute(damaged_total, w_bd, 0)
    veg = _distribute(vegetation, w_veg, 1)
    cities = [
        {
            "city": c["city"],
            "lon": c["lon"],
            "lat": c["lat"],
            "inundation": ins[i],
            "buildings": int(bld[i]),
            "vegetation": veg[i],
        }
        for i, c in enumerate(CITY_BASE)
    ]
    cities.sort(key=lambda x: x["inundation"], reverse=True)

    # 淹没范围：只在台风确实正面影响海南（锚点落在岛内）时才有可解释的片区
    polygons = []
    if anchor["inside"] and p >= 0.25:
        k = 0.6 + 0.45 * r
        for ring in POLY_TEMPLATE:
            polygons.append([
                [_rnd(anchor["lon"] + (x - REF_LANDFALL[0]) * k, 3),
                 _rnd(anchor["lat"] + (y - REF_LANDFALL[1]) * k, 3)]
                for x, y in ring
            ])

    active = bool(typhoon.get("active"))
    landfall_text = str(typhoon.get("landfall") or "")
    landed = _landed(track, landfall_text)

    year = int(str(typhoon.get("date") or "")[:4] or 2026)
    t = str(lf.get("t") or "")
    ndvi = _ndvi_series(r, t[0:5] if len(t) >= 5 else "09-06", year, impact=landed)

    if landed:
        level = _impact_level(economic)
        status_text = "实时预评估（滚动更新）" if active else "已完成灾后快速评估"
        landfall_city = _landfall_city(landfall_text, anchor)
        forecast = None
    else:
        # 尚未登陆（含海域活动、预报路径）：不给实况灾情数字，避免用推测值假装成观测结果。
        # 模型外推的潜在影响单独放在 forecast 里，仅作风险评估参考。
        forecast = {
            "inundationArea": inundation,
            "vegetationDamage": vegetation,
            "economicLoss": economic,
            "affectedPopulation": population,
            "damagedBuildings": minor + major + destroyed,
            "impactLevel": _impact_level(economic),
        }
        level = forecast["impactLevel"]
        # 活跃台风用「尚未登陆」，已结束的用「未登陆」，两种都只作风险评估
        status_text = ("尚未登陆 · 仅作风险评估" if active else "未登陆 · 仅作风险评估")
        landfall_city = ""
        inundation = vegetation = economic = population = 0.0
        destroyed = major = minor = 0
        none = TOTAL_BUILDINGS
        power = road = ndvi_recover = 100.0
        cities = []
        polygons = []

    return {
        "id": str(typhoon.get("id") or ""),
        "name": str(typhoon.get("name") or ""),
        "grade": str(typhoon.get("grade") or ""),
        "wind": wind,
        "pressure": typhoon.get("pressure"),
        "date": typhoon.get("date"),
        "landfall": landfall_text or "未登陆",
        "landfallCity": landfall_city,
        "active": active,
        "statusText": status_text,
        "impactLevel": level,
        # landed=False 时前端只展示路径与风险提示，灾情指标一律显示「—」
        "landed": landed,
        "assessmentOnly": not landed,
        "forecast": forecast,
        "proximityKm": dmin,
        "landfallLon": anchor["lon"],
        "landfallLat": anchor["lat"],
        "affectedCities": len([c for c in cities if c["inundation"] > 0]),
        "affectedPopulation": population,
        "economicLoss": economic,
        "inundationArea": inundation,
        "vegetationDamage": vegetation,
        "building": {"none": none, "minor": minor, "major": major, "destroyed": destroyed},
        "recovery": {"power": power, "road": road, "ndvi": ndvi_recover},
        "cities": cities,
        "ndvi": ndvi,
        "polygons": polygons,
        # 轨迹随评估一起返回，前端地图据此绘制完整路径、登陆点与风圈
        "track": _track_points(track),
    }
