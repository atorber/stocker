import { useEffect, useMemo, useState } from 'react'
import { api } from '../api/client'
import type { IndustrySector, ThemeData, ThemeKey } from '../types'
import { fmtPct, fmtPrice } from '../utils/format'
import { GainColumns, PoolCapsule, PriceCell, StockIdentity } from './StockCells'

const THEME_TABS: { key: ThemeKey; label: string }[] = [
  { key: 'finance', label: '大金融' },
  { key: 'consumer', label: '消费' },
  { key: 'cycle', label: '周期' },
  { key: 'tech', label: '科技' },
]

interface Props {
  active: boolean
  onToast: (msg: string) => void
}

export default function ThemeModule({ active, onToast }: Props) {
  const [theme, setTheme] = useState<ThemeKey>('tech')
  const [data, setData] = useState<ThemeData | null>(null)
  const [sectors, setSectors] = useState<IndustrySector[]>([])
  const [loading, setLoading] = useState(false)

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

  const summary = data?.summary
  const gainCls = summary && (summary.avgT3Gain ?? 0) >= 0 ? 'up' : 'down'
  const dayGainCls = summary && (summary.avgChangePercent ?? 0) >= 0 ? 'up' : 'down'

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
          <div className="item"><span className="label">池内标的</span><span className="val mono">{summary?.count ?? '—'}</span></div>
          <div className="item"><span className="label">精选 / 交易</span><span className="val mono">{summary ? `${summary.selected} / ${summary.trading}` : '—'}</span></div>
          <div className="item">
            <span className="label">近3日均涨幅</span>
            <span className={`val mono ${gainCls}`}>{summary ? fmtPct(summary.avgT3Gain) : '—'}</span>
          </div>
          <div className="item">
            <span className="label">板块当日均涨幅</span>
            <span className={`val mono ${dayGainCls}`}>
              {summary?.avgChangePercent != null ? fmtPct(summary.avgChangePercent) : '—'}
            </span>
          </div>
          <div className="item"><span className="label">细分板块</span><span className="val" style={{ fontSize: 13, fontWeight: 500 }}>{summary?.sectors ?? '—'}</span></div>
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
                <th className="col-actions" rowSpan={2}></th>
              </tr>
              <tr className="sub-head">
                <th className="col-num">当日</th><th className="col-num">2日</th><th className="col-num">3日</th>
                <th className="col-num">4日</th><th className="col-num">5日</th><th className="col-num">10日</th>
              </tr>
            </thead>
            <tbody id="themeTableBody">
              {loading ? (
                <tr><td colSpan={12} style={{ padding: 24, color: 'var(--text-muted)' }}>加载中…</td></tr>
              ) : (data?.stocks ?? []).length === 0 ? (
                <tr><td colSpan={12} style={{ padding: 24, color: 'var(--text-muted)' }}>暂无数据</td></tr>
              ) : (
                (data?.stocks ?? []).map((stock) => (
                  <tr key={stock.id} data-theme={theme}>
                    <td className="col-sticky"><StockIdentity stock={stock} /></td>
                    <td><span className="sub-sector">{stock.subSector}</span></td>
                    <td className="col-num"><PriceCell value={stock.price} changePercent={stock.changePercent} /></td>
                    <td className="col-num"><span className="entry-val mono">{fmtPrice(stock.entryPrice)}</span></td>
                    <GainColumns stock={stock} />
                    <td><PoolCapsule status={stock.poolStatus} label={stock.poolStatusLabel} /></td>
                    <td className="col-actions">
                      <div className="row-actions">
                        <button className="action-icon promote" title="晋级" onClick={() => onToast(`晋级：${stock.name}`)}>
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 19V5M5 12l7-7 7 7" /></svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="grid-footer" id="themeFooter">
          <span>{data?.label ?? ''}赛道 <strong>{summary?.count ?? 0}</strong> 只 · 精选 <strong>{summary?.selected ?? 0}</strong> 只</span>
          <span>数据来源于行业板块关联（含子板块）</span>
        </div>
      </main>
    </section>
  )
}
