import { useEffect, useState } from 'react'
import { api } from '../api/client'
import type { RadarData } from '../types'
import { SORT_API_MAP, fmtPrice } from '../utils/format'
import {
  GainCell,
  PriceCell,
  SectorTag,
  StockIdentity,
  VolumeCell,
} from './StockCells'

const SORT_LABELS = ['当日', '2日', '3日', '4日', '5日', '10日'] as const

const SORT_FIELD_MAP: Record<string, keyof import('../types').StockItem> = {
  当日: 'changePercent',
  '2日': 't2Chg',
  '3日': 't3Chg',
  '4日': 't4Chg',
  '5日': 't5Chg',
  '10日': 't10Chg',
}

interface Props {
  active: boolean
  onToast: (msg: string) => void
}

export default function RadarModule({ active, onToast }: Props) {
  const [sortLabel, setSortLabel] = useState<string>('3日')
  const [data, setData] = useState<RadarData | null>(null)

  useEffect(() => {
    if (!active) return
    const field = SORT_API_MAP[sortLabel] || 't_3_chg'
    api.radar(field, 10).then(setData)
  }, [active, sortLabel])

  return (
    <section className={`module-panel${active ? ' active' : ''}`} id="module-radar">
      <main className="main">
        <div className="page-head">
          <h1 className="page-title">热门动能排行榜</h1>
          <p className="page-desc">
            看长做短 · 能力圈内短线强势股{' '}
            <span className="scope">— 数据源：基础股票池（{data?.basicCount ?? '—'} 只）</span>
          </p>
        </div>
        <div className="control-bar">
          <div className="view-badge">预设视图 · Top 10 截断</div>
          <div className="control-right">
            <span className="time-label">排序依据</span>
            <div className="time-pills" id="radarSortPills">
              {SORT_LABELS.map((label) => (
                <button
                  key={label}
                  className={`time-pill${sortLabel === label ? ' active' : ''}`}
                  onClick={() => {
                    setSortLabel(label)
                    onToast(`已按近${label}涨幅重新排序`)
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="grid-wrap">
          <table className="radar-grid">
            <thead>
              <tr>
                <th rowSpan={2}>排名</th>
                <th rowSpan={2}>代码 / 名称</th>
                <th rowSpan={2}>大方向</th>
                <th rowSpan={2}>细分板块</th>
                <th className="num" rowSpan={2}>最新价</th>
                <th className="num" rowSpan={2}>入池价</th>
                <th className="col-gain-group" colSpan={6}>累计涨幅</th>
                <th rowSpan={2}>量能</th>
                <th rowSpan={2} style={{ width: 180 }}></th>
              </tr>
              <tr className="sub-head" id="radarSubHead">
                {SORT_LABELS.map((label) => (
                  <th key={label} className={`num${sortLabel === label ? ' col-sort' : ''}`}>
                    {label}{sortLabel === label ? ' ↓' : ''}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(data?.stocks ?? []).map((stock, idx) => {
                const rank = idx + 1
                const rankCls = rank <= 3 ? ` top${rank}` : ''
                return (
                  <tr key={stock.id}>
                    <td><span className={`rank mono${rankCls}`}>{rank}</span></td>
                    <td><StockIdentity stock={stock} /></td>
                    <td><SectorTag sector={stock.macroSector} label={stock.macroSectorLabel} /></td>
                    <td><span className="sub-sector">{stock.subSector}</span></td>
                    <td className="num"><PriceCell value={stock.price} changePercent={stock.changePercent} /></td>
                    <td className="num"><span className="entry-val mono">{fmtPrice(stock.entryPrice)}</span></td>
                    {SORT_LABELS.map((label) => {
                      const key = SORT_FIELD_MAP[label]
                      const val = stock[key] as number | null
                      const isSort = label === sortLabel
                      return (
                        <td key={label} className={`num${isSort ? ' col-sort' : ''}`}>
                          {isSort ? (
                            <GainCell value={val} large rank={rank <= 3 ? (rank as 1 | 2 | 3) : undefined} />
                          ) : (
                            <GainCell value={val} />
                          )}
                        </td>
                      )
                    })}
                    <td><VolumeCell stock={stock} /></td>
                    <td>
                      <div className="row-actions">
                        <button className="act-btn" onClick={() => onToast(`已移入精选池：${stock.name}`)}>移入精选池</button>
                        <button className="act-btn primary" onClick={() => onToast(`准备交易：${stock.name}`)}>准备交易</button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <div className="grid-footer">
          <span>基础池 <strong>{data?.basicCount ?? 0}</strong> 只 · 按近{sortLabel}涨幅降序</span>
          <span>入池价记录进入基础池时刻收盘价</span>
        </div>
      </main>
    </section>
  )
}
