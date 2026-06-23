from fastapi import APIRouter, HTTPException, Query

from app.services import industry_sectors

router = APIRouter(prefix="/api/industry-sectors", tags=["行业板块管理"])


@router.get("/sectors")
def get_sectors(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=10000),
):
    return industry_sectors.get_sectors(page, page_size)


@router.get("/sectors-tree")
def get_sectors_tree():
    return industry_sectors._ok(industry_sectors.get_sectors_tree())


@router.get("/sectors/{sector_id}")
def get_sector(sector_id: str):
    sector = industry_sectors.get_sector(sector_id)
    if not sector:
        raise HTTPException(status_code=404, detail="板块不存在")
    return industry_sectors._ok(sector)


@router.get("/sectors/{sector_id}/stocks")
def get_sector_stocks(
    sector_id: str,
    include_descendants: bool = Query(False, description="包含子板块股票（顶层赛道建议开启）"),
):
    payload = industry_sectors.get_sector_stocks(sector_id, include_descendants=include_descendants)
    if not payload:
        raise HTTPException(status_code=404, detail="板块不存在")
    return industry_sectors._ok(payload)


@router.get("/treemap")
def get_treemap():
    return industry_sectors._ok(industry_sectors.get_treemap_data())


@router.get("/theme/{theme_key}")
def get_theme_view(theme_key: str):
    return industry_sectors.get_theme_view(theme_key)


@router.get("/theme-summaries")
def get_theme_summaries():
    return {"themes": industry_sectors.get_top_level_summaries()}
