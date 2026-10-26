from fastapi import APIRouter
from database import HAINAN_OUTLINE, STATIONS, ALERTS, OVERVIEW_STATS, WEEKLY_SCENES, WATER_GRADE_DIST

router = APIRouter()


@router.get("/hainan-outline")
def get_hainan_outline():
    return HAINAN_OUTLINE


@router.get("/stations")
def get_stations():
    return STATIONS


@router.get("/alerts")
def get_alerts():
    return ALERTS


@router.get("/overview")
def get_overview():
    return OVERVIEW_STATS


@router.get("/weekly-scenes")
def get_weekly_scenes():
    return WEEKLY_SCENES


@router.get("/water-grade")
def get_water_grade():
    return WATER_GRADE_DIST
