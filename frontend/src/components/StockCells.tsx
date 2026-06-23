import { fmtPct, fmtPrice, pctClass } from '../utils/format'
import type { StockItem } from '../types'

const ICON_PROMOTE = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M12 19V5M5 12l7-7 7 7" />
  </svg>
)
const ICON_DEMOTE = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M12 5v14M5 12l7 7 7-7" />
  </svg>
)
const ICON_REMOVE = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" />
  </svg>
)
const ICON_SETTINGS = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="3" />
  </svg>
)

export function StockIdentity({ stock }: { stock: StockItem }) {
  return (
    <div className="stock-id">
      <span className="stock-name">{stock.name}</span>
      <span className="stock-code">{stock.code}</span>
    </div>
  )
}

export function SectorTag({ sector, label }: { sector: string; label: string }) {
  return <span className={`sector-tag ${sector}`}>{label}</span>
}

export function GainCell({
  value,
  large,
  rank,
}: {
  value: number | null
  large?: boolean
  rank?: 1 | 2 | 3
}) {
  const cls = pctClass(value)
  const rankCls = rank ? ` top${rank}` : ''
  const Tag = large ? 'span' : 'span'
  const className = large
    ? `gain-sort mono ${cls}${rankCls}`
    : value !== null && Math.abs(value) >= 5 && !large
      ? `gain-val mono ${cls}`
      : `gain-compact mono ${cls}`
  return (
    <Tag className={className}>
      {value === null ? '—' : fmtPct(value)}
    </Tag>
  )
}

export function PoolCapsule({ status, label }: { status: string; label: string }) {
  const extra =
    status === 'basic' || status === 'daily'
      ? ' basic'
      : status === 'trading'
        ? ' trading'
        : ''
  return <span className={`pool-capsule${extra}`}>{label}</span>
}

export function PriceCell({
  value,
  changePercent,
}: {
  value: number | null
  changePercent?: number | null
}) {
  const cls = pctClass(changePercent)
  return <span className={`price-val mono ${cls}`}>{fmtPrice(value)}</span>
}

export function RowActions({
  trading = false,
  onToast,
  stock,
}: {
  trading?: boolean
  onToast: (msg: string) => void
  stock: StockItem
}) {
  if (trading) {
    return (
      <div className="row-actions">
        <button className="action-icon demote" title="降级" onClick={() => onToast(`降级：${stock.name}`)}>
          {ICON_DEMOTE}
        </button>
        <button className="action-icon settings" title="交易设置" onClick={() => onToast(`交易设置：${stock.name}`)}>
          {ICON_SETTINGS}
        </button>
      </div>
    )
  }
  return (
    <div className="row-actions">
      <button className="action-icon promote" title="晋级至交易池" onClick={() => onToast(`晋级：${stock.name}`)}>
        {ICON_PROMOTE}
      </button>
      <button className="action-icon demote" title="降级至基础池" onClick={() => onToast(`降级：${stock.name}`)}>
        {ICON_DEMOTE}
      </button>
      <button className="action-icon remove" title="剔除" onClick={() => onToast(`剔除：${stock.name}`)}>
        {ICON_REMOVE}
      </button>
      <button className="action-icon settings" title="交易设置" onClick={() => onToast(`交易设置：${stock.name}`)}>
        {ICON_SETTINGS}
      </button>
    </div>
  )
}

export function GainColumns({ stock }: { stock: StockItem }) {
  return (
    <>
      <td className="col-num"><GainCell value={stock.changePercent} /></td>
      <td className="col-num"><GainCell value={stock.t2Chg} /></td>
      <td className="col-num"><GainCell value={stock.t3Chg} /></td>
      <td className="col-num"><GainCell value={stock.t4Chg} /></td>
      <td className="col-num"><GainCell value={stock.t5Chg} /></td>
      <td className="col-num"><GainCell value={stock.t10Chg} /></td>
    </>
  )
}

export function VolumeCell({ stock }: { stock: StockItem }) {
  const shrink = stock.volumeLabel === '缩量'
  return (
    <div className="volume-cell">
      <span className="vol-label">{stock.volumeLabel}</span>
      <div className={`mini-bars${shrink ? ' shrink' : ''}`}>
        {stock.volumeBars.map((h, i) => (
          <span key={i} className={h >= 50 ? 'on' : ''} style={{ height: `${h}%` }} />
        ))}
      </div>
    </div>
  )
}

export function GridHead({ trading = false }: { trading?: boolean }) {
  return (
    <thead>
      <tr>
        <th className="col-sticky" rowSpan={2} style={{ width: 130 }}>代码 / 名称</th>
        <th rowSpan={2} style={{ width: 72 }}>大方向</th>
        <th rowSpan={2} style={{ width: 100 }}>细分板块</th>
        <th className="col-num" rowSpan={2} style={{ width: 72 }}>最新价</th>
        <th className="col-num" rowSpan={2} style={{ width: 72 }}>入池价</th>
        {trading && <th className="col-num" rowSpan={2}>成本价</th>}
        <th className="col-gain-group" colSpan={6}>累计涨幅</th>
        {trading && <th className="col-num" rowSpan={2}>止盈偏离</th>}
        <th rowSpan={2} style={{ width: 64 }}>池状态</th>
        <th className="col-actions" rowSpan={2}></th>
      </tr>
      <tr className="sub-head">
        <th className="col-num">当日</th>
        <th className="col-num">2日</th>
        <th className="col-num">3日</th>
        <th className="col-num">4日</th>
        <th className="col-num">5日</th>
        <th className="col-num">10日</th>
      </tr>
    </thead>
  )
}
