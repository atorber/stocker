import { useEffect, useState } from 'react'
import { api } from '../api/client'
import type { StockItem } from '../types'
import { SORT_API_MAP, pctClass } from '../utils/format'

const RADAR_COLUMNS = [
  { key: '1日', title: '1日排行', header: '1日累计涨幅', sort: SORT_API_MAP['当日'], field: 'changePercent' as const },
  { key: '2日', title: '2日排行', header: '2日累计涨幅', sort: SORT_API_MAP['2日'], field: 't2Chg' as const },
  { key: '3日', title: '3日排行', header: '3日累计涨幅', sort: SORT_API_MAP['3日'], field: 't3Chg' as const },
  { key: '4日', title: '4日排行', header: '4日累计涨幅', sort: SORT_API_MAP['4日'], field: 't4Chg' as const },
  { key: '5日', title: '5日排行', header: '5日累计涨幅', sort: SORT_API_MAP['5日'], field: 't5Chg' as const },
  { key: '10日', title: '10日排行', header: '10日累计涨幅', sort: SORT_API_MAP['10日'], field: 't10Chg' as const },
] as const

type ColumnKey = (typeof RADAR_COLUMNS)[number]['key']

interface ColumnData {
  key: ColumnKey
  title: string
  header: string
  stocks: StockItem[]
}

function fmtGain(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—'
  const sign = value > 0 ? '+' : ''
  return `${sign}${value.toFixed(2)}%`
}

function rankClass(rank: number): string {
  if (rank === 1) return ' top1'
  if (rank === 2) return ' top2'
  if (rank === 3) return ' top3'
  return ''
}

interface Props {
  active: boolean
  onToast: (msg: string) => void
}

export default function RadarModule({ active }: Props) {
  const [columns, setColumns] = useState<ColumnData[]>([])
  const [selectedCount, setSelectedCount] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [hoveredStockId, setHoveredStockId] = useState<string | null>(null)

  useEffect(() => {
    if (!active) return
    setLoading(true)
    Promise.all(RADAR_COLUMNS.map((col) => api.radar(col.sort, 10)))
      .then((results) => {
        setColumns(
          RADAR_COLUMNS.map((col, i) => ({
            key: col.key,
            title: col.title,
            header: col.header,
            stocks: results[i]?.stocks ?? [],
          })),
        )
        setSelectedCount(
          results[0]?.selectedCount ?? results[0]?.poolCount ?? results[0]?.basicCount ?? null,
        )
      })
      .catch(() => {
        setColumns([])
        setSelectedCount(null)
      })
      .finally(() => setLoading(false))
  }, [active])

  const tracking = Boolean(hoveredStockId)

  return (
    <section className={`module-panel radar-panel${active ? ' active' : ''}`} id="module-radar">
      <main className="main radar-main">
        <div className="page-head radar-page-head">
          <h1 className="page-title">多维动能排行</h1>
          <p className="page-desc">
            看长做短 · 顺势而为
            <span className="radar-scope-note">数据源严格限定于【精选股票池】内（{selectedCount ?? '—'} 只）</span>
          </p>
        </div>

        <div
          className={`radar-kanban-wrap${tracking ? ' is-tracking' : ''}`}
          onMouseLeave={() => setHoveredStockId(null)}
        >
          {loading ? (
            <div className="radar-loading">加载动能数据中…</div>
          ) : (
            <div className="radar-kanban">
              {columns.map((col) => {
                const colDef = RADAR_COLUMNS.find((c) => c.key === col.key)!
                return (
                  <div key={col.key} className="radar-column">
                    <div className="radar-column-head">
                      <span className="radar-column-title">{col.title}</span>
                      <span className="radar-column-sub">{col.header}</span>
                    </div>
                    <div className="radar-rows">
                      {col.stocks.map((stock, idx) => {
                        const rank = idx + 1
                        const gain = stock[colDef.field]
                        const isActive = tracking && stock.id === hoveredStockId
                        const isDimmed = tracking && !isActive
                        return (
                          <div
                            key={`${col.key}-${stock.id}`}
                            className={`radar-row${isActive ? ' radar-row-active' : ''}${isDimmed ? ' radar-row-dimmed' : ''}`}
                            onMouseEnter={() => setHoveredStockId(stock.id)}
                          >
                            <span className={`radar-row-rank mono${rankClass(rank)}`}>{rank}</span>
                            <div className="radar-row-body">
                              <div className="radar-row-name">{stock.name}</div>
                              {stock.subSector && stock.subSector !== '—' ? (
                                <div className="radar-row-sector">{stock.subSector}</div>
                              ) : null}
                            </div>
                            <span className={`radar-row-gain mono ${pctClass(gain)}`}>{fmtGain(gain)}</span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div className="grid-footer radar-footer">
          <span>6 列 Top 10 · 悬停跨列追踪动能共振</span>
          <span>精选池 {selectedCount ?? 0} 只</span>
        </div>
      </main>
    </section>
  )
}
