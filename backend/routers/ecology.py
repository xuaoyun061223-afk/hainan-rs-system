from fastapi import APIRouter, Query
from database import (
    MONTHS, CHLA_SERIES, SST_SERIES, SHORELINE_CHANGE, MANGROVE_AREA,
)

router = APIRouter()


@router.get("/chla")
def get_chla(station: str = Query("海口湾")):
    return {"months": MONTHS, "values": CHLA_SERIES.get(station, CHLA_SERIES["海口湾"])}


@router.get("/sst")
def get_sst(station: str = Query("海口湾")):
    return {"months": MONTHS, "values": SST_SERIES.get(station, SST_SERIES["海口湾"])}


@router.get("/shoreline")
def get_shoreline():
    return SHORELINE_CHANGE


@router.get("/mangrove")
def get_mangrove():
    return MANGROVE_AREA
