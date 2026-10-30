from fastapi import APIRouter
from database import SATELLITE_CATALOG
import live_data

router = APIRouter()


@router.get("/catalog")
def get_satellite_catalog():
    return live_data.apply_daily_variance(
        SATELLITE_CATALOG, live_data.now_cn()["date_key"], "satellite-catalog"
    )
