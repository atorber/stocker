export function fmtPct(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—'
  const sign = value > 0 ? '+' : ''
  return `${sign}${value.toFixed(1)}%`
}

export function pctClass(value: number | null | undefined): string {
  if (value === null || value === undefined) return ''
  return value > 0 ? 'up' : value < 0 ? 'down' : ''
}

export function fmtPrice(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—'
  return value.toFixed(2)
}

export function gainFieldKey(sortLabel: string): keyof import('../types').StockItem {
  const map: Record<string, keyof import('../types').StockItem> = {
    当日: 'changePercent',
    '2日': 't2Chg',
    '3日': 't3Chg',
    '4日': 't4Chg',
    '5日': 't5Chg',
    '10日': 't10Chg',
  }
  return map[sortLabel] || 't3Chg'
}

export const SORT_API_MAP: Record<string, string> = {
  当日: 'change_percent',
  '2日': 't_2_chg',
  '3日': 't_3_chg',
  '4日': 't_4_chg',
  '5日': 't_5_chg',
  '10日': 't_10',
}

export const POOL_NAMES = ['每日备选池', '基础股票池', '精选股票池', '交易股票池'] as const
export const POOL_TYPES = ['daily', 'basic', 'selected', 'trading'] as const
