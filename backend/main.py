"""
海南近海生态环境监测与台风灾害评估系统 - FastAPI 后端
启动：uvicorn main:app --reload --port 8000
"""
from pathlib import Path

from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from routers import ecology, typhoon, damage, satellite, common
import live_data

app = FastAPI(
    title="海南近海遥感监测系统 API",
    description="多源卫星遥感数据服务接口",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(common.router, prefix="/api", tags=["公共"])
app.include_router(ecology.router, prefix="/api/ecology", tags=["生态监测"])
app.include_router(typhoon.router, prefix="/api/typhoon", tags=["台风监测"])
app.include_router(damage.router, prefix="/api/damage", tags=["灾害评估"])
app.include_router(satellite.router, prefix="/api/satellite", tags=["卫星数据"])


@app.get("/api/health")
def health():
    today = live_data.now_cn()
    return {
        "status": "ok",
        "service": "hainan-rs-system",
        "version": "0.1.0",
        "dataDate": today["date"],
        "refreshHint": "数据于每日 00:00（北京时间）自动更新",
    }


# 生产部署（Docker / 云平台）：若存在前端构建产物则一并托管，实现单端口对外服务
_DIST_DIR = Path(__file__).resolve().parent.parent / "dist"
if _DIST_DIR.is_dir():
    app.mount("/", StaticFiles(directory=str(_DIST_DIR), html=True), name="frontend")
