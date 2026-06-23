import { useEffect, useMemo, useRef, useState } from 'react'
import { api } from '../api/client'
import type { ChainDetail } from '../types'
import { fmtPct, pctClass } from '../utils/format'
import { SectorTag } from './StockCells'

interface Props {
  active: boolean
  onToast: (msg: string) => void
}

export default function IndustryModule({ active, onToast }: Props) {
  const [chains, setChains] = useState<{ id: string; name: string }[]>([])
  const [chainId, setChainId] = useState('')
  const [detail, setDetail] = useState<ChainDetail | null>(null)
  const [loading, setLoading] = useState(false)
  const [ctx, setCtx] = useState<{ x: number; y: number; name: string } | null>(null)
  const nodeMap = useRef<Map<string, ChainDetail['nodes'][0]>>(new Map())

  useEffect(() => {
    if (!active) return
    api.industryChainList(1, 100).then((res) => {
      const list = (res.data ?? []).map((c) => ({ id: c.id, name: c.name }))
      setChains(list)
      if (list.length) {
        setChainId((prev) => prev || list[0].id)
      }
    }).catch(() => {
      api.chains().then((res) => {
        setChains(res.chains)
        if (res.chains.length) {
          setChainId((prev) => prev || res.chains[0].id)
        }
      })
    })
  }, [active])

  useEffect(() => {
    if (!active || !chainId) return
    setLoading(true)
    api.industryChainView(chainId)
      .then((d) => {
        setDetail(d)
        nodeMap.current = new Map(d.nodes.map((n) => [n.id, n]))
      })
      .catch(() => api.chain(chainId).then(setDetail))
      .finally(() => setLoading(false))
  }, [active, chainId])

  const coverage = detail?.coverage
  const layerLabels = detail?.layerLabels ?? []
  const layerLabelX = useMemo(() => {
    const count = Math.max(layerLabels.length, 1)
    const width = 820
    const margin = 70
    if (count === 1) return [width / 2]
    const step = (width - margin * 2) / (count - 1)
    return Array.from({ length: count }, (_, i) => margin + i * step)
  }, [layerLabels.length])

  const renderEdges = () => {
    if (!detail) return null
    return detail.edges.map((e, i) => {
      const from = nodeMap.current.get(e.from)
      const to = nodeMap.current.get(e.to)
      if (!from || !to) return null
      const x1 = from.x + from.width / 2
      const y1 = from.y + from.height / 2
      const x2 = to.x + to.width / 2
      const y2 = to.y + to.height / 2
      return <line key={i} className="edge-line" x1={x1} y1={y1} x2={x2} y2={y2} />
    })
  }

  const canvasTitle = layerLabels.length
    ? `拓扑视图 · ${layerLabels.join(' → ')}`
    : '拓扑视图'

  return (
    <section className={`module-panel${active ? ' active' : ''}`} id="module-industry">
      <div className="industry-layout">
        <aside className="brief-panel">
          <div className="page-head">
            <h1 className="page-title">产业链研判</h1>
            <p className="page-desc">自上而下梳理赛道逻辑，明确资金共振方向</p>
          </div>
          <div className="chain-select">
            <label>产业链切换</label>
            <select id="chainSelect" value={chainId} onChange={(e) => setChainId(e.target.value)}>
              {chains.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div className="brief-scroll" id="briefContent">
            {loading ? (
              <p style={{ color: 'var(--text-muted)', padding: '12px 0' }}>加载中…</p>
            ) : detail ? (
              <>
                <div className="phase-row">
                  <span className="phase-tag">{detail.phase}</span>
                  <SectorTag sector={detail.sectorKey} label={detail.sectorLabel} />
                </div>
                <h2 className="brief-h2">{detail.title}</h2>
                <div className="brief-block">
                  <h3>逻辑概述</h3>
                  <p>{detail.description}</p>
                </div>
                <div className="brief-block">
                  <h3>核心驱动要素</h3>
                  <ul className="driver-list">
                    {detail.drivers.map((d) => <li key={d}>{d}</li>)}
                  </ul>
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
              <p style={{ color: 'var(--text-muted)', padding: '12px 0' }}>暂无产业链数据</p>
            )}
          </div>
        </aside>
        <div className="canvas-panel">
          <div className="canvas-toolbar">
            <span className="canvas-title">{canvasTitle}</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
              <div className="canvas-legend">
                <div className="legend-item"><div className="legend-dot tracked"></div> 已在股票池</div>
                <div className="legend-item"><div className="legend-dot"></div> 未跟踪</div>
              </div>
              <div style={{ display: 'flex', gap: 4 }}>
                <button className="canvas-btn">+</button>
                <button className="canvas-btn">−</button>
                <button className="canvas-btn">⟲</button>
              </div>
            </div>
          </div>
          <div className="topology-wrap">
            <div className="grid-bg"></div>
            <svg className="topology-svg" viewBox="0 0 820 480" preserveAspectRatio="xMidYMid meet">
              {layerLabels.map((label, i) => (
                <text key={label} className="layer-label" x={layerLabelX[i] ?? 70} y={36}>{label}</text>
              ))}
              <g className="edges">{renderEdges()}</g>
              {(detail?.nodes ?? []).map((node) => {
                const gainCls = pctClass(node.t3Chg ?? 0)
                return (
                  <g
                    key={node.id}
                    className={`topo-node${node.tracked ? ' tracked' : ''}`}
                    onClick={() => node.tracked && onToast(`${node.name} · 已在股票池`)}
                    onContextMenu={(e) => {
                      e.preventDefault()
                      if (!node.tracked) setCtx({ x: e.clientX, y: e.clientY, name: node.name })
                    }}
                  >
                    <rect className="node-rect" x={node.x} y={node.y} width={node.width} height={node.height} rx={5} />
                    {node.tracked && <circle className="track-dot" cx={node.x + node.width - 8} cy={node.y + 8} r={4} />}
                    <text className="node-name" x={node.x + node.width / 2} y={node.y + 24} textAnchor="middle">{node.name}</text>
                    <text className="node-code" x={node.x + node.width / 2} y={node.y + 38} textAnchor="middle">{node.code}</text>
                    {node.t3Chg != null && (
                      <text className={`node-gain ${gainCls === 'down' ? 'down' : ''}`} x={node.x + node.width / 2} y={node.y + 50} textAnchor="middle">
                        {fmtPct(node.t3Chg)}
                      </text>
                    )}
                  </g>
                )
              })}
            </svg>
          </div>
        </div>
      </div>
      <div
        className={`context-menu${ctx ? ' visible' : ''}`}
        id="ctxMenu"
        style={ctx ? { left: ctx.x, top: ctx.y } : undefined}
      >
        <div
          className="ctx-item"
          onClick={() => {
            if (ctx) onToast(`已添加至基础池：${ctx.name}`)
            setCtx(null)
          }}
        >
          + 添加至基础股票池
        </div>
      </div>
    </section>
  )
}
