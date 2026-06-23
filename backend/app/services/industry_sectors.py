from __future__ import annotations

from typing import Any

from app.db import fetch_all, fetch_one
from app.services.stocks import THEME_KEYS, _base_select, _enrich_rows

TOP_LEVEL_SECTOR_NAMES = ["大金融", "消费", "周期", "科技"]

THEME_KEY_BY_NAME = {v: k for k, v in THEME_KEYS.items()}
NAME_BY_THEME_KEY = THEME_KEYS


def _ok(data: Any) -> dict[str, Any]:
    return {"code": 0, "message": "success", "data": data}


def _sector_row_to_dict(row: dict[str, Any], parent_name: str | None = None) -> dict[str, Any]:
    return {
        "id": row["id"],
        "name": row["name"],
        "parentId": row.get("parent_id"),
        "parentName": parent_name,
        "description": row.get("description") or "",
        "color": row.get("color") or "blue",
        "stockCount": int(row.get("stock_count_computed") or row.get("stock_count") or 0),
        "avgChangePercent": float(row.get("avg_change_computed") or row.get("avg_change_percent") or 0),
        "sortOrder": int(row.get("sort_order") or 0),
        "createTime": row["create_time"].isoformat() if row.get("create_time") else None,
        "updateTime": row["update_time"].isoformat() if row.get("update_time") else None,
    }


def _get_descendant_ids(sector_id: str) -> list[str]:
    ids = [sector_id]
    queue = [sector_id]
    while queue:
        current = queue.pop(0)
        children = fetch_all(
            "SELECT id FROM industry_sectors WHERE parent_id = %s",
            (current,),
        )
        for child in children:
            cid = child["id"]
            if cid not in ids:
                ids.append(cid)
                queue.append(cid)
    return ids


def _compute_sector_stats(sector_ids: list[str]) -> tuple[int, float]:
    if not sector_ids:
        return 0, 0.0
    placeholders = ", ".join(["%s"] * len(sector_ids))
    row = fetch_one(
        f"""
        SELECT COUNT(DISTINCT ssr.stock_id) AS cnt,
               AVG(s.change_percent) AS avg_chg
        FROM stock_sector_relations ssr
        JOIN stocks s ON ssr.stock_id = s.id
        WHERE ssr.sector_id IN ({placeholders})
        """,
        tuple(sector_ids),
    )
    count = int(row["cnt"] or 0) if row else 0
    avg = round(float(row["avg_chg"] or 0), 2) if row and row["avg_chg"] is not None else 0.0
    return count, avg


def _load_all_sectors() -> list[dict[str, Any]]:
    return fetch_all(
        """
        SELECT id, name, parent_id, description, color, stock_count,
               avg_change_percent, sort_order, create_time, update_time
        FROM industry_sectors
        ORDER BY sort_order DESC, create_time DESC
        """
    )


def _enrich_sectors(sectors: list[dict[str, Any]]) -> list[dict[str, Any]]:
    parent_map = {s["id"]: s["name"] for s in sectors}
    result = []
    for sector in sectors:
        sector_ids = _get_descendant_ids(sector["id"])
        count, avg = _compute_sector_stats(sector_ids)
        item = dict(sector)
        item["stock_count_computed"] = count
        item["avg_change_computed"] = avg
        parent_name = parent_map.get(sector.get("parent_id")) if sector.get("parent_id") else None
        result.append(_sector_row_to_dict(item, parent_name))
    return result


def get_sectors(page: int = 1, page_size: int = 50) -> dict[str, Any]:
    sectors = _enrich_sectors(_load_all_sectors())
    total = len(sectors)
    start = (page - 1) * page_size
    end = start + page_size
    return {
        "code": 0,
        "message": "success",
        "data": sectors[start:end],
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": max(1, (total + page_size - 1) // page_size) if total else 0,
    }


def _build_sector_tree(nodes: list[dict[str, Any]]) -> list[dict[str, Any]]:
    node_map: dict[str, dict[str, Any]] = {}
    for n in nodes:
        item = dict(n)
        item["children"] = []
        node_map[item["id"]] = item
    roots: list[dict[str, Any]] = []
    for node in node_map.values():
        pid = node.get("parentId")
        parent = node_map.get(pid) if pid else None
        if parent:
            parent["children"].append(node)
        else:
            roots.append(node)
    return roots


def get_sectors_tree() -> list[dict[str, Any]]:
    nodes = _enrich_sectors(_load_all_sectors())
    return _build_sector_tree(nodes)


def get_sector(sector_id: str) -> dict[str, Any] | None:
    row = fetch_one(
        """
        SELECT id, name, parent_id, description, color, stock_count,
               avg_change_percent, sort_order, create_time, update_time
        FROM industry_sectors WHERE id = %s
        """,
        (sector_id,),
    )
    if not row:
        return None
    parent_name = None
    if row.get("parent_id"):
        parent = fetch_one("SELECT name FROM industry_sectors WHERE id = %s", (row["parent_id"],))
        parent_name = parent["name"] if parent else None
    sector_ids = _get_descendant_ids(sector_id)
    count, avg = _compute_sector_stats(sector_ids)
    item = dict(row)
    item["stock_count_computed"] = count
    item["avg_change_computed"] = avg
    return _sector_row_to_dict(item, parent_name)


def get_sector_stocks(sector_id: str, include_descendants: bool = False) -> dict[str, Any] | None:
    sector = get_sector(sector_id)
    if not sector:
        return None

    sector_ids = _get_descendant_ids(sector_id) if include_descendants else [sector_id]
    if not sector_ids:
        return {"sector": sector, "stocks": [], "items": []}

    placeholders = ", ".join(["%s"] * len(sector_ids))
    rows = fetch_all(
        f"""
        {_base_select()}
        WHERE s.id IN (
            SELECT DISTINCT ssr.stock_id
            FROM stock_sector_relations ssr
            WHERE ssr.sector_id IN ({placeholders})
        )
        ORDER BY s.change_percent DESC
        """,
        tuple(sector_ids),
    )
    items = _enrich_rows(rows)
    stocks = [
        {
            "id": item["id"],
            "code": item["codeFull"] or item["code"],
            "name": item["name"],
            "price": item["price"],
            "changePercent": item["changePercent"],
            "volume": 0,
            "marketCap": 0,
            "isInBasic": item["poolStatus"] in ("basic", "selected", "trading") or item.get("inPool"),
            "tags": [],
            "sectors": [item["subSector"]] if item["subSector"] != "—" else [],
        }
        for item in items
    ]
    return {"sector": sector, "stocks": stocks, "items": items}


def get_treemap_data() -> list[dict[str, Any]]:
    sectors = _load_all_sectors()
    result = []
    for sector in sectors:
        rows = fetch_all(
            f"""
            SELECT s.id, s.code, s.name, s.change_percent
            FROM stock_sector_relations ssr
            JOIN stocks s ON ssr.stock_id = s.id
            WHERE ssr.sector_id = %s
            """,
            (sector["id"],),
        )
        stocks = [
            {
                "id": r["id"],
                "code": r["code"],
                "name": r["name"],
                "changePercent": float(r["change_percent"] or 0),
            }
            for r in rows
        ]
        result.append(
            {
                "id": sector["id"],
                "name": sector["name"],
                "color": sector.get("color") or "blue",
                "stocks": stocks,
            }
        )
    return result


def get_top_level_sector_by_theme(theme_key: str) -> dict[str, Any] | None:
    name = NAME_BY_THEME_KEY.get(theme_key)
    if not name:
        return None
    row = fetch_one(
        """
        SELECT id, name, parent_id, description, color, stock_count,
               avg_change_percent, sort_order, create_time, update_time
        FROM industry_sectors
        WHERE name = %s AND parent_id IS NULL
        LIMIT 1
        """,
        (name,),
    )
    if not row:
        return None
    sector_ids = _get_descendant_ids(row["id"])
    count, avg = _compute_sector_stats(sector_ids)
    item = dict(row)
    item["stock_count_computed"] = count
    item["avg_change_computed"] = avg
    return _sector_row_to_dict(item)


def get_theme_view(theme_key: str) -> dict[str, Any]:
    sector = get_top_level_sector_by_theme(theme_key)
    if not sector:
        return {
            "theme": theme_key,
            "label": NAME_BY_THEME_KEY.get(theme_key, theme_key),
            "stocks": [],
            "summary": {"count": 0, "selected": 0, "trading": 0, "avgT3Gain": 0, "sectors": "—"},
            "brief": "",
            "sector": None,
        }

    payload = get_sector_stocks(sector["id"], include_descendants=True) or {
        "sector": sector,
        "stocks": [],
        "items": [],
    }
    items = payload.get("items") or []
    selected = sum(1 for s in items if s["poolStatus"] == "selected")
    trading = sum(1 for s in items if s["poolStatus"] == "trading")
    gains = [s["t3Chg"] for s in items if s.get("t3Chg") is not None]
    avg_t3 = round(sum(gains) / len(gains), 1) if gains else 0.0

    child_rows = fetch_all(
        """
        SELECT name FROM industry_sectors
        WHERE parent_id = %s
        ORDER BY sort_order DESC, name
        """,
        (sector["id"],),
    )
    sub_names = [r["name"] for r in child_rows]

    return {
        "theme": theme_key,
        "label": sector["name"],
        "sectorId": sector["id"],
        "stocks": items,
        "summary": {
            "count": len(items),
            "selected": selected,
            "trading": trading,
            "avgT3Gain": avg_t3,
            "avgChangePercent": sector.get("avgChangePercent", 0),
            "sectors": " · ".join(sub_names[:5]) or "—",
        },
        "brief": sector.get("description") or "",
        "sector": sector,
    }


def get_top_level_summaries() -> list[dict[str, Any]]:
    result = []
    for key in NAME_BY_THEME_KEY:
        sector = get_top_level_sector_by_theme(key)
        result.append(
            {
                "theme": key,
                "label": NAME_BY_THEME_KEY[key],
                "sectorId": sector["id"] if sector else None,
                "count": sector["stockCount"] if sector else 0,
            }
        )
    return result
