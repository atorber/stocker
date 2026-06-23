from __future__ import annotations

from datetime import date
from typing import Any

from app.db import fetch_all, fetch_one

MACRO_MAP = {
    "大金融": ("finance", "大金融"),
    "消费": ("consumer", "消费"),
    "周期": ("cycle", "周期"),
    "科技": ("tech", "科技"),
}

THEME_KEYS = {
    "finance": "大金融",
    "consumer": "消费",
    "cycle": "周期",
    "tech": "科技",
}

THEME_BRIEFS = {
    "finance": "息差预期改善，高股息资产吸引力凸显，负债端回暖支撑估值修复。",
    "consumer": "创新药 ADC 管线催化，出海授权逻辑持续，短期受集采情绪扰动。",
    "cycle": "资源端供需紧平衡，有色景气上行，光伏供给侧出清进行中。",
    "tech": "算力与应用双轮驱动，CPO 光模块景气上行，AI 应用端商业化提速。",
}

POOL_FILTERS = {
    "daily": "s.is_focused = 1",
    "basic": "s.is_in_basic = 1",
    "selected": "s.is_in_selected = 1",
    "trading": "s.is_in_trading = 1",
}

SORT_FIELDS = {
    "change_percent": "s.change_percent",
    "t_2_chg": "s.t_2_chg",
    "t_3_chg": "s.t_3_chg",
    "t_4_chg": "s.t_4_chg",
    "t_5_chg": "s.t_5_chg",
    "t_10": "s.t_10",
}


def _num(value: Any, default: float = 0.0) -> float:
    if value is None:
        return default
    return float(value)


def _display_code(code: str) -> str:
    return code.split(".")[0] if code else ""


def _fmt_pct(value: float | None) -> float | None:
    if value is None:
        return None
    return round(float(value), 2)


def _pool_status(row: dict[str, Any]) -> tuple[str, str]:
    if row.get("is_in_trading"):
        return "trading", "交易"
    if row.get("is_in_selected"):
        return "selected", "精选"
    if row.get("is_in_basic"):
        return "basic", "基础"
    return "daily", "备选"


def _entry_price(row: dict[str, Any]) -> float:
    for key in ("close_t5", "close_t3", "pre_close"):
        val = row.get(key)
        if val is not None and float(val) > 0:
            return round(float(val), 2)
    price = _num(row.get("price"))
    return round(price * 0.92, 2) if price > 0 else 0.0


def _macro_sector(row: dict[str, Any]) -> tuple[str, str, str]:
    macro_name = row.get("macro_sector") or "科技"
    key, label = MACRO_MAP.get(macro_name, ("tech", macro_name))
    sub = row.get("sub_sector") or "—"
    return key, label, sub


def _volume_meta(turnover_rate: float | None) -> tuple[str, list[int]]:
    rate = _num(turnover_rate)
    if rate >= 8:
        return "放量", [55, 75, 100, 80, 40]
    if rate >= 4:
        return "温和", [42, 48, 45, 40, 38]
    if rate > 0:
        return "缩量", [30, 28, 25, 22, 20]
    return "—", [20, 20, 20, 20, 20]


def _tp_meta(price: float, cost: float | None) -> tuple[float, str, bool]:
    if not cost or cost <= 0 or price <= 0:
        return 0.0, "", False
    target = cost * 1.15
    deviation = round((target - price) / price * 100, 1)
    if deviation <= 0:
        return abs(deviation), "hit", True
    if deviation <= 8:
        return deviation, "near", False
    return deviation, "", False


def _base_select() -> str:
    return """
        SELECT
            s.id, s.code, s.name, s.price, s.change_percent,
            s.t_2_chg, s.t_3_chg, s.t_4_chg, s.t_5_chg, s.t_10,
            s.is_in_basic, s.is_in_selected, s.is_in_trading,
            s.pre_close, s.close_t3, s.close_t5, s.turnover_rate,
            sec.name AS sub_sector,
            COALESCE(parent.name, '科技') AS macro_sector
        FROM stocks s
        LEFT JOIN stock_sector_relations ssr ON s.id = ssr.stock_id
        LEFT JOIN industry_sectors sec ON ssr.sector_id = sec.id
        LEFT JOIN industry_sectors parent ON sec.parent_id = parent.id
            AND parent.parent_id IS NULL
    """


def _enrich_rows(rows: list[dict[str, Any]], cost_map: dict[str, float] | None = None) -> list[dict[str, Any]]:
    seen: set[str] = set()
    unique_rows: list[dict[str, Any]] = []
    for row in rows:
        if row["id"] in seen:
            continue
        seen.add(row["id"])
        unique_rows.append(row)

    cost_map = cost_map or _load_cost_map([r["code"] for r in unique_rows])
    result: list[dict[str, Any]] = []
    for row in unique_rows:
        macro_key, macro_label, sub_sector = _macro_sector(row)
        status_key, status_label = _pool_status(row)
        price = round(_num(row.get("price")), 2)
        entry_price = _entry_price(row)
        cost_price = cost_map.get(row["code"]) or cost_map.get(_display_code(row["code"]))
        tp_dev, tp_level, tp_hit = _tp_meta(price, cost_price)
        vol_label, vol_bars = _volume_meta(row.get("turnover_rate"))
        result.append(
            {
                "id": row["id"],
                "code": _display_code(row["code"]),
                "codeFull": row["code"],
                "name": row["name"],
                "macroSector": macro_key,
                "macroSectorLabel": macro_label,
                "subSector": sub_sector,
                "price": price,
                "entryPrice": entry_price,
                "costPrice": round(cost_price, 2) if cost_price else None,
                "changePercent": _fmt_pct(row.get("change_percent")),
                "t2Chg": _fmt_pct(row.get("t_2_chg")),
                "t3Chg": _fmt_pct(row.get("t_3_chg")),
                "t4Chg": _fmt_pct(row.get("t_4_chg")),
                "t5Chg": _fmt_pct(row.get("t_5_chg")),
                "t10Chg": _fmt_pct(row.get("t_10")),
                "poolStatus": status_key,
                "poolStatusLabel": status_label,
                "tpDeviation": tp_dev,
                "tpDeviationLevel": tp_level,
                "tpHit": tp_hit,
                "volumeLabel": vol_label,
                "volumeBars": vol_bars,
                "inPool": bool(row.get("is_in_basic") or row.get("is_in_selected") or row.get("is_in_trading")),
            }
        )
    return result


def _load_cost_map(codes: list[str]) -> dict[str, float]:
    if not codes:
        return {}
    placeholders = ", ".join(["%s"] * len(codes))
    bare_codes = [_display_code(c) for c in codes]
    all_codes = list({*codes, *bare_codes})
    placeholders = ", ".join(["%s"] * len(all_codes))
    rows = fetch_all(
        f"""
        SELECT stock_code, traded_price
        FROM trade_record
        WHERE direction = 48 AND stock_code IN ({placeholders})
        ORDER BY traded_time DESC
        """,
        tuple(all_codes),
    )
    cost_map: dict[str, float] = {}
    for row in rows:
        code = row["stock_code"]
        if code not in cost_map:
            cost_map[code] = float(row["traded_price"])
    return cost_map


def get_pool_stocks(pool_type: str, search: str = "") -> list[dict[str, Any]]:
    where = POOL_FILTERS.get(pool_type, POOL_FILTERS["basic"])
    params: list[Any] = []
    search_clause = ""
    if search:
        search_clause = " AND (s.code LIKE %s OR s.name LIKE %s)"
        kw = f"%{search}%"
        params.extend([kw, kw])

    order = "COALESCE(s.last_research_report_pool_at, s.update_time) DESC"
    limit = 50 if pool_type == "daily" else 500
    if pool_type != "daily":
        order = "s.change_percent DESC"

    rows = fetch_all(
        f"""
        {_base_select()}
        WHERE {where}{search_clause}
        ORDER BY {order}
        LIMIT {limit}
        """,
        tuple(params),
    )
    return _enrich_rows(rows)


def get_pool_counts() -> dict[str, int]:
    row = fetch_one(
        """
        SELECT
            SUM(is_focused = 1) AS daily,
            SUM(is_in_basic = 1) AS basic,
            SUM(is_in_selected = 1) AS selected,
            SUM(is_in_trading = 1) AS trading
        FROM stocks
        """
    )
    return {
        "daily": int(row["daily"] or 0),
        "basic": int(row["basic"] or 0),
        "selected": int(row["selected"] or 0),
        "trading": int(row["trading"] or 0),
    }


def get_meta() -> dict[str, Any]:
    from app.services import daily_pool

    today = date.today().isoformat()
    counts = get_pool_counts()
    counts["daily"] = daily_pool.get_daily_count_for_date(today)
    return {
        "date": today,
        "marketStatus": "收盘",
        "poolCounts": counts,
        "basicPoolCount": counts["basic"],
        "dailyAvailableDates": daily_pool.get_available_dates(30),
    }


def get_theme_data(theme_key: str) -> dict[str, Any]:
    macro_name = THEME_KEYS.get(theme_key, "科技")
    rows = fetch_all(
        f"""
        {_base_select()}
        WHERE s.is_in_basic = 1
          AND EXISTS (
            SELECT 1 FROM stock_sector_relations ssr2
            JOIN industry_sectors sec2 ON ssr2.sector_id = sec2.id
            LEFT JOIN industry_sectors parent2 ON sec2.parent_id = parent2.id
            WHERE ssr2.stock_id = s.id
              AND (parent2.name = %s OR (parent2.id IS NULL AND sec2.name = %s))
          )
        ORDER BY s.change_percent DESC
        LIMIT 200
        """,
        (macro_name, macro_name),
    )
    stocks = _enrich_rows(rows)
    selected = sum(1 for s in stocks if s["poolStatus"] == "selected")
    trading = sum(1 for s in stocks if s["poolStatus"] == "trading")
    gains = [s["t3Chg"] for s in stocks if s["t3Chg"] is not None]
    avg_gain = round(sum(gains) / len(gains), 1) if gains else 0.0
    sectors = sorted({s["subSector"] for s in stocks if s["subSector"] != "—"})
    return {
        "theme": theme_key,
        "label": macro_name,
        "stocks": stocks,
        "summary": {
            "count": len(stocks),
            "selected": selected,
            "trading": trading,
            "avgT3Gain": avg_gain,
            "sectors": " · ".join(sectors[:5]) or "—",
        },
        "brief": THEME_BRIEFS.get(theme_key, ""),
    }


def get_all_themes_summary() -> list[dict[str, Any]]:
    result = []
    for key in THEME_KEYS:
        data = get_theme_data(key)
        result.append(
            {
                "theme": key,
                "label": data["label"],
                "count": data["summary"]["count"],
            }
        )
    return result


def get_radar(sort_field: str = "t_3_chg", limit: int = 10) -> dict[str, Any]:
    column = SORT_FIELDS.get(sort_field, SORT_FIELDS["t_3_chg"])
    rows = fetch_all(
        f"""
        {_base_select()}
        WHERE s.is_in_basic = 1
        ORDER BY {column} DESC
        LIMIT %s
        """,
        (limit,),
    )
    stocks = _enrich_rows(rows)
    basic_count = fetch_one("SELECT COUNT(*) AS c FROM stocks WHERE is_in_basic = 1")
    sort_labels = {
        "change_percent": "当日",
        "t_2_chg": "2日",
        "t_3_chg": "3日",
        "t_4_chg": "4日",
        "t_5_chg": "5日",
        "t_10": "10日",
    }
    return {
        "sortField": sort_field,
        "sortLabel": sort_labels.get(sort_field, "3日"),
        "basicCount": int(basic_count["c"] if basic_count else 0),
        "stocks": stocks,
    }
