import { useCallback, useEffect, useState } from 'react'
import { api } from '../api/client'
import type { ChainDetail, ChainGraphData, ChainItem } from '../types'
import { buildChainDetailFromGraph } from '../utils/industryChain'
import { fmtPct, pctClass } from '../utils/format'
import { getUrlParam, patchUrlParams, usePopstate } from '../utils/urlParams'
import ChainTreemap from './ChainTreemap'
import { SectorTag } from './StockCells'

interface Props {
  active: boolean
  onToast: (msg: string) => void
}

export default function IndustryModule({ active, onToast }: Props) {
  const [chainItems, setChainItems] = useState<ChainItem[]>([])
  const [viewedChainId, setViewedChainId] = useState('')
  const [graphData, setGraphData] = useState<ChainGraphData | null>(null)
  const [detail, setDetail] = useState<ChainDetail | null>(null)
  const [listLoading, setListLoading] = useState(false)
  const [graphLoading, setGraphLoading] = useState(false)

  const loadGraphData = useCallback(async (chainId: string, syncUrl = true) => {
    setViewedChainId(chainId)
    if (syncUrl) patchUrlParams({ chain: chainId })
    setGraphLoading(true)
    try {
      const graph = await api.industryChainGraphData(chainId)
      if (!graph.nodes?.length) {
        setGraphData(null)
        setDetail(null)
        onToast('该产业链暂无股票数据')
        return
      }
      setGraphData(graph)
      setDetail(buildChainDetailFromGraph(graph))
    } catch {
      setGraphData(null)
      setDetail(null)
      onToast('加载图谱数据失败')
    } finally {
      setGraphLoading(false)
    }
  }, [onToast])

  useEffect(() => {
    if (!active) return
    setListLoading(true)
    api
      .industryChainList(1, 100)
      .then((res) => {
        setChainItems(res.data ?? [])
      })
      .catch(() => {
        setChainItems([])
        onToast('获取产业链列表失败')
      })
      .finally(() => setListLoading(false))
  }, [active, onToast])

  useEffect(() => {
    if (!active || listLoading || chainItems.length === 0) return
    const chainFromUrl = getUrlParam('chain')
    const match = chainFromUrl ? chainItems.find((c) => c.id === chainFromUrl) : null
    const targetId = match?.id ?? chainItems[0].id
    if (viewedChainId === targetId) return
    loadGraphData(targetId, !match)
  }, [active, listLoading, chainItems, viewedChainId, loadGraphData])

  const syncChainFromUrl = useCallback(() => {
    if (!active || chainItems.length === 0) return
    const chainFromUrl = getUrlParam('chain')
    const match = chainFromUrl ? chainItems.find((c) => c.id === chainFromUrl) : null
    const targetId = match?.id ?? chainItems[0].id
    if (targetId !== viewedChainId) loadGraphData(targetId, false)
  }, [active, chainItems, viewedChainId, loadGraphData])
  usePopstate(syncChainFromUrl)

  const coverage = detail?.coverage
  const hasGraph = Boolean(graphData?.nodes?.length)

  const canvasTitle = graphData?.chain?.name
    ? `矩形树图 · ${graphData.chain.name}`
    : '矩形树图'

  return (
    <section className={`module-panel${active ? ' active' : ''}`} id="module-industry">
      <div className="industry-layout">
        <aside className="brief-panel">
          <div className="page-head">
            <h1 className="page-title">产业链图谱</h1>
            <p className="page-desc">自上而下梳理赛道逻辑，明确资金共振方向</p>
          </div>
          <div className="chain-list-wrap">
            <label className="chain-list-label">产业链列表</label>
            {listLoading ? (
              <p className="chain-list-empty">加载列表中…</p>
            ) : chainItems.length === 0 ? (
              <p className="chain-list-empty">暂无产业链</p>
            ) : (
              <div className="chain-list">
                {chainItems.map((chain) => (
                  <button
                    key={chain.id}
                    type="button"
                    className={`chain-card${viewedChainId === chain.id ? ' active' : ''}`}
                    onClick={() => {
                      if (viewedChainId !== chain.id) loadGraphData(chain.id)
                    }}
                  >
                    <span className="chain-card-name">{chain.name}</span>
                    {chain.industry_category ? (
                      <span className="chain-card-category">{chain.industry_category}</span>
                    ) : null}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="chain-brief-footer" id="briefContent">
            {!viewedChainId && !listLoading ? (
              <p className="chain-list-empty">暂无产业链数据</p>
            ) : graphLoading || (listLoading && !viewedChainId) ? (
              <p className="chain-list-empty">加载图谱数据中…</p>
            ) : detail ? (
              <>
                <div className="phase-row">
                  <span className="phase-tag">{detail.phase}</span>
                  <SectorTag sector={detail.sectorKey} label={detail.sectorLabel} />
                </div>
                <div className="coverage-stat">
                  <div className="item">
                    <span className="label">池内覆盖</span>
                    <span className="val mono">
                      {coverage?.poolCovered}
                      <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>/{coverage?.poolTotal}</span>
                    </span>
                  </div>
                  <div className="item">
                    <span className="label">精选池</span>
                    <span className="val mono up">{coverage?.selected}</span>
                  </div>
                  <div className="item">
                    <span className="label">近3日均涨幅</span>
                    <span className={`val mono ${pctClass(coverage?.avgT3Gain ?? 0)}`}>
                      {fmtPct(coverage?.avgT3Gain ?? 0)}
                    </span>
                  </div>
                </div>
              </>
            ) : (
              <p className="chain-list-empty">暂无产业链数据</p>
            )}
          </div>
        </aside>
        <div className="canvas-panel">
          <div className="canvas-toolbar">
            <span className="canvas-title">{canvasTitle}</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
              <div style={{ display: 'flex', gap: 4 }}>
                <button
                  type="button"
                  className="canvas-btn"
                  title="刷新"
                  disabled={!viewedChainId || graphLoading}
                  onClick={() => viewedChainId && loadGraphData(viewedChainId)}
                >
                  ⟲
                </button>
              </div>
            </div>
          </div>
          <div className="topology-wrap">
            <div className="grid-bg"></div>
            {!viewedChainId && !listLoading ? (
              <div className="topology-placeholder">暂无产业链</div>
            ) : graphLoading || (listLoading && !viewedChainId) ? (
              <div className="topology-placeholder">加载中…</div>
            ) : !hasGraph ? (
              <div className="topology-placeholder">该产业链暂无股票数据</div>
            ) : (
              <ChainTreemap graphData={graphData!} />
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
