from fastapi import APIRouter, Query
from database import (
    MONTHS, CHLA_SERIES, SST_SERIES, SHORELINE_CHANGE, MANGROVE_AREA,
)
import live_data

router = APIRouter()


def _daily(data, path: str):
    """叠加当日数值变化，使生态指标每天 00:00 自动更新"""
    return live_data.apply_daily_variance(data, live_data.now_cn()["date_key"], path)


@router.get("/chla")
def get_chla(station: str = Query("海口湾")):
    values = CHLA_SERIES.get(station, CHLA_SERIES["海口湾"])
    return {"months": MONTHS, "values": _daily(values, f"chla-{station}")}


@router.get("/sst")
def get_sst(station: str = Query("海口湾")):
    values = SST_SERIES.get(station, SST_SERIES["海口湾"])
    return {"months": MONTHS, "values": _daily(values, f"sst-{station}")}


@router.get("/shoreline")
def get_shoreline():
    return _daily(SHORELINE_CHANGE, "shoreline")


@router.get("/mangrove")
def get_mangrove():
    # 快照只到 2024 年，按近年增速自动续写到当前年份。
    # 红树林面积是年度统计量，不做逐日扰动，避免长时序曲线出现不符合实际的锯齿。
    return live_data.extend_mangrove(MANGROVE_AREA)
