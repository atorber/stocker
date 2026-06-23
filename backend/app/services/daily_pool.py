from __future__ import annotations

import json
from datetime import date, datetime
from typing import Any

from app.db import fetch_all, fetch_one
from app.services.stocks import _base_select, _display_code, _enrich_rows

COMPLETED_STATUS = "COMPLETED"


def _ok(data: Any) -> dict[str, Any]:
    return {"code": 0, "message": "success", "data": data}


def _parse_json_field(value: Any) -> list:
    if not value:
        return []
    if isinstance(value, list):
        return value
    try:
        return json.loads(value)
    except (json.JSONDecodeError, TypeError):
        return []


def get_daily_pools() -> list[dict[str, Any]]:
    rows = fetch_all(
        """
        SELECT id, pool_date, report_count, total_stocks, avg_change_percent,
               create_time, update_time
        FROM daily_stock_pools
        ORDER BY pool_date DESC
        """
    )
    return [_pool_row_to_dict(row) for row in rows]


def _pool_row_to_dict(row: dict[str, Any], include_items: bool = False) -> dict[str, Any]:
    data = {
        "id": row["id"],
        "date": row["pool_date"].isoformat() if row.get("pool_date") else None,
        "reportCount": int(row.get("report_count") or 0),
        "totalStocks": int(row.get("total_stocks") or 0),
        "avgChangePercent": float(row.get("avg_change_percent") or 0),
        "createTime": row["create_time"].isoformat() if row.get("create_time") else None,
        "updateTime": row["update_time"].isoformat() if row.get("update_time") else None,
    }
    if include_items:
        data["stocks"] = get_pool_items(row["id"])
    return data


def get_pool_items(pool_id: str) -> list[dict[str, Any]]:
    rows = fetch_all(
        """
        SELECT id, stock_id, stock_code, stock_name, snapshot_price, snapshot_change_percent,
               snapshot_volume, snapshot_market_cap, source_report_ids, source_tags
        FROM daily_stock_pool_items
        WHERE pool_id = %s
        ORDER BY stock_name
        """,
        (pool_id,),
    )
    result = []
    for row in rows:
        report_ids = _parse_json_field(row.get("source_report_ids"))
        tags = _parse_json_field(row.get("source_tags"))
        result.append(
            {
                "id": row["id"],
                "code": row.get("stock_code") or "",
                "name": row.get("stock_name") or "",
                "price": float(row["snapshot_price"] or 0),
                "changePercent": float(row["snapshot_change_percent"] or 0),
                "volume": int(row.get("snapshot_volume") or 0),
                "marketCap": int(row.get("snapshot_market_cap") or 0),
                "tags": tags,
                "sourceReports": report_ids,
                "reportCount": len(report_ids),
            }
        )
    return result


def get_daily_pool_by_id(pool_id: str) -> dict[str, Any] | None:
    row = fetch_one(
        """
        SELECT id, pool_date, report_count, total_stocks, avg_change_percent,
               create_time, update_time
        FROM daily_stock_pools WHERE id = %s
        """,
        (pool_id,),
    )
    if not row:
        return None
    return _pool_row_to_dict(row, include_items=True)


def get_daily_pool_by_date(pool_date: date) -> dict[str, Any] | None:
    row = fetch_one(
        """
        SELECT id, pool_date, report_count, total_stocks, avg_change_percent,
               create_time, update_time
        FROM daily_stock_pools WHERE pool_date = %s
        """,
        (pool_date.isoformat(),),
    )
    if not row:
        return None
    return _pool_row_to_dict(row, include_items=True)


def get_available_dates(limit: int = 120) -> list[str]:
    rows = fetch_all(
        """
        SELECT DISTINCT publish_date AS d
        FROM research_reports
        WHERE status = %s AND publish_date IS NOT NULL
        ORDER BY d DESC
        LIMIT %s
        """,
        (COMPLETED_STATUS, limit),
    )
    return [row["d"].isoformat() for row in rows if row.get("d")]


def _fetch_reports_for_date(date_str: str) -> list[dict[str, Any]]:
    if date_str == "all":
        return fetch_all(
            """
            SELECT id, title, source, author, publish_date, extracted_stocks, extracted_tags
            FROM research_reports
            WHERE status = %s
            ORDER BY publish_date DESC, create_time DESC
            """,
            (COMPLETED_STATUS,),
        )
    return fetch_all(
        """
        SELECT id, title, source, author, publish_date, extracted_stocks, extracted_tags
        FROM research_reports
        WHERE status = %s AND publish_date = %s
        ORDER BY create_time DESC
        """,
        (COMPLETED_STATUS, date_str),
    )


def _aggregate_stock_stats(reports: list[dict[str, Any]], include_reports: bool) -> dict[str, dict[str, Any]]:
    stock_stats: dict[str, dict[str, Any]] = {}
    for report in reports:
        stocks = _parse_json_field(report.get("extracted_stocks"))
        tags = _parse_json_field(report.get("extracted_tags"))
        for stock_name in stocks:
            if not stock_name:
                continue
            if stock_name not in stock_stats:
                stock_stats[stock_name] = {
                    "count": 0,
                    "tags": set(),
                    "reports": [] if include_reports else None,
                }
            stock_stats[stock_name]["count"] += 1
            stock_stats[stock_name]["tags"].update(tags)
            if include_reports:
                stock_stats[stock_name]["reports"].append(
                    {
                        "id": report["id"],
                        "title": report["title"],
                        "source": report.get("source"),
                        "author": report.get("author"),
                    }
                )
    return stock_stats


def _load_stocks_by_names(names: list[str]) -> dict[str, dict[str, Any]]:
    if not names:
        return {}
    placeholders = ", ".join(["%s"] * len(names))
    rows = fetch_all(
        f"""
        {_base_select()}
        WHERE s.name IN ({placeholders})
        """,
        tuple(names),
    )
    enriched = _enrich_rows(rows)
    return {item["name"]: item for item in enriched}


def get_stocks_by_date(
    date_str: str,
    include_reports: bool = False,
    page: int = 1,
    page_size: int = 50,
    search: str = "",
) -> dict[str, Any]:
    reports = _fetch_reports_for_date(date_str)
    stock_stats = _aggregate_stock_stats(reports, include_reports)
    names = list(stock_stats.keys())
    stocks_map = _load_stocks_by_names(names)

    stock_list: list[dict[str, Any]] = []
    for stock_name, info in stock_stats.items():
        stock = stocks_map.get(stock_name)
        item: dict[str, Any] = {
            "stockName": stock_name,
            "stockCode": stock["code"] if stock else None,
            "count": info["count"],
            "price": stock["price"] if stock else None,
            "changePercent": stock["changePercent"] if stock else None,
            "tags": sorted(info["tags"]),
            "reportCount": info["count"],
        }
        if stock:
            item["stock"] = stock
        if include_reports:
            item["reports"] = info["reports"]
        stock_list.append(item)

    stock_list.sort(key=lambda x: x["count"], reverse=True)

    if search:
        kw = search.lower()
        stock_list = [
            s
            for s in stock_list
            if kw in s["stockName"].lower()
            or (s.get("stockCode") and kw in s["stockCode"].lower())
        ]

    total = len(stock_list)
    start = (page - 1) * page_size
    page_stocks = stock_list[start : start + page_size]

    report_payload = []
    if include_reports:
        report_payload = [
            {
                "id": r["id"],
                "title": r["title"],
                "source": r.get("source"),
                "author": r.get("author"),
                "extractedStocks": _parse_json_field(r.get("extracted_stocks")),
                "extractedTags": _parse_json_field(r.get("extracted_tags")),
            }
            for r in reports
        ]

    return {
        "date": date_str,
        "reportCount": len(reports),
        "stockCount": total,
        "stocks": page_stocks,
        "page": page,
        "pageSize": page_size,
        "totalPages": max(1, (total + page_size - 1) // page_size) if total else 0,
        "reports": report_payload,
    }


def get_stocks_by_date_as_items(
    date_str: str,
    page: int = 1,
    page_size: int = 500,
    search: str = "",
) -> dict[str, Any]:
    data = get_stocks_by_date(date_str, include_reports=False, page=page, page_size=page_size, search=search)
    items: list[dict[str, Any]] = []
    for row in data["stocks"]:
        stock = row.get("stock")
        if stock:
            entry = dict(stock)
            entry["poolStatus"] = "daily"
            entry["poolStatusLabel"] = "备选"
            if row.get("tags"):
                entry["subSector"] = " · ".join(row["tags"][:2])
            items.append(entry)
            continue
        code = row.get("stockCode") or ""
        items.append(
            {
                "id": f"daily-{code or row['stockName']}",
                "code": _display_code(code) if code else "—",
                "codeFull": code or "",
                "name": row["stockName"],
                "macroSector": "tech",
                "macroSectorLabel": "科技",
                "subSector": " · ".join(row.get("tags") or []) or "—",
                "price": row.get("price") or 0,
                "entryPrice": row.get("price") or 0,
                "costPrice": None,
                "changePercent": row.get("changePercent"),
                "t2Chg": None,
                "t3Chg": None,
                "t4Chg": None,
                "t5Chg": None,
                "t10Chg": None,
                "poolStatus": "daily",
                "poolStatusLabel": "备选",
                "tpDeviation": 0,
                "tpDeviationLevel": "",
                "tpHit": False,
                "volumeLabel": "—",
                "volumeBars": [20, 20, 20, 20, 20],
                "inPool": False,
                "reportCount": row.get("reportCount", 0),
            }
        )
    return {
        "date": date_str,
        "reportCount": data["reportCount"],
        "count": data["stockCount"],
        "items": items,
        "page": data["page"],
        "pageSize": data["pageSize"],
        "totalPages": data["totalPages"],
    }


def get_stock_reports_by_date(date_str: str, stock_name: str) -> dict[str, Any]:
    reports = _fetch_reports_for_date(date_str)
    matched = []
    name = (stock_name or "").strip()
    for report in reports:
        stocks = _parse_json_field(report.get("extracted_stocks"))
        if name in stocks:
            matched.append(
                {
                    "id": report["id"],
                    "title": report["title"],
                    "source": report.get("source"),
                    "author": report.get("author"),
                }
            )
    return {"date": date_str, "stockName": name, "reports": matched, "reportCount": len(matched)}


def get_reports_by_date(date_str: str) -> dict[str, Any]:
    reports = _fetch_reports_for_date(date_str)
    data = [
        {
            "id": r["id"],
            "title": r["title"],
            "source": r.get("source"),
            "author": r.get("author"),
            "publishDate": r["publish_date"].isoformat() if r.get("publish_date") else None,
        }
        for r in reports
    ]
    return {"date": date_str, "reports": data, "reportCount": len(data)}


def get_daily_pool_stats() -> dict[str, Any]:
    row = fetch_one(
        """
        SELECT
            COUNT(*) AS totalPools,
            COALESCE(SUM(total_stocks), 0) AS totalStocks,
            COALESCE(SUM(report_count), 0) AS totalReports,
            COALESCE(AVG(avg_change_percent), 0) AS avgChangePercent
        FROM daily_stock_pools
        """
    )
    total_pools = int(row["totalPools"] or 0)
    total_stocks = int(row["totalStocks"] or 0)
    return {
        "totalPools": total_pools,
        "totalStocks": total_stocks,
        "totalReports": int(row["totalReports"] or 0),
        "avgChangePercent": float(row["avgChangePercent"] or 0),
        "avgStocksPerPool": round(total_stocks / total_pools, 1) if total_pools else 0,
    }


def get_daily_count_for_date(date_str: str) -> int:
    data = get_stocks_by_date(date_str, page=1, page_size=1)
    return int(data["stockCount"])
