import { useEffect, useMemo, useState } from 'react'
import { api } from '../api/client'
import type { IndustrySector, ThemeData, ThemeKey } from '../types'
import { fmtPct, fmtPrice } from '../utils/format'
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
  const [theme, setTheme] = useState<ThemeKey>('tech')
  const [data, setData] = useState<ThemeData | null>(null)
  const [sectors, setSectors] = useState<IndustrySector[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedSubSector, setSelectedSubSector] = useState<string | null>(null)

  const sectorMap = useMemo(() => {
    const map: Record<string, IndustrySector> = {}
    sectors.forEach((s) => {
      if (!s.parentId && THEME_TABS.some((t) => t.label === s.name)) {
        const key = THEME_TABS.find((t) => t.label === s.name)?.key
        if (key) map[key] = s
      }
    })
    return map
  }, [sectors])

  useEffect(() => {
    if (!active) return
    api.sectors(1, 10000).then((res) => {
      setSectors(res.data ?? [])
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
          const childNames = sectors
            .filter((s) => s.parentId === sector.id)
            .map((s) => s.name)
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
  }, [active, theme, sectorMap, sectors])

  useEffect(() => {
    setSelectedSubSector(null)
  }, [theme])

  const childSectors = useMemo(() => {
    const parent = sectorMap[theme]
    const fromApi = parent
      ? sectors
          .filter((s) => s.parentId === parent.id)
          .sort((a, b) => a.sortOrder - b.sortOrder)
          .map((s) => s.name)
      : []
    if (fromApi.length) return fromApi
    return [...new Set((data?.stocks ?? []).map((s) => s.subSector).filter((s) => s && s !== '—'))].sort()
  }, [sectors, sectorMap, theme, data?.stocks])

  const filteredStocks = useMemo(() => {
    const stocks = data?.stocks ?? []
    if (!selectedSubSector) return stocks
    return stocks.filter(
      (stock) =>
        stock.subSector === selectedSubSector ||
        stock.subSector.split(' · ').includes(selectedSubSector),
    )
  }, [data?.stocks, selectedSubSector])

  const summary = data?.summary

  const filteredSummary = useMemo(() => {
    if (!selectedSubSector || !summary) return summary
    const selected = filteredStocks.filter((s) => s.poolStatus === 'selected').length
    const trading = filteredStocks.filter((s) => s.poolStatus === 'trading').length
    const gains = filteredStocks.map((s) => s.t3Chg).filter((v): v is number => v != null)
    const avgT3 = gains.length ? Math.round((gains.reduce((a, b) => a + b, 0) / gains.length) * 10) / 10 : 0
    return {
      ...summary,
      count: filteredStocks.length,
      selected,
      trading,
      avgT3Gain: avgT3,
    }
  }, [summary, selectedSubSector, filteredStocks])

  const displaySummary = selectedSubSector ? filteredSummary : summary
  const gainCls = displaySummary && (displaySummary.avgT3Gain ?? 0) >= 0 ? 'up' : 'down'
  const dayGainCls = displaySummary && (displaySummary.avgChangePercent ?? 0) >= 0 ? 'up' : 'down'

  const toggleSubSector = (name: string) => {
    setSelectedSubSector((prev) => (prev === name ? null : name))
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
            <div className="theme-sub-sectors" role="group" aria-label="细分板块筛选">
              {childSectors.length === 0 ? (
                <span className="val" style={{ fontSize: 13, fontWeight: 500 }}>—</span>
              ) : (
                childSectors.map((name) => (
                  <button
                    key={name}
                    type="button"
                    className={`theme-sub-sector${selectedSubSector === name ? ' active' : ''}`}
                    aria-pressed={selectedSubSector === name}
                    onClick={() => toggleSubSector(name)}
                  >
                    {name}
                  </button>
                ))
              )}
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
              {loading ? (
                <tr><td colSpan={11} style={{ padding: 24, color: 'var(--text-muted)' }}>加载中…</td></tr>
              ) : filteredStocks.length === 0 ? (
                <tr><td colSpan={11} style={{ padding: 24, color: 'var(--text-muted)' }}>{selectedSubSector ? '该细分板块暂无标的' : '暂无数据'}</td></tr>
              ) : (
                filteredStocks.map((stock) => (
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
            {selectedSubSector ? ` · 筛选：${selectedSubSector}` : ''}
          </span>
          <span>数据来源于行业板块关联（含子板块）</span>
        </div>
      </main>
    </section>
  )
}
