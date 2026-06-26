from pathlib import Path

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.cache import ApiCacheMiddleware
from app.config import settings
from app.routers import daily_stock_pool, industry_chain, industry_sectors
from app.services import industry_chain as industry_chain_svc, stocks

app = FastAPI(title="Stocker API", version="1.0.0")
STATIC_DIR = Path(__file__).resolve().parent / "static"

app.add_middleware(ApiCacheMiddleware, ttl=settings.API_CACHE_TTL_SECONDS)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(daily_stock_pool.router)
app.include_router(industry_sectors.router)
app.include_router(industry_chain.router)


@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.get("/api/meta")
def meta():
    return stocks.get_meta()


@app.get("/api/pools/{pool_type}")
def pool_stocks(pool_type: str, search: str = Query(default="")):
    if pool_type not in stocks.POOL_FILTERS:
        raise HTTPException(status_code=400, detail="invalid pool type")
    items = stocks.get_pool_stocks(pool_type, search)
    return {"poolType": pool_type, "count": len(items), "items": items}


@app.get("/api/themes/{theme_key}")
def theme_detail(theme_key: str):
    from app.services import industry_sectors

    return industry_sectors.get_theme_view(theme_key)


@app.get("/api/themes")
def themes_summary():
    from app.services import industry_sectors

    return {"themes": industry_sectors.get_top_level_summaries()}


@app.get("/api/industry/chains")
def chains():
    return {"chains": industry_chain_svc.get_chains_summary()}


@app.get("/api/industry/chains/{chain_id}")
def chain_detail(chain_id: str):
    detail = industry_chain_svc.get_chain_view(chain_id)
    if not detail:
        raise HTTPException(status_code=404, detail="产业链不存在")
    return detail


@app.get("/api/radar")
def radar(sort: str = Query(default="t_2"), limit: int = Query(default=10, le=50)):
    return stocks.get_radar(sort, limit)


if STATIC_DIR.is_dir():
    app.mount("/", StaticFiles(directory=STATIC_DIR, html=True), name="static")
