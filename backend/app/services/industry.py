from __future__ import annotations

from typing import Any

from app.db import fetch_all, fetch_one
from app.services.stocks import MACRO_MAP, _display_code, _fmt_pct, _num

PHASE_DEFAULT = "景气期"
DRIVER_DEFAULTS = [
    "产业政策持续加码",
    "下游需求保持韧性",
    "龙头公司业绩兑现",
    "估值处于合理区间",
]

LAYER_ORDER = ["upstream", "midstream", "downstream", "application"]
LAYER_LABELS = ["上游", "中游", "下游", "应用"]


def get_chains() -> list[dict[str, Any]]:
    rows = fetch_all(
        """
        SELECT id, name, description, industry_category
        FROM industry_chains
        ORDER BY name
        """
    )
    return [
        {
            "id": row["id"],
            "name": row["name"],
            "description": row["description"],
            "category": row["industry_category"],
        }
        for row in rows
    ]


def _sector_class(category: str | None) -> tuple[str, str]:
    if not category:
        return "tech", "科技"
    for name, (key, label) in MACRO_MAP.items():
        if name in category:
            return key, label
    return "tech", category


def _layout_nodes(nodes: list[dict[str, Any]]) -> tuple[list[dict[str, Any]], list[dict[str, str]]]:
    if not nodes:
        return [], []

    buckets: dict[str, list[dict[str, Any]]] = {layer: [] for layer in LAYER_ORDER}
    for node in nodes:
        layer = node.get("segment_type") or "midstream"
        if layer not in buckets:
            layer = "midstream"
        buckets[layer].append(node)

    laid_out: list[dict[str, Any]] = []
    edges: list[dict[str, str]] = []
    col_width = 180
    start_x = 50
    start_y = 72
    row_gap = 120

    prev_col_ids: list[str] = []
    for col_idx, layer in enumerate(LAYER_ORDER):
        col_nodes = buckets[layer][:4]
        if not col_nodes and col_idx == 0:
            col_nodes = nodes[: min(4, len(nodes))]
        x_center = start_x + col_idx * col_width + 50
        for row_idx, node in enumerate(col_nodes):
            y = start_y + row_idx * row_gap
            node_id = node["id"]
            laid_out.append(
                {
                    **node,
                    "x": x_center - 50,
                    "y": y,
                    "width": 100,
                    "height": 56,
                    "layer": layer,
                    "layerLabel": LAYER_LABELS[col_idx],
                }
            )
            if prev_col_ids and row_idx < len(prev_col_ids):
                edges.append({"from": prev_col_ids[row_idx], "to": node_id})
        prev_col_ids = [n["id"] for n in col_nodes]

    if not edges and len(laid_out) > 1:
        for i in range(len(laid_out) - 1):
            edges.append({"from": laid_out[i]["id"], "to": laid_out[i + 1]["id"]})

    return laid_out, edges


def get_chain_detail(chain_id: str) -> dict[str, Any]:
    chain = fetch_one(
        "SELECT id, name, description, industry_category FROM industry_chains WHERE id = %s",
        (chain_id,),
    )
    if not chain:
        return {}

    nodes_raw = fetch_all(
        """
        SELECT
            cn.id, cn.stock_code, cn.stock_name, cn.position_x, cn.position_y,
            cs.name AS segment_name, cs.segment_type,
            s.is_in_basic, s.is_in_selected, s.is_in_trading, s.t_2
        FROM chain_nodes cn
        JOIN chain_segments cs ON cn.segment_id = cs.id
        LEFT JOIN stocks s ON cn.stock_code = s.code OR cn.stock_id = s.id
        WHERE cs.chain_id = %s
        ORDER BY cs.order_index, cn.stock_name
        LIMIT 80
        """,
        (chain_id,),
    )

    seen: set[str] = set()
    nodes: list[dict[str, Any]] = []
    for row in nodes_raw:
        code = row.get("stock_code") or ""
        if code in seen:
            continue
        seen.add(code)
        in_pool = bool(row.get("is_in_basic") or row.get("is_in_selected") or row.get("is_in_trading"))
        t3 = _fmt_pct(row.get("t_2"))
        nodes.append(
            {
                "id": row["id"],
                "code": _display_code(code),
                "codeFull": code,
                "name": row.get("stock_name") or "—",
                "segment": row.get("segment_name") or "—",
                "segmentType": row.get("segment_type"),
                "tracked": in_pool,
                "t3Chg": t3,
                "x": row.get("position_x"),
                "y": row.get("position_y"),
            }
        )

    laid_out, edges = _layout_nodes(nodes)
    sector_key, sector_label = _sector_class(chain.get("industry_category"))

    pool_nodes = [n for n in laid_out if n.get("tracked")]
    gains = [n["t3Chg"] for n in pool_nodes if n.get("t3Chg") is not None]
    avg_gain = round(sum(gains) / len(gains), 1) if gains else 0.0
    selected = sum(1 for n in pool_nodes if n.get("tracked"))

    description = chain.get("description") or f"{chain['name']}产业链持续受到市场关注，各环节龙头具备配置价值。"
    title = description.split("。")[0] if description else chain["name"]

    return {
        "id": chain["id"],
        "name": chain["name"],
        "phase": PHASE_DEFAULT,
        "sectorKey": sector_key,
        "sectorLabel": sector_label,
        "title": title[:60],
        "description": description,
        "drivers": DRIVER_DEFAULTS,
        "coverage": {
            "poolTotal": len(laid_out),
            "poolCovered": len(pool_nodes),
            "selected": selected,
            "avgT3Gain": avg_gain,
        },
        "nodes": laid_out,
        "edges": edges,
        "layerLabels": LAYER_LABELS,
    }
