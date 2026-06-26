import { useState } from 'react'
import type { StockItem } from '../types'
import { fmtPrice } from '../utils/format'
import { GainCell, PoolCapsule, PriceCell, SectorTag, StockIdentity } from './StockCells'

interface Props {
  stocks: StockItem[]
  loading?: boolean
  emptyText?: string
  variant?: 'default' | 'trading'
}

const GAIN_FIELDS: { key: keyof StockItem; label: string }[] = [
  { key: 'changePercent', label: '当日' },
  { key: 't2Chg', label: '2日' },
  { key: 't3Chg', label: '3日' },
  { key: 't4Chg', label: '4日' },
  { key: 't5Chg', label: '5日' },
  { key: 't10Chg', label: '10日' },
]

export default function StockCardList({
  stocks,
  loading = false,
  emptyText = '暂无数据',
  variant = 'default',
}: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(null)

  if (loading) {
    return <div className="stock-card-list"><p className="stock-card-empty">加载中…</p></div>
  }

  if (stocks.length === 0) {
    return <div className="stock-card-list"><p className="stock-card-empty">{emptyText}</p></div>
  }

  return (
    <div className="stock-card-list">
      {stocks.map((stock) => {
        const expanded = expandedId === stock.id
        return (
          <article
            key={stock.id}
            className={`stock-card${expanded ? ' expanded' : ''}${stock.tpHit ? ' tp-hit' : ''}`}
          >
            <button
              type="button"
              className="stock-card-main"
              aria-expanded={expanded}
              onClick={() => setExpandedId(expanded ? null : stock.id)}
            >
              <div className="stock-card-head">
                <StockIdentity stock={stock} />
                <PoolCapsule status={stock.poolStatus} label={stock.poolStatusLabel} />
              </div>
              <div className="stock-card-metrics">
                <div className="stock-card-metric">
                  <span className="label">最新价</span>
                  <PriceCell value={stock.price} changePercent={stock.changePercent} />
                </div>
                <div className="stock-card-metric align-right">
                  <span className="label">当日</span>
                  <GainCell value={stock.changePercent} large />
                </div>
              </div>
              <div className="stock-card-tags">
                <SectorTag sector={stock.macroSector} label={stock.macroSectorLabel} />
                <span className="sub-sector">{stock.subSector}</span>
              </div>
            </button>
            {expanded ? (
              <div className="stock-card-detail">
                <div className="stock-card-detail-row">
                  <span>入池价</span>
                  <span className="mono">{fmtPrice(stock.entryPrice)}</span>
                </div>
                {variant === 'trading' ? (
                  <>
                    <div className="stock-card-detail-row">
                      <span>成本价</span>
                      <span className="mono">{fmtPrice(stock.costPrice ?? stock.entryPrice)}</span>
                    </div>
                    <div className="stock-card-detail-row">
                      <span>止盈偏离</span>
                      <span className="mono">
                        {stock.tpDeviationLevel
                          ? `+${stock.tpDeviation.toFixed(1)}%${stock.tpHit ? ' · 触及' : ''}`
                          : '—'}
                      </span>
                    </div>
                  </>
                ) : null}
                <div className="stock-card-gain-grid">
                  {GAIN_FIELDS.map(({ key, label }) => (
                    <div key={key} className="stock-card-gain-item">
                      <span className="label">{label}</span>
                      <GainCell value={stock[key] as number | null} />
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </article>
        )
      })}
    </div>
  )
}
