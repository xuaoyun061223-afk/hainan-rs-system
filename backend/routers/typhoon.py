from fastapi import APIRouter
from database import TYPHOON_LIST, TYPHOON_TRACKS

router = APIRouter()


@router.get("/list")
def get_typhoon_list():
    return TYPHOON_LIST


@router.get("/track/{typhoon_id}")
def get_typhoon_track(typhoon_id: str):
    return TYPHOON_TRACKS.get(typhoon_id, TYPHOON_TRACKS["2411"])
