import { useCallback, useEffect, useMemo, useState } from 'react'
import { api } from '../api/client'
import type { IndustrySectorTreeNode, StockItem, ThemeData, ThemeKey } from '../types'
import { fmtPct, fmtPrice } from '../utils/format'
import {
  ALL_SUB_SECTOR,
  buildSectorFilterLabel,
  findThemeRoot,
  findTreeNode,
  sortSectorNodes,
} from '../utils/themeSectors'
import { getUrlParam, parseThemeTab, patchUrlParams, usePopstate } from '../utils/urlParams'
import { GainColumns, PoolCapsule, PriceCell, StockIdentity } from './StockCells'

const THEME_TABS: { key: ThemeKey; label: string }[] = [
  { key: 'tech', label: '科技' },
  { key: 'finance', label: '大金融' },
  { key: 'consumer', label: '消费' },
  { key: 'cycle', label: '周期' },
]

interface Props {
  active: boolean
}

export default function ThemeModule({ active }: Props) {
  const [theme, setThemeState] = useState<ThemeKey>(() => parseThemeTab())
  const [data, setData] = useState<ThemeData | null>(null)
  const [sectorTree, setSectorTree] = useState<IndustrySectorTreeNode[]>([])
  const [loading, setLoading] = useState(false)
  const [primarySectorId, setPrimarySectorId] = useState<string | null>(() => getUrlParam('sector'))
  const [childSectorId, setChildSectorId] = useState<string | null>(() => getUrlParam('sub'))
  const [sectorFilterStocks, setSectorFilterStocks] = useState<StockItem[] | null>(null)
  const [filterLoading, setFilterLoading] = useState(false)

  const sectorMap = useMemo(() => {
    const map: Partial<Record<ThemeKey, IndustrySectorTreeNode>> = {}
    THEME_TABS.forEach((tab) => {
      const root = findThemeRoot(sectorTree, tab.key, tab.label)
      if (root) map[tab.key] = root
    })
    return map
  }, [sectorTree])

  const themeRoot = sectorMap[theme] ?? null
  const level1Sectors = useMemo(
    () => sortSectorNodes(themeRoot?.children ?? []),
    [themeRoot],
  )

  const primarySector = primarySectorId && themeRoot
    ? findTreeNode([themeRoot], primarySectorId)
    : null
  const childSectors = useMemo(
    () => sortSectorNodes(primarySector?.children ?? []),
    [primarySector],
  )

  const filterNode = useMemo(() => {
    if (!primarySectorId || !themeRoot) return null
    const primary = findTreeNode([themeRoot], primarySectorId)
    if (!primary) return null
    if (childSectorId) {
      return findTreeNode([primary], childSectorId) ?? primary
    }
    return primary
  }, [primarySectorId, childSectorId, themeRoot])

  useEffect(() => {
    if (!active) return
    api.sectorsTree().then((res) => {
      setSectorTree(res.data ?? [])
    })
  }, [active])

  useEffect(() => {
    if (!active) return
    setLoading(true)
    const sector = sectorMap[theme]
    if (sector?.id) {
      api
        .sectorStocks(sector.id, true)
        .then((res) => {
          const payload = res.data
          const items = payload.items ?? []
          const selected = items.filter((s) => s.poolStatus === 'selected').length
          const trading = items.filter((s) => s.poolStatus === 'trading').length
          const gains = items.map((s) => s.t3Chg).filter((v): v is number => v != null)
          const avgT3 = gains.length ? Math.round((gains.reduce((a, b) => a + b, 0) / gains.length) * 10) / 10 : 0
          const childNames = sortSectorNodes(sector.children ?? []).map((s) => s.name)
          setData({
            theme,
            label: sector.name,
            sectorId: sector.id,
            stocks: items,
            summary: {
              count: items.length,
              selected,
              trading,
              avgT3Gain: avgT3,
              avgChangePercent: sector.avgChangePercent,
              sectors: childNames.slice(0, 5).join(' · ') || '—',
            },
            brief: sector.description || '',
            sector,
          })
        })
        .catch(() => api.theme(theme).then(setData))
        .finally(() => setLoading(false))
    } else {
      api.theme(theme).then(setData).finally(() => setLoading(false))
    }
  }, [active, theme, sectorMap])

  const syncThemeFromUrl = useCallback(() => {
    if (!active) return
    setThemeState(parseThemeTab())
    setPrimarySectorId(getUrlParam('sector'))
    setChildSectorId(getUrlParam('sub'))
    setSectorFilterStocks(null)
  }, [active])
  usePopstate(syncThemeFromUrl)

  useEffect(() => {
    if (active) syncThemeFromUrl()
  }, [active, syncThemeFromUrl])

  const setTheme = (key: ThemeKey) => {
    setThemeState(key)
    setPrimarySectorId(null)
    setChildSectorId(null)
    setSectorFilterStocks(null)
    patchUrlParams({ theme: key, sector: null, sub: null })
  }

  useEffect(() => {
    if (!active || !filterNode) {
      setSectorFilterStocks(null)
      setFilterLoading(false)
      return
    }
    let cancelled = false
    setSectorFilterStocks(null)
    setFilterLoading(true)
    api
      .sectorStocks(filterNode.id, true)
      .then((res) => {
        if (!cancelled) setSectorFilterStocks(res.data?.items ?? [])
      })
      .catch(() => {
        if (!cancelled) setSectorFilterStocks([])
      })
      .finally(() => {
        if (!cancelled) setFilterLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [active, filterNode])

  const displayStocks = filterNode ? (sectorFilterStocks ?? []) : (data?.stocks ?? [])
  const tableLoading = loading || (filterLoading && !!filterNode)

  const summary = data?.summary

  const filteredSummary = useMemo(() => {
    if (!filterNode || !summary) return summary
    const selected = displayStocks.filter((s) => s.poolStatus === 'selected').length
    const trading = displayStocks.filter((s) => s.poolStatus === 'trading').length
    const gains = displayStocks.map((s) => s.t3Chg).filter((v): v is number => v != null)
    const avgT3 = gains.length ? Math.round((gains.reduce((a, b) => a + b, 0) / gains.length) * 10) / 10 : 0
    return {
      ...summary,
      count: displayStocks.length,
      selected,
      trading,
      avgT3Gain: avgT3,
      avgChangePercent: filterNode.avgChangePercent,
    }
  }, [summary, filterNode, displayStocks])

  const displaySummary = filterNode ? filteredSummary : summary
  const gainCls = displaySummary && (displaySummary.avgT3Gain ?? 0) >= 0 ? 'up' : 'down'
  const dayGainCls = displaySummary && (displaySummary.avgChangePercent ?? 0) >= 0 ? 'up' : 'down'
  const filterLabel = buildSectorFilterLabel(themeRoot, primarySectorId, childSectorId)

  const selectPrimarySector = (sectorId: string | null) => {
    setPrimarySectorId(sectorId)
    setChildSectorId(null)
    setSectorFilterStocks(null)
    patchUrlParams({ sector: sectorId, sub: null })
  }

  const selectChildSector = (sectorId: string | null) => {
    setChildSectorId(sectorId)
    setSectorFilterStocks(null)
    patchUrlParams({ sub: sectorId })
  }

  return (
    <section className={`module-panel${active ? ' active' : ''}`} id="module-theme">
      <main className="main">
        <div className="page-head">
          <h1 className="page-title">主题方向</h1>
          <p className="page-desc" id="themePageDesc">
            四大赛道配置全景 · 当前：{data?.label ?? '—'}
          </p>
        </div>
        <div className="control-bar">
          <div className="pool-tabs theme-tabs" role="tablist">
            {THEME_TABS.map((tab) => (
              <button
                key={tab.key}
                className={`pool-tab theme-tab${theme === tab.key ? ' active' : ''}`}
                data-theme={tab.key}
                role="tab"
                aria-selected={theme === tab.key}
                onClick={() => setTheme(tab.key)}
              >
                {tab.label}
                <span className="count">{sectorMap[tab.key]?.stockCount ?? '—'}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="theme-summary" id="themeSummary">
          <div className="item"><span className="label">池内标的</span><span className="val mono">{displaySummary?.count ?? '—'}</span></div>
          <div className="item"><span className="label">精选 / 交易</span><span className="val mono">{displaySummary ? `${displaySummary.selected} / ${displaySummary.trading}` : '—'}</span></div>
          <div className="item">
            <span className="label">近3日均涨幅</span>
            <span className={`val mono ${gainCls}`}>{displaySummary ? fmtPct(displaySummary.avgT3Gain) : '—'}</span>
          </div>
          <div className="item">
            <span className="label">板块当日均涨幅</span>
            <span className={`val mono ${dayGainCls}`}>
              {displaySummary?.avgChangePercent != null ? fmtPct(displaySummary.avgChangePercent) : '—'}
            </span>
          </div>
          <div className="item theme-sub-sector-item">
            <span className="label">细分板块</span>
            <div className="theme-sub-sector-rows">
              <div className="theme-sub-sectors" role="group" aria-label="细分板块筛选">
                {level1Sectors.length === 0 ? (
                  <span className="val" style={{ fontSize: 13, fontWeight: 500 }}>—</span>
                ) : (
                  <>
                    <button
                      type="button"
                      className={`theme-sub-sector${!primarySectorId ? ' active' : ''}`}
                      aria-pressed={!primarySectorId}
                      onClick={() => selectPrimarySector(null)}
                    >
                      {ALL_SUB_SECTOR}
                    </button>
                    {level1Sectors.map((sector) => (
                      <button
                        key={sector.id}
                        type="button"
                        className={`theme-sub-sector${primarySectorId === sector.id ? ' active' : ''}`}
                        aria-pressed={primarySectorId === sector.id}
                        onClick={() => selectPrimarySector(sector.id)}
                      >
                        {sector.name}
                      </button>
                    ))}
                  </>
                )}
              </div>
              {primarySector && childSectors.length > 0 ? (
                <div className="theme-sub-sectors theme-sub-sectors-child" role="group" aria-label="子细分板块筛选">
                  <button
                    type="button"
                    className={`theme-sub-sector${!childSectorId ? ' active' : ''}`}
                    aria-pressed={!childSectorId}
                    onClick={() => selectChildSector(null)}
                  >
                    {ALL_SUB_SECTOR}
                  </button>
                  {childSectors.map((sector) => (
                    <button
                      key={sector.id}
                      type="button"
                      className={`theme-sub-sector${childSectorId === sector.id ? ' active' : ''}`}
                      aria-pressed={childSectorId === sector.id}
                      onClick={() => selectChildSector(sector.id)}
                    >
                      {sector.name}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        </div>
        <p className="theme-brief" id="themeBrief">
          <strong>逻辑概要：</strong>{data?.brief || '—'}
        </p>
        <div className="grid-wrap theme-grid-wrap">
          <table className="data-grid" style={{ minWidth: 1100 }}>
            <thead>
              <tr>
                <th className="col-sticky" rowSpan={2}>代码 / 名称</th>
                <th rowSpan={2}>细分板块</th>
                <th className="col-num" rowSpan={2}>最新价</th>
                <th className="col-num" rowSpan={2}>入池价</th>
                <th className="col-gain-group" colSpan={6}>累计涨幅</th>
                <th rowSpan={2}>池状态</th>
              </tr>
              <tr className="sub-head">
                <th className="col-num">当日</th><th className="col-num">2日</th><th className="col-num">3日</th>
                <th className="col-num">4日</th><th className="col-num">5日</th><th className="col-num">10日</th>
              </tr>
            </thead>
            <tbody id="themeTableBody">
              {tableLoading ? (
                <tr><td colSpan={11} style={{ padding: 24, color: 'var(--text-muted)' }}>加载中…</td></tr>
              ) : displayStocks.length === 0 ? (
                <tr><td colSpan={11} style={{ padding: 24, color: 'var(--text-muted)' }}>{filterNode ? '该细分板块暂无标的' : '暂无数据'}</td></tr>
              ) : (
                displayStocks.map((stock) => (
                  <tr key={stock.id} data-theme={theme}>
                    <td className="col-sticky"><StockIdentity stock={stock} /></td>
                    <td><span className="sub-sector">{stock.subSector}</span></td>
                    <td className="col-num"><PriceCell value={stock.price} changePercent={stock.changePercent} /></td>
                    <td className="col-num"><span className="entry-val mono">{fmtPrice(stock.entryPrice)}</span></td>
                    <GainColumns stock={stock} />
                    <td><PoolCapsule status={stock.poolStatus} label={stock.poolStatusLabel} /></td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="grid-footer" id="themeFooter">
          <span>
            {data?.label ?? ''}赛道 <strong>{displaySummary?.count ?? 0}</strong> 只 · 精选 <strong>{displaySummary?.selected ?? 0}</strong> 只
            {filterLabel ? ` · 筛选：${filterLabel}` : ''}
          </span>
          <span>数据来源于行业板块关联（含子板块）</span>
        </div>
      </main>
    </section>
  )
}
