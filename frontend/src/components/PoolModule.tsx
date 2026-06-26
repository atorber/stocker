import { useCallback, useEffect, useMemo, useState } from 'react'
import { api } from '../api/client'
import type { Meta, PoolType, StockItem } from '../types'
import { POOL_NAMES, POOL_TYPES } from '../utils/format'
import { parsePoolTab, patchUrlParams, usePopstate } from '../utils/urlParams'
import {
  GainColumns,
  GridHead,
  PoolCapsule,
  PriceCell,
  SectorTag,
  StockIdentity,
} from './StockCells'
import { fmtPrice } from '../utils/format'
import { useMediaQuery } from '../hooks/useMediaQuery'
import StockCardList from './StockCardList'

interface Props {
  active: boolean
  meta: Meta | null
}

export default function PoolModule({ active, meta }: Props) {
  const poolIndexFromUrl = () => {
    const idx = POOL_TYPES.indexOf(parsePoolTab())
    return idx >= 0 ? idx : 0
  }
  const [poolIndex, setPoolIndex] = useState(poolIndexFromUrl)
  const [search, setSearch] = useState('')
  const [items, setItems] = useState<StockItem[]>([])
  const [loading, setLoading] = useState(true)
  const [dailyDate, setDailyDate] = useState('')
  const [dailyReportCount, setDailyReportCount] = useState(0)
  const [dailyCount, setDailyCount] = useState<number | null>(null)

  const poolType = POOL_TYPES[poolIndex]
  const isTrading = poolIndex === 3
  const isDaily = poolIndex === 0
  const isCardView = useMediaQuery('(max-width: 639px)')

  const availableDates = useMemo(
    () => meta?.dailyAvailableDates ?? [],
    [meta?.dailyAvailableDates],
  )

  useEffect(() => {
    if (meta?.date && !dailyDate) setDailyDate(meta.date)
  }, [meta?.date, dailyDate])

  const syncPoolFromUrl = useCallback(() => {
    if (active) setPoolIndex(poolIndexFromUrl())
  }, [active])
  usePopstate(syncPoolFromUrl)

  useEffect(() => {
    if (active) setPoolIndex(poolIndexFromUrl())
  }, [active])

  const selectPoolTab = (index: number) => {
    setPoolIndex(index)
    patchUrlParams({ pool: POOL_TYPES[index] })
  }

  const load = useCallback(async () => {
    setLoading(true)
    try {
      if (isDaily) {
        const date = dailyDate || meta?.date || new Date().toISOString().slice(0, 10)
        const data = await api.dailyPoolGrid(date, search)
        setItems(data.items)
        setDailyReportCount(data.reportCount)
        setDailyCount(data.count)
      } else {
        const data = await api.pool(poolType as PoolType, search)
        setItems(data.items)
      }
    } finally {
      setLoading(false)
    }
  }, [isDaily, dailyDate, meta?.date, poolType, search])

  useEffect(() => {
    if (!active) return
    const t = setTimeout(load, search ? 300 : 0)
    return () => clearTimeout(t)
  }, [active, load, search])

  const counts = meta?.poolCounts
  const tabCounts = counts
    ? POOL_TYPES.map((t, i) => (i === 0 && dailyCount !== null ? dailyCount : counts[t]))
    : null

  const dateIdx = availableDates.indexOf(dailyDate)
  const canPrev = dateIdx >= 0 && dateIdx < availableDates.length - 1
  const canNext = dateIdx > 0

  const pageDesc = isDaily
    ? `选赛道 · 做减法 · 看长做短 — 每日备选 · ${dailyDate || '—'} · ${dailyReportCount} 份研报`
    : `选赛道 · 做减法 · 看长做短 — 当前视图：${POOL_NAMES[poolIndex]}`

  return (
    <section className={`module-panel${active ? ' active' : ''}`} id="module-pool">
      <main className="main">
        <div className="page-head">
          <h1 className="page-title">股票池全局数据表</h1>
          <p className="page-desc" id="poolPageDesc">{pageDesc}</p>
        </div>

        <div className="control-bar">
          <div className="pool-tabs" role="tablist">
            {POOL_NAMES.map((name, i) => (
              <button
                key={name}
                className={`pool-tab${poolIndex === i ? ' active' : ''}`}
                role="tab"
                aria-selected={poolIndex === i}
                onClick={() => selectPoolTab(i)}
              >
                {name}
                <span className="count">{tabCounts ? tabCounts[i] : '—'}</span>
              </button>
            ))}
          </div>
          <div className="control-right">
            {isDaily && (
              <div className="date-control">
                <button
                  type="button"
                  className="date-nav-btn"
                  title="上一交易日"
                  disabled={!canPrev}
                  onClick={() => canPrev && setDailyDate(availableDates[dateIdx + 1])}
                >
                  ‹
                </button>
                <div className="date-input-wrap">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="4" width="18" height="18" rx="2" />
                    <path d="M16 2v4M8 2v4M3 10h18" />
                  </svg>
                  <input
                    type="date"
                    value={dailyDate}
                    max={meta?.date}
                    onChange={(e) => setDailyDate(e.target.value)}
                  />
                </div>
                <button
                  type="button"
                  className="date-nav-btn"
                  title="下一交易日"
                  disabled={!canNext}
                  onClick={() => canNext && setDailyDate(availableDates[dateIdx - 1])}
                >
                  ›
                </button>
                <button
                  type="button"
                  className="time-pill"
                  onClick={() => meta?.date && setDailyDate(meta.date)}
                >
                  今日
                </button>
              </div>
            )}
            <div className="search-box">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.35-4.35" />
              </svg>
              <input
                type="text"
                placeholder="筛选代码或名称"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
        </div>

        {isCardView ? (
          <>
            <StockCardList
              stocks={items}
              loading={loading}
              emptyText="暂无数据"
              variant={isTrading ? 'trading' : 'default'}
            />
            <div className="grid-footer">
              <span>
                {isDaily ? (
                  <>共 <strong>{items.length}</strong> 只标的 · <strong>{dailyReportCount}</strong> 份研报</>
                ) : (
                  <>共 <strong>{items.length}</strong> 只标的</>
                )}
              </span>
            </div>
          </>
        ) : (
          <>
        <div className={`grid-wrap pool-grid-default desktop-data-view${isTrading ? ' hidden' : ''}`} id="poolGridDefault">
          <table className="data-grid">
            <GridHead />
            <tbody>
              {loading ? (
                <tr><td colSpan={12} style={{ padding: 24, color: 'var(--text-muted)' }}>加载中…</td></tr>
              ) : items.length === 0 ? (
                <tr><td colSpan={12} style={{ padding: 24, color: 'var(--text-muted)' }}>暂无数据</td></tr>
              ) : (
                items.map((stock) => (
                  <tr key={stock.id}>
                    <td className="col-sticky"><StockIdentity stock={stock} /></td>
                    <td><SectorTag sector={stock.macroSector} label={stock.macroSectorLabel} /></td>
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
          <div className="grid-footer">
            <span>
              {isDaily ? (
                <>共 <strong>{items.length}</strong> 只标的 · <strong>{dailyReportCount}</strong> 份研报 · 数据来源于研报提取</>
              ) : (
                <>共 <strong>{items.length}</strong> 只标的 · 入池价记录晋级时刻收盘价</>
              )}
            </span>
            <span>{isDaily ? '按研报提及次数排序 · 红涨绿跌' : '红涨绿跌 · 数字等宽对齐 · 横向滚动查看更多列'}</span>
          </div>
        </div>

        <div className={`grid-wrap pool-grid-trading desktop-data-view${isTrading ? ' visible' : ''}`} id="poolGridTrading">
          <table className="data-grid" style={{ minWidth: 1400 }}>
            <GridHead trading />
            <tbody>
              {loading ? (
                <tr><td colSpan={14} style={{ padding: 24, color: 'var(--text-muted)' }}>加载中…</td></tr>
              ) : (
                items.map((stock) => (
                  <tr key={stock.id} className={stock.tpHit ? 'tp-hit' : ''}>
                    <td className="col-sticky"><StockIdentity stock={stock} /></td>
                    <td><SectorTag sector={stock.macroSector} label={stock.macroSectorLabel} /></td>
                    <td><span className="sub-sector">{stock.subSector}</span></td>
                    <td className="col-num"><PriceCell value={stock.price} changePercent={stock.changePercent} /></td>
                    <td className="col-num"><span className="entry-val mono">{fmtPrice(stock.entryPrice)}</span></td>
                    <td className="col-num"><span className="price-val mono">{fmtPrice(stock.costPrice ?? stock.entryPrice)}</span></td>
                    <GainColumns stock={stock} />
                    <td className="col-num">
                      {stock.tpDeviationLevel ? (
                        <>
                          <span className={`tp-dev ${stock.tpDeviationLevel} mono`}>
                            +{stock.tpDeviation.toFixed(1)}%
                          </span>
                          {stock.tpHit && <span className="tp-indicator">触及</span>}
                        </>
                      ) : (
                        <span className="mono" style={{ color: 'var(--text-muted)' }}>—</span>
                      )}
                    </td>
                    <td><PoolCapsule status={stock.poolStatus} label={stock.poolStatusLabel} /></td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          <div className="grid-footer">
            <span>共 <strong>{items.length}</strong> 只标的 · 触及止盈行呼吸高亮</span>
            <span>成本价为实际买入价</span>
          </div>
        </div>
          </>
        )}
      </main>
    </section>
  )
}
