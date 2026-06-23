import type {
  ChainDetail,
  ChainGraphData,
  ChainItem,
  DailyPoolGrid,
  IndustrySector,
  Meta,
  PoolType,
  RadarData,
  SectorStocksResponse,
  StockItem,
  ThemeData,
  ThemeKey,
} from '../types'
import { buildChainDetailFromGraph, parseIndustryChainGraph } from '../utils/industryChain'

async function get<T>(path: string): Promise<T> {
  const res = await fetch(path)
  if (!res.ok) throw new Error(`API ${path} failed: ${res.status}`)
  return res.json()
}

async function getIndustryChainData<T>(path: string): Promise<T> {
  const res = await get<{ code: number; message: string; data: T }>(path)
  return res.data
}

export const api = {
  meta: () => get<Meta>('/api/meta'),
  pool: (type: PoolType, search = '') =>
    get<{ items: StockItem[]; count: number }>(`/api/pools/${type}?search=${encodeURIComponent(search)}`),
  dailyPoolGrid: (date: string, search = '') =>
    get<DailyPoolGrid>(
      `/api/daily-stock-pool/stocks/by-date/${date}/grid?page=1&page_size=500&search=${encodeURIComponent(search)}`,
    ),
  dailyPoolDates: () => get<{ code: number; data: { dates: string[] } }>('/api/daily-stock-pool/dates'),
  sectors: (page = 1, pageSize = 10000) =>
    get<{
      code: number
      data: IndustrySector[]
      total: number
    }>(`/api/industry-sectors/sectors?page=${page}&page_size=${pageSize}`),
  sectorStocks: (sectorId: string, includeDescendants = true) =>
    get<{ code: number; data: SectorStocksResponse }>(
      `/api/industry-sectors/sectors/${sectorId}/stocks?include_descendants=${includeDescendants}`,
    ),
  theme: (key: ThemeKey) => get<ThemeData>(`/api/industry-sectors/theme/${key}`),
  themeSummaries: () => get<{ themes: Array<{ theme: string; label: string; sectorId?: string; count: number }> }>(
    '/api/industry-sectors/theme-summaries',
  ),
  industryChainList: (page = 1, pageSize = 100, keyword = '') =>
    get<{
      code: number
      message: string
      data: ChainItem[]
      total: number
      page: number
      page_size: number
      total_pages: number
    }>(
      `/api/industry-chain/list?page=${page}&page_size=${pageSize}${keyword ? `&keyword=${encodeURIComponent(keyword)}` : ''}`,
    ),
  /** xtrader 兼容：GET /api/industry-chain/{id}/graph-data */
  industryChainGraphData: (chainId: string) =>
    getIndustryChainData<ChainGraphData>(`/api/industry-chain/${chainId}/graph-data`),
  industryChainGraph: (chainId: string) =>
    get<{ code: number; message: string; data: ChainGraphData }>(`/api/industry-chain/${chainId}/graph-data`),
  industryChainView: async (chainId: string): Promise<ChainDetail> => {
    const graph = await getIndustryChainData<ChainGraphData>(`/api/industry-chain/${chainId}/graph-data`)
    return buildChainDetailFromGraph(graph)
  },
  industryChainDetail: (chainId: string) =>
    getIndustryChainData<ChainItem & { segments?: unknown[]; relationships?: unknown[] }>(
      `/api/industry-chain/${chainId}`,
    ),
  chains: () => get<{ chains: { id: string; name: string }[] }>('/api/industry/chains'),
  chain: async (id: string) => {
    const graph = parseIndustryChainGraph(
      await get<{ code: number; message: string; data: ChainGraphData }>(`/api/industry-chain/${id}/graph-data`),
    )
    return buildChainDetailFromGraph(graph)
  },
  radar: (sort: string, limit = 10) => get<RadarData>(`/api/radar?sort=${sort}&limit=${limit}`),
}
