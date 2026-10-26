from fastapi import APIRouter
from database import DAMAGE_SUMMARY, BUILDING_DAMAGE, NDVI_COMPARE, CITY_DAMAGE, INUNDATION_POLYGONS

router = APIRouter()


@router.get("/summary")
def get_damage_summary():
    return DAMAGE_SUMMARY


@router.get("/building")
def get_building_damage():
    return BUILDING_DAMAGE


@router.get("/ndvi")
def get_ndvi_compare():
    return NDVI_COMPARE


@router.get("/city")
def get_city_damage():
    return CITY_DAMAGE


@router.get("/inundation")
def get_inundation():
    return INUNDATION_POLYGONS
