from fastapi import APIRouter
from database import SATELLITE_CATALOG

router = APIRouter()


@router.get("/catalog")
def get_satellite_catalog():
    return SATELLITE_CATALOG
