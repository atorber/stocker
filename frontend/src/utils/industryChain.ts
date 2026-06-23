import type { ChainDetail, ChainGraphData, ChainGraphNode, ChainNode, ChainItem } from '../types'

const LAYER_TYPE_ORDER = ['upstream', 'midstream', 'downstream', 'application'] as const
const LAYER_TYPE_LABELS: Record<string, string> = {
  upstream: '上游',
  midstream: '中游',
  downstream: '下游',
  application: '应用',
}

const DRIVER_DEFAULTS = [
  '产业政策持续加码',
  '下游需求保持韧性',
  '龙头公司业绩兑现',
  '估值处于合理区间',
]

const CATEGORY_SECTOR: Record<string, [string, string]> = {
  人工智能: ['tech', '科技'],
  半导体: ['tech', '科技'],
  商业航天: ['tech', '科技'],
  电力设备: ['cycle', '周期'],
}

function displayCode(code: string) {
  const base = code.split('.')[0]
  return base || code
}

function sectorClass(category?: string | null): [string, string] {
  if (!category) return ['tech', '科技']
  for (const [token, pair] of Object.entries(CATEGORY_SECTOR)) {
    if (category.includes(token)) return pair
  }
  return ['tech', category]
}

function layoutTopology(graph: ChainGraphData) {
  const { segments, nodes } = graph
  if (!nodes.length) {
    return { nodes: [] as ChainNode[], edges: [] as { from: string; to: string }[], layerLabels: [] as string[] }
  }

  const segmentById = Object.fromEntries(segments.map((s) => [s.id, s]))
  const namedSegments = [...segments].sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0))

  const typedSegments: Record<string, typeof segments> = Object.fromEntries(
    LAYER_TYPE_ORDER.map((t) => [t, [] as typeof segments]),
  )
  for (const seg of namedSegments) {
    const segType = seg.segment_type
    if (segType && typedSegments[segType]) typedSegments[segType].push(seg)
  }

  const useTypeLayout = LAYER_TYPE_ORDER.some((t) => typedSegments[t].length > 0)
  const columns: Array<{ key: string; label: string; colNodes: ChainGraphNode[] }> = []

  if (useTypeLayout) {
    for (const layer of LAYER_TYPE_ORDER) {
      for (const seg of typedSegments[layer]) {
        const colNodes = nodes.filter((n) => n.segment_id === seg.id)
        if (colNodes.length) columns.push({ key: layer, label: LAYER_TYPE_LABELS[layer], colNodes })
      }
    }
  } else {
    for (const seg of namedSegments) {
      const colNodes = nodes.filter((n) => n.segment_id === seg.id)
      if (colNodes.length) columns.push({ key: seg.id, label: seg.name, colNodes })
    }
  }

  if (!columns.length) columns.push({ key: 'all', label: '标的', colNodes: nodes })

  const colWidth = 180
  const startX = 50
  const startY = 72
  const rowGap = 120
  const laidOut: ChainNode[] = []
  const edges: { from: string; to: string }[] = []
  const layerLabels: string[] = []
  let prevColIds: string[] = []

  columns.slice(0, 4).forEach((column, colIdx) => {
    layerLabels.push(column.label)
    const xCenter = startX + colIdx * colWidth + 50
    const currentIds: string[] = []

    column.colNodes.slice(0, 6).forEach((node, rowIdx) => {
      const px = node.position_x
      const py = node.position_y
      const x = px != null ? Number(px) : xCenter - 50
      const y = py != null ? Number(py) : startY + rowIdx * rowGap
      const tracked = Boolean(node.isInBasic || node.isInSelected || node.isInTrading)
      const seg = segmentById[node.segment_id]

      laidOut.push({
        id: node.id,
        code: displayCode(node.stock_code || ''),
        codeFull: node.stock_code || '',
        name: node.stock_name || '—',
        segment: node.segment_name || seg?.name || '—',
        segmentType: node.segment_type || column.key,
        tracked,
        t3Chg: node.t3Chg ?? null,
        x,
        y,
        width: 100,
        height: 56,
        layer: column.key,
        layerLabel: column.label,
      })
      currentIds.push(node.id)
      if (prevColIds.length && rowIdx < prevColIds.length) {
        edges.push({ from: prevColIds[rowIdx], to: node.id })
      }
    })
    prevColIds = currentIds
  })

  if (!edges.length && laidOut.length > 1) {
    for (let i = 0; i < laidOut.length - 1; i++) {
      edges.push({ from: laidOut[i].id, to: laidOut[i + 1].id })
    }
  }

  return { nodes: laidOut, edges, layerLabels }
}

/** 解析 xtrader 兼容的 graph-data 响应 */
export function parseIndustryChainGraph(res: { code: number; message?: string; data: ChainGraphData }): ChainGraphData {
  return res.data
}

/** 将 graph-data 转为产业链图谱页面视图（布局在客户端计算） */
export function buildChainDetailFromGraph(graph: ChainGraphData): ChainDetail {
  const chain = graph.chain
  const { nodes: laidOut, edges, layerLabels } = layoutTopology(graph)

  const poolNodes = laidOut.filter((n) => n.tracked)
  const selected = graph.nodes.filter((n) => n.isInSelected || n.isInTrading).length
  const gains = poolNodes.map((n) => n.t3Chg).filter((v): v is number => v != null)
  const avgGain = gains.length ? Math.round((gains.reduce((a, b) => a + b, 0) / gains.length) * 10) / 10 : 0

  const [sectorKey, sectorLabel] = sectorClass(chain.industry_category)
  const description =
    chain.description || `${chain.name}产业链持续受到市场关注，各环节龙头具备配置价值。`
  const title = description.split('。')[0] || chain.name
  let drivers = DRIVER_DEFAULTS
  if (description.includes('。')) {
    const parts = description
      .replace(/；/g, '。')
      .split('。')
      .map((p) => p.trim())
      .filter((p) => p.length > 4)
    if (parts.length >= 2) drivers = parts.slice(0, 4)
  }

  let phase = '景气期'
  if (avgGain >= 8) phase = '爆发期'
  else if (avgGain >= 3) phase = '景气期'
  else if (avgGain < 0) phase = '调整期'

  return {
    id: chain.id,
    name: chain.name,
    phase,
    sectorKey,
    sectorLabel,
    title: title.slice(0, 80),
    description,
    drivers,
    coverage: {
      poolTotal: laidOut.length,
      poolCovered: poolNodes.length,
      selected,
      avgT3Gain: avgGain,
    },
    nodes: laidOut,
    edges,
    layerLabels: layerLabels.length ? layerLabels : ['环节一', '环节二', '环节三', '环节四'],
    graph,
  }
}

export function chainListItems(data: ChainItem[]) {
  return data.map((c) => ({ id: c.id, name: c.name }))
}
