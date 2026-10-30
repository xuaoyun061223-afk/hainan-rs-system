from fastapi import APIRouter
from database import DAMAGE_SUMMARY, BUILDING_DAMAGE, NDVI_COMPARE, CITY_DAMAGE, INUNDATION_POLYGONS
import live_data

router = APIRouter()


def _daily(data, path: str):
    """叠加当日数值变化，使灾害评估指标每天 00:00 自动更新"""
    return live_data.apply_daily_variance(data, live_data.now_cn()["date_key"], path)


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
