export interface StockItem {
  id: string
  code: string
  codeFull: string
  name: string
  macroSector: 'finance' | 'consumer' | 'cycle' | 'tech'
  macroSectorLabel: string
  subSector: string
  price: number
  entryPrice: number
  costPrice: number | null
  changePercent: number | null
  t2Chg: number | null
  t3Chg: number | null
  t4Chg: number | null
  t5Chg: number | null
  t10Chg: number | null
  poolStatus: 'daily' | 'basic' | 'selected' | 'trading'
  poolStatusLabel: string
  tpDeviation: number
  tpDeviationLevel: '' | 'near' | 'hit'
  tpHit: boolean
  volumeLabel: string
  volumeBars: number[]
  inPool: boolean
}

export interface Meta {
  date: string
  marketStatus: string
  poolCounts: Record<'daily' | 'basic' | 'selected' | 'trading', number>
  basicPoolCount: number
  dailyAvailableDates?: string[]
}

export interface DailyPoolGrid {
  date: string
  reportCount: number
  count: number
  items: StockItem[]
  page: number
  pageSize: number
  totalPages: number
}

export interface ThemeData {
  theme: string
  label: string
  sectorId?: string
  stocks: StockItem[]
  summary: {
    count: number
    selected: number
    trading: number
    avgT3Gain: number
    avgChangePercent?: number
    sectors: string
  }
  brief: string
  sector?: IndustrySector | null
}

export interface IndustrySector {
  id: string
  name: string
  parentId?: string | null
  parentName?: string | null
  description: string
  color: string
  stockCount: number
  avgChangePercent: number
  sortOrder: number
  createTime?: string | null
  updateTime?: string | null
}

export interface IndustrySectorTreeNode extends IndustrySector {
  children?: IndustrySectorTreeNode[]
}

export interface SectorStocksResponse {
  sector: IndustrySector
  stocks: Array<{
    id: string
    code: string
    name: string
    price: number
    changePercent: number | null
    isInBasic?: boolean
  }>
  items: StockItem[]
}

export interface ChainItem {
  id: string
  name: string
  description?: string | null
  industry_category?: string | null
  category?: string | null
  created_at?: string
  updated_at?: string
}

export interface ChainGraphNode {
  id: string
  segment_id: string
  stock_id?: string | null
  stock_code: string
  stock_name: string
  company_name?: string | null
  description?: string | null
  position_x?: number | null
  position_y?: number | null
  created_at?: string | null
  updated_at?: string | null
  segment_name?: string
  /** stocker 扩展：股票池状态与行情 */
  segment_type?: string | null
  segment_order?: number
  isInBasic?: boolean
  isInSelected?: boolean
  isInTrading?: boolean
  t3Chg?: number | null
  changePercent?: number
}

export interface ChainGraphData {
  chain: ChainItem
  segments: Array<{
    id: string
    chain_id: string
    parent_id?: string | null
    name: string
    order_index: number
    description?: string | null
    segment_type?: string | null
    created_at?: string | null
    updated_at?: string | null
  }>
  nodes: ChainGraphNode[]
  relationships: unknown[]
}

export interface ChainNode {
  id: string
  code: string
  codeFull: string
  name: string
  segment: string
  segmentType: string | null
  tracked: boolean
  t3Chg: number | null
  x: number
  y: number
  width: number
  height: number
  layer: string
  layerLabel: string
}

export interface ChainDetail {
  id: string
  name: string
  phase: string
  sectorKey: string
  sectorLabel: string
  title: string
  description: string
  drivers: string[]
  coverage: {
    poolTotal: number
    poolCovered: number
    selected: number
    avgChangePercent: number
  }
  nodes: ChainNode[]
  edges: { from: string; to: string }[]
  layerLabels: string[]
  graph?: ChainGraphData
}

export interface RadarData {
  sortField: string
  sortLabel: string
  selectedCount: number
  poolCount: number
  basicCount: number
  stocks: StockItem[]
}

export type PoolType = 'daily' | 'basic' | 'selected' | 'trading'
export type ModuleType = 'pool' | 'theme' | 'industry' | 'radar'
export type ThemeKey = 'finance' | 'consumer' | 'cycle' | 'tech'
