from datetime import date

from fastapi import APIRouter, HTTPException, Query

from app.services import daily_pool

router = APIRouter(prefix="/api/daily-stock-pool", tags=["每日股票池"])


@router.get("/pools")
def get_daily_pools():
    return daily_pool._ok(daily_pool.get_daily_pools())


@router.get("/pools/{pool_id}")
def get_daily_pool(pool_id: str):
    pool = daily_pool.get_daily_pool_by_id(pool_id)
    if not pool:
        raise HTTPException(status_code=404, detail="每日股票池不存在")
    return daily_pool._ok(pool)


@router.get("/pools/date/{date_str}")
def get_daily_pool_by_date(date_str: str):
    try:
        pool_date = date.fromisoformat(date_str)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="日期格式错误") from exc
    pool = daily_pool.get_daily_pool_by_date(pool_date)
    if not pool:
        raise HTTPException(status_code=404, detail="该日期没有股票池")
    return daily_pool._ok(pool)


@router.get("/stats")
def get_daily_pool_stats():
    return daily_pool._ok(daily_pool.get_daily_pool_stats())


@router.get("/dates")
def get_available_dates(limit: int = Query(default=120, le=365)):
    return daily_pool._ok({"dates": daily_pool.get_available_dates(limit)})


@router.get("/stocks/by-date/{date_str}")
def get_stocks_by_date(
    date_str: str,
    include_reports: bool = Query(False),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=1000),
    search: str = Query(default=""),
):
    if date_str != "all":
        try:
            date.fromisoformat(date_str)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail="日期格式错误，应为 YYYY-MM-DD 或 'all'") from exc
    return daily_pool._ok(
        daily_pool.get_stocks_by_date(
            date_str,
            include_reports=include_reports,
            page=page,
            page_size=page_size,
            search=search,
        )
    )


@router.get("/stocks/by-date/{date_str}/grid")
def get_daily_grid(
    date_str: str,
    page: int = Query(1, ge=1),
    page_size: int = Query(500, ge=1, le=1000),
    search: str = Query(default=""),
):
    """供 Stocker 股票池表格使用的扁平 StockItem 列表。"""
    if date_str != "all":
        try:
            date.fromisoformat(date_str)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail="日期格式错误") from exc
    return daily_pool.get_stocks_by_date_as_items(date_str, page=page, page_size=page_size, search=search)


@router.get("/stocks/by-date/{date_str}/stock-reports")
def get_stock_reports_by_date(
    date_str: str,
    stock_name: str = Query(..., alias="stock_name"),
):
    if not stock_name.strip():
        raise HTTPException(status_code=400, detail="stock_name 不能为空")
    return daily_pool._ok(daily_pool.get_stock_reports_by_date(date_str, stock_name))


@router.get("/reports/by-date/{date_str}")
def get_reports_by_date(date_str: str):
    return daily_pool._ok(daily_pool.get_reports_by_date(date_str))
