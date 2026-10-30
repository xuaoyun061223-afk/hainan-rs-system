from fastapi import APIRouter
from database import HAINAN_OUTLINE, STATIONS, ALERTS, OVERVIEW_STATS, WEEKLY_SCENES, WATER_GRADE_DIST
import live_data

router = APIRouter()


def _daily(data, path: str):
    """叠加当日数值变化，使各指标每天 00:00 自动更新（同一天内保持稳定）"""
    return live_data.apply_daily_variance(data, live_data.now_cn()["date_key"], path)


@router.get("/hainan-outline")
def get_hainan_outline():
    return HAINAN_OUTLINE


@router.get("/stations")
def get_stations():
    return _daily(STATIONS, "stations")


@router.get("/alerts")
def get_alerts():
    # 优先用实时台风 + 近岸实况天气派生；取不到实时数据时回退到数据库快照
    typhoons = live_data.get_typhoon_list() or []
    weather = live_data.get_weather()
    sea = live_data.get_sea_temperature()
    if typhoons or weather:
        details = {}
        targets = [t for t in typhoons if t["isactive"]] + typhoons[-5:]
        for t in targets[:6]:
            info = live_data.get_typhoon_info(t["tfid"])
            if info:
                details[t["tfid"]] = info
        live_alerts = live_data.build_alerts(typhoons, details, weather, sea)
        if live_alerts:
            return live_alerts
    return ALERTS


@router.get("/overview")
def get_overview():
    base = _daily(OVERVIEW_STATS, "overview")
    today = live_data.now_cn()
    typhoons = live_data.get_typhoon_list() or []
    weather = live_data.get_weather()
    sea = live_data.get_sea_temperature()
    alerts = live_data.build_alerts(typhoons, {}, weather, sea) if (typhoons or weather) else []
    return {
        **base,
        "activeTyphoon": len([t for t in typhoons if t["isactive"]]),
        "alertCount": len(alerts) or base.get("alertCount", 0),
        "dataDate": today["date"],
        "updatedAt": today["time"],
        "nextRefreshAt": f"{today['date']} 24:00",
        "live": {
            "ready": bool(weather or typhoons),
            "weather": weather,
            "seaTemperature": sea["sst"] if sea else None,
        },
    }


@router.get("/weekly-scenes")
def get_weekly_scenes():
    return _daily(WEEKLY_SCENES, "weekly-scenes")


@router.get("/water-grade")
def get_water_grade():
    return _daily(WATER_GRADE_DIST, "water-grade")
