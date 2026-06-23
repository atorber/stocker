from fastapi import APIRouter, HTTPException, Query

from app.services import industry_chain

router = APIRouter(prefix="/api/industry-chain", tags=["产业图谱"])


@router.get("/list")
def get_chain_list(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    keyword: str | None = Query(None),
):
    return industry_chain.get_chain_list(page, page_size, keyword)


@router.get("/{chain_id}/graph-data")
def get_graph_data(chain_id: str):
    data = industry_chain.get_graph_data(chain_id)
    if not data:
        raise HTTPException(status_code=404, detail="产业链不存在")
    return industry_chain._ok(data)


@router.get("/{chain_id}/segments")
def get_segments(chain_id: str):
    if not industry_chain.get_graph_data(chain_id):
        raise HTTPException(status_code=404, detail="产业链不存在")
    return industry_chain._ok(industry_chain.get_segments(chain_id))


@router.get("/{chain_id}/relationships")
def get_relationships(chain_id: str):
    if not industry_chain.get_graph_data(chain_id):
        raise HTTPException(status_code=404, detail="产业链不存在")
    return industry_chain._ok(industry_chain.get_relationships(chain_id))


@router.get("/{chain_id}/view")
def get_chain_view(chain_id: str):
    view = industry_chain.get_chain_view(chain_id)
    if not view:
        raise HTTPException(status_code=404, detail="产业链不存在")
    return view


@router.get("/{chain_id}")
def get_chain_detail(chain_id: str):
    detail = industry_chain.get_chain_detail(chain_id)
    if not detail:
        raise HTTPException(status_code=404, detail="产业链不存在")
    return industry_chain._ok(detail)
