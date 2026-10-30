from fastapi import APIRouter, HTTPException
from database import (
    DAMAGE_SUMMARY, BUILDING_DAMAGE, NDVI_COMPARE, CITY_DAMAGE, INUNDATION_POLYGONS,
    TYPHOON_LIST, TYPHOON_TRACKS,
)
import damage_model
import live_data

router = APIRouter()


def _daily(data, path: str):
    """叠加当日数值变化，使灾害评估指标每天 00:00 自动更新"""
    return live_data.apply_daily_variance(data, live_data.now_cn()["date_key"], path)


def _live_rows():
    """本年度实时台风（含活跃与最近几个），失败时返回空列表"""
    typhoons = live_data.get_typhoon_list() or []
    if not typhoons:
        return []
    details = {}
    targets = [t for t in typhoons if t.get("isactive")] + typhoons[-8:]
    for t in targets[:9]:
        info = live_data.get_typhoon_info(t["tfid"])
        if info:
            details[t["tfid"]] = info
    return live_data.map_typhoon_list(typhoons, details, limit=8)


def _find_typhoon(typhoon_id: str):
    """在历史快照与实时台风中查找评估对象"""
    for t in TYPHOON_LIST:
        if t["id"] == typhoon_id:
            return {**t, "active": False}
    for t in _live_rows():
        if t["id"] == typhoon_id:
            return t
    return None


def _track_of(typhoon_id: str):
    if typhoon_id in TYPHOON_TRACKS:
        return TYPHOON_TRACKS[typhoon_id]
    info = live_data.get_typhoon_info(typhoon_id)
    return live_data.map_track_points(info) if info else []


@router.get("/targets")
def get_assessment_targets():
    """评估对象列表：实时台风（活跃优先）+ 历史台风，供前端下拉选择"""
    live = [{**t, "source": "实时台风"} for t in _live_rows()]
    history = [
        {**t, "active": False, "live": False, "source": "历史台风"}
        for t in TYPHOON_LIST
    ]
    seen = {t["id"] for t in live}
    return live + [t for t in history if t["id"] not in seen]


@router.get("/assessment/{typhoon_id}")
def get_assessment(typhoon_id: str):
    typhoon = _find_typhoon(typhoon_id)
    if not typhoon:
        raise HTTPException(status_code=404, detail=f"未找到台风：{typhoon_id}")
    return damage_model.assess(typhoon, _track_of(typhoon_id))


@router.get("/summary")
def get_damage_summary():
    return _daily(DAMAGE_SUMMARY, "damage-summary")


@router.get("/building")
def get_building_damage():
    return _daily(BUILDING_DAMAGE, "damage-building")


@router.get("/ndvi")
def get_ndvi_compare():
    return _daily(NDVI_COMPARE, "damage-ndvi")


@router.get("/city")
def get_city_damage():
    return _daily(CITY_DAMAGE, "damage-city")


@router.get("/inundation")
def get_inundation():
    # 淹没范围多边形属于空间数据，坐标不能扰动，仅按原样返回
    return INUNDATION_POLYGONS
