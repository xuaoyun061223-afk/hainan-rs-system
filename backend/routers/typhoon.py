from fastapi import APIRouter, HTTPException
from database import TYPHOON_LIST, TYPHOON_TRACKS
import live_data

router = APIRouter()


@router.get("/list")
def get_typhoon_list():
    # 优先返回本年度实时台风（活跃优先），取不到时回退到历史快照
    typhoons = live_data.get_typhoon_list() or []
    if typhoons:
        details = {}
        targets = [t for t in typhoons if t["isactive"]] + typhoons[-5:]
        for t in targets[:6]:
            info = live_data.get_typhoon_info(t["tfid"])
            if info:
                details[t["tfid"]] = info
        rows = live_data.map_typhoon_list(typhoons, details)
        if rows:
            return rows
    return live_data.apply_daily_variance(
        TYPHOON_LIST, live_data.now_cn()["date_key"], "typhoon-list"
    )


@router.get("/history")
def get_typhoon_history():
    """历史台风快照（用于线上「历史台风」分组与实时源不可用时的兜底）"""
    return live_data.apply_daily_variance(
        TYPHOON_LIST, live_data.now_cn()["date_key"], "typhoon-history"
    )


@router.get("/track/{typhoon_id}")
def get_typhoon_track(typhoon_id: str):
    if typhoon_id in TYPHOON_TRACKS:
        return live_data.apply_daily_variance(
            TYPHOON_TRACKS[typhoon_id], live_data.now_cn()["date_key"], f"track-{typhoon_id}"
        )
    # 快照里没有的编号（本年度实时台风）走实时轨迹接口
    info = live_data.get_typhoon_info(typhoon_id)
    points = live_data.map_track_points(info)
    if points:
        return points
    raise HTTPException(status_code=404, detail=f"未找到台风轨迹：{typhoon_id}")
