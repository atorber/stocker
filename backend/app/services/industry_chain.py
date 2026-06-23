from __future__ import annotations

import math
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

LAYER_TYPE_ORDER = ["upstream", "midstream", "downstream", "application"]
LAYER_TYPE_LABELS = {
    "upstream": "上游",
    "midstream": "中游",
    "downstream": "下游",
    "application": "应用",
}

POOL_SEGMENT_NAMES = {"交易股票池", "精选股票池", "基础股票池"}

_STOCK_JOIN = """
LEFT JOIN stocks s ON cn.stock_id = s.id
  OR cn.stock_code = s.code
  OR SUBSTRING_INDEX(s.code, '.', 1) = SUBSTRING_INDEX(cn.stock_code, '.', 1)
"""


def _ok(data: Any, **extra: Any) -> dict[str, Any]:
    payload: dict[str, Any] = {"code": 0, "message": "success", "data": data}
    payload.update(extra)
    return payload


def _iso(value: Any) -> str | None:
    if value is None:
        return None
    return value.isoformat() if hasattr(value, "isoformat") else str(value)


def _chain_row_to_dict(row: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": row["id"],
        "name": row["name"],
        "description": row.get("description"),
        "industry_category": row.get("industry_category"),
        "created_at": _iso(row.get("created_at")),
        "updated_at": _iso(row.get("updated_at")),
    }


def _segment_row_to_dict(row: dict[str, Any], nodes: list[dict[str, Any]] | None = None) -> dict[str, Any]:
    data = {
        "id": row["id"],
        "chain_id": row["chain_id"],
        "parent_id": row.get("parent_id"),
        "name": row["name"],
        "order_index": int(row.get("order_index") or 0),
        "description": row.get("description"),
        "segment_type": row.get("segment_type"),
        "created_at": _iso(row.get("created_at")),
        "updated_at": _iso(row.get("updated_at")),
    }
    if nodes is not None:
        data["nodes"] = nodes
    return data


def _node_row_to_dict(row: dict[str, Any], segment_name: str | None = None) -> dict[str, Any]:
    return {
        "id": row["id"],
        "segment_id": row["segment_id"],
        "stock_id": row.get("stock_id"),
        "stock_code": row.get("stock_code") or "",
        "stock_name": row.get("stock_name") or "",
        "company_name": row.get("company_name"),
        "description": row.get("description"),
        "position_x": float(row["position_x"]) if row.get("position_x") is not None else None,
        "position_y": float(row["position_y"]) if row.get("position_y") is not None else None,
        "created_at": _iso(row.get("created_at")),
        "updated_at": _iso(row.get("updated_at")),
        "segment_name": segment_name or row.get("segment_name"),
    }


def _relationship_row_to_dict(row: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": row["id"],
        "chain_id": row["chain_id"],
        "source_node_id": row["source_node_id"],
        "target_node_id": row["target_node_id"],
        "relationship_type": row["relationship_type"],
        "description": row.get("description"),
        "strength": int(row.get("strength") or 3),
        "created_at": _iso(row.get("created_at")),
        "updated_at": _iso(row.get("updated_at")),
    }


def _sector_class(category: str | None) -> tuple[str, str]:
    if not category:
        return "tech", "科技"
    for name, (key, label) in MACRO_MAP.items():
        if name in category:
            return key, label
    mapping = {
        "人工智能": ("tech", "科技"),
        "半导体": ("tech", "科技"),
        "商业航天": ("tech", "科技"),
        "电力设备": ("cycle", "周期"),
    }
    for token, pair in mapping.items():
        if token in category:
            return pair
    return "tech", category


def _is_pool_chain(chain: dict[str, Any], segments: list[dict[str, Any]]) -> bool:
    if chain.get("name") == "股票池":
        return True
    if not segments:
        return False
    names = {s.get("name") for s in segments}
    return bool(names & POOL_SEGMENT_NAMES)


def get_chain_list(page: int = 1, page_size: int = 20, keyword: str | None = None) -> dict[str, Any]:
    where = ""
    params: list[Any] = []
    if keyword:
        where = "WHERE name LIKE %s OR description LIKE %s"
        params.extend([f"%{keyword}%", f"%{keyword}%"])

    total_row = fetch_one(f"SELECT COUNT(*) AS c FROM industry_chains {where}", tuple(params))
    total = int(total_row["c"]) if total_row else 0
    offset = (page - 1) * page_size
    rows = fetch_all(
        f"""
        SELECT id, name, description, industry_category, created_at, updated_at
        FROM industry_chains
        {where}
        ORDER BY created_at DESC
        LIMIT %s OFFSET %s
        """,
        tuple(params + [page_size, offset]),
    )

    chains: list[dict[str, Any]] = []
    for row in rows:
        segs = fetch_all(
            "SELECT id, name FROM chain_segments WHERE chain_id = %s",
            (row["id"],),
        )
        if _is_pool_chain(row, segs):
            continue
        chains.append(_chain_row_to_dict(row))

    return _ok(
        chains,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=max(1, math.ceil(total / page_size)) if page_size else 1,
    )


def get_chain_detail(chain_id: str) -> dict[str, Any] | None:
    chain = fetch_one(
        """
        SELECT id, name, description, industry_category, created_at, updated_at
        FROM industry_chains WHERE id = %s
        """,
        (chain_id,),
    )
    if not chain:
        return None

    segments = fetch_all(
        """
        SELECT id, chain_id, parent_id, name, order_index, description, segment_type, created_at, updated_at
        FROM chain_segments
        WHERE chain_id = %s
        ORDER BY order_index, name
        """,
        (chain_id,),
    )

    segment_payload: list[dict[str, Any]] = []
    for seg in segments:
        nodes = fetch_all(
            """
            SELECT id, segment_id, stock_id, stock_code, stock_name, company_name,
                   description, position_x, position_y, created_at, updated_at
            FROM chain_nodes
            WHERE segment_id = %s
            ORDER BY created_at
            """,
            (seg["id"],),
        )
        segment_payload.append(
            _segment_row_to_dict(seg, [_node_row_to_dict(n) for n in nodes])
        )

    relationships = fetch_all(
        """
        SELECT id, chain_id, source_node_id, target_node_id, relationship_type,
               description, strength, created_at, updated_at
        FROM chain_relationships
        WHERE chain_id = %s
        """,
        (chain_id,),
    )

    data = _chain_row_to_dict(chain)
    data["segments"] = segment_payload
    data["relationships"] = [_relationship_row_to_dict(r) for r in relationships]
    return data


def get_segments(chain_id: str) -> list[dict[str, Any]]:
    segments = fetch_all(
        """
        SELECT id, chain_id, parent_id, name, order_index, description, segment_type, created_at, updated_at
        FROM chain_segments
        WHERE chain_id = %s
        ORDER BY order_index, name
        """,
        (chain_id,),
    )
    result: list[dict[str, Any]] = []
    for seg in segments:
        nodes = fetch_all(
            """
            SELECT id, segment_id, stock_id, stock_code, stock_name, company_name,
                   description, position_x, position_y, created_at, updated_at
            FROM chain_nodes
            WHERE segment_id = %s
            ORDER BY created_at
            """,
            (seg["id"],),
        )
        result.append(_segment_row_to_dict(seg, [_node_row_to_dict(n) for n in nodes]))
    return result


def get_relationships(chain_id: str) -> list[dict[str, Any]]:
    rows = fetch_all(
        """
        SELECT id, chain_id, source_node_id, target_node_id, relationship_type,
               description, strength, created_at, updated_at
        FROM chain_relationships
        WHERE chain_id = %s
        """,
        (chain_id,),
    )
    return [_relationship_row_to_dict(r) for r in rows]


def get_graph_data(chain_id: str) -> dict[str, Any] | None:
    chain = fetch_one(
        """
        SELECT id, name, description, industry_category, created_at, updated_at
        FROM industry_chains WHERE id = %s
        """,
        (chain_id,),
    )
    if not chain:
        return None

    segments = fetch_all(
        """
        SELECT id, chain_id, parent_id, name, order_index, description, segment_type, created_at, updated_at
        FROM chain_segments
        WHERE chain_id = %s
        ORDER BY order_index, name
        """,
        (chain_id,),
    )

    nodes: list[dict[str, Any]] = []
    for seg in segments:
        seg_nodes = fetch_all(
            f"""
            SELECT cn.id, cn.segment_id, cn.stock_id, cn.stock_code, cn.stock_name,
                   cn.company_name, cn.description, cn.position_x, cn.position_y,
                   cn.created_at, cn.updated_at,
                   s.is_in_basic, s.is_in_selected, s.is_in_trading, s.t_3_chg, s.change_percent
            FROM chain_nodes cn
            {_STOCK_JOIN}
            WHERE cn.segment_id = %s
            ORDER BY cn.created_at
            """,
            (seg["id"],),
        )
        for node in seg_nodes:
            nodes.append(
                {
                    **_node_row_to_dict(node, seg["name"]),
                    "segment_id": seg["id"],
                    "segment_name": seg["name"],
                    "segment_type": seg.get("segment_type"),
                    "segment_order": int(seg.get("order_index") or 0),
                    "isInBasic": bool(node.get("is_in_basic")),
                    "isInSelected": bool(node.get("is_in_selected")),
                    "isInTrading": bool(node.get("is_in_trading")),
                    "t3Chg": _fmt_pct(node.get("t_3_chg")),
                    "changePercent": _num(node.get("change_percent"), 0),
                }
            )

    return {
        "chain": _chain_row_to_dict(chain),
        "segments": [_segment_row_to_dict(s) for s in segments],
        "nodes": nodes,
        "relationships": [],
    }


def _layout_topology(
    segments: list[dict[str, Any]],
    nodes: list[dict[str, Any]],
) -> tuple[list[dict[str, Any]], list[dict[str, str]], list[str]]:
    if not nodes:
        return [], [], []

    typed_segments: dict[str, list[dict[str, Any]]] = {t: [] for t in LAYER_TYPE_ORDER}
    named_segments: list[dict[str, Any]] = sorted(segments, key=lambda s: int(s.get("order_index") or 0))

    segment_by_id = {s["id"]: s for s in segments}
    for seg in named_segments:
        seg_type = seg.get("segment_type")
        if seg_type in typed_segments:
            typed_segments[seg_type].append(seg)

    use_type_layout = any(typed_segments[t] for t in LAYER_TYPE_ORDER)
    columns: list[tuple[str, str, list[dict[str, Any]]]] = []

    if use_type_layout:
        for layer in LAYER_TYPE_ORDER:
            for seg in typed_segments[layer]:
                seg_nodes = [n for n in nodes if n.get("segment_id") == seg["id"]]
                if seg_nodes:
                    columns.append((layer, LAYER_TYPE_LABELS[layer], seg_nodes))
    else:
        for seg in named_segments:
            seg_nodes = [n for n in nodes if n.get("segment_id") == seg["id"]]
            if seg_nodes:
                columns.append((seg["id"], seg["name"], seg_nodes))

    if not columns:
        columns = [("all", "标的", nodes)]

    col_width = 180
    start_x = 50
    start_y = 72
    row_gap = 120
    laid_out: list[dict[str, Any]] = []
    edges: list[dict[str, str]] = []
    layer_labels: list[str] = []
    prev_col_ids: list[str] = []

    for col_idx, (layer_key, layer_label, col_nodes) in enumerate(columns[:4]):
        layer_labels.append(layer_label)
        x_center = start_x + col_idx * col_width + 50
        current_ids: list[str] = []
        for row_idx, node in enumerate(col_nodes[:6]):
            px = node.get("position_x")
            py = node.get("position_y")
            x = float(px) if px is not None else x_center - 50
            y = float(py) if py is not None else start_y + row_idx * row_gap
            tracked = bool(
                node.get("isInBasic") or node.get("isInSelected") or node.get("isInTrading")
            )
            seg = segment_by_id.get(node.get("segment_id", ""), {})
            laid_out.append(
                {
                    "id": node["id"],
                    "code": _display_code(node.get("stock_code") or ""),
                    "codeFull": node.get("stock_code") or "",
                    "name": node.get("stock_name") or "—",
                    "segment": node.get("segment_name") or seg.get("name") or "—",
                    "segmentType": node.get("segment_type") or layer_key,
                    "tracked": tracked,
                    "t3Chg": node.get("t3Chg"),
                    "x": x,
                    "y": y,
                    "width": 100,
                    "height": 56,
                    "layer": layer_key,
                    "layerLabel": layer_label,
                }
            )
            current_ids.append(node["id"])
            if prev_col_ids and row_idx < len(prev_col_ids):
                edges.append({"from": prev_col_ids[row_idx], "to": node["id"]})
        prev_col_ids = current_ids

    if not edges and len(laid_out) > 1:
        for i in range(len(laid_out) - 1):
            edges.append({"from": laid_out[i]["id"], "to": laid_out[i + 1]["id"]})

    return laid_out, edges, layer_labels


def get_chain_view(chain_id: str) -> dict[str, Any] | None:
    graph = get_graph_data(chain_id)
    if not graph:
        return None

    chain = graph["chain"]
    segments = graph["segments"]
    nodes = graph["nodes"]
    laid_out, edges, layer_labels = _layout_topology(segments, nodes)

    pool_nodes = [n for n in laid_out if n.get("tracked")]
    selected = sum(
        1
        for n in nodes
        if n.get("isInSelected") or n.get("isInTrading")
    )
    gains = [n["t3Chg"] for n in pool_nodes if n.get("t3Chg") is not None]
    avg_gain = round(sum(gains) / len(gains), 1) if gains else 0.0

    sector_key, sector_label = _sector_class(chain.get("industry_category"))
    description = chain.get("description") or f"{chain['name']}产业链持续受到市场关注，各环节龙头具备配置价值。"
    title = description.split("。")[0] if description else chain["name"]
    drivers = DRIVER_DEFAULTS
    if description and "。" in description:
        parts = [p.strip() for p in description.replace("；", "。").split("。") if len(p.strip()) > 4]
        if len(parts) >= 2:
            drivers = parts[:4]

    phase = PHASE_DEFAULT
    if avg_gain >= 8:
        phase = "爆发期"
    elif avg_gain >= 3:
        phase = "景气期"
    elif avg_gain < 0:
        phase = "调整期"

    return {
        "id": chain["id"],
        "name": chain["name"],
        "phase": phase,
        "sectorKey": sector_key,
        "sectorLabel": sector_label,
        "title": title[:80],
        "description": description,
        "drivers": drivers,
        "coverage": {
            "poolTotal": len(laid_out),
            "poolCovered": len(pool_nodes),
            "selected": selected,
            "avgT3Gain": avg_gain,
        },
        "nodes": laid_out,
        "edges": edges,
        "layerLabels": layer_labels or ["环节一", "环节二", "环节三", "环节四"],
        "graph": graph,
    }


def get_chains_summary() -> list[dict[str, str]]:
    res = get_chain_list(page=1, page_size=100)
    return [{"id": c["id"], "name": c["name"]} for c in res.get("data", [])]
