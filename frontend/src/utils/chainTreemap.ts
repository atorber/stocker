import type { EChartsOption } from 'echarts'
import type { ChainGraphData } from '../types'

export const CHART_INSET = 16

type SegmentTree = ChainGraphData['segments'][0] & { children?: SegmentTree[] }

const ROOT_COLOR = '#3d444d'
const NEUTRAL_STOCK = '#2a3038'
const LEVEL0 = ['#1f6feb', '#388bfd', '#0969da', '#0550ae', '#033d8b']
const LEVEL1 = ['#238636', '#2ea043', '#196c2e', '#116329', '#0e4429']
const LEVEL2 = ['#9e6a03', '#bf8700', '#d4a72c', '#7d4e00', '#633c01']
const UP_LIGHT = { r: 68, g: 44, b: 48 }
const UP_DEEP = { r: 210, g: 48, b: 62 }
const DOWN_LIGHT = { r: 44, g: 68, b: 56 }
const DOWN_DEEP = { r: 16, g: 178, b: 118 }

function lerp(a: number, b: number, t: number) {
  return Math.round(a + (b - a) * t)
}

function rgb(r: number, g: number, b: number) {
  return `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`
}

function displayCode(code: string) {
  return code.split('.')[0] || code
}

function stockLabel(stock: ChainGraphData['nodes'][0]) {
  const code = displayCode(stock.stock_code || '')
  const chg = stock.changePercent
  if (chg != null) {
    return `${stock.stock_name}\n${code}\n${chg >= 0 ? '+' : ''}${chg.toFixed(1)}%`
  }
  return `${stock.stock_name}\n${code}`
}

function maxAbsChg(nodes: ChainGraphData['nodes']) {
  let max = 0
  for (const node of nodes) {
    const chg = node.changePercent
    if (chg != null) max = Math.max(max, Math.abs(chg))
  }
  return max
}

/** 涨：红；跌：绿；幅度越大颜色越深 */
function stockChangeColor(chg: number | null | undefined, maxAbs: number) {
  if (chg == null) return NEUTRAL_STOCK
  if (chg === 0 || maxAbs <= 0) return NEUTRAL_STOCK

  const ratio = Math.min(Math.abs(chg) / maxAbs, 1)
  const mix = ratio ** 1.25
  const light = chg > 0 ? UP_LIGHT : DOWN_LIGHT
  const deep = chg > 0 ? UP_DEEP : DOWN_DEEP
  return rgb(
    lerp(light.r, deep.r, mix),
    lerp(light.g, deep.g, mix),
    lerp(light.b, deep.b, mix),
  )
}

function brightness(color: string) {
  const hex = color.replace('#', '')
  const r = parseInt(hex.slice(0, 2), 16)
  const g = parseInt(hex.slice(2, 4), 16)
  const b = parseInt(hex.slice(4, 6), 16)
  return (r * 299 + g * 587 + b * 114) / 1000
}

function contrastBorder(bg: string) {
  return brightness(bg) > 140 ? '#484f58' : '#8b949e'
}

function contrastText(bg: string) {
  return brightness(bg) > 180 ? '#0d1117' : '#e6edf3'
}

function adaptiveStockFontSize(stockCount: number) {
  if (stockCount <= 24) return 11
  if (stockCount <= 60) return 10
  if (stockCount <= 120) return 9
  return 8
}

function adaptiveUpperLabelHeight(stockCount: number) {
  if (stockCount <= 30) return 26
  if (stockCount <= 80) return 22
  return 18
}

function buildSegmentTree(segments: ChainGraphData['segments']) {
  const map = new Map<string, SegmentTree>()
  const roots: SegmentTree[] = []
  segments.forEach((seg) => map.set(seg.id, { ...seg, children: [] }))
  segments.forEach((seg) => {
    const node = map.get(seg.id)
    if (!node) return
    if (seg.parent_id) {
      map.get(seg.parent_id)?.children?.push(node)
    } else {
      roots.push(node)
    }
  })
  return roots
}

function segmentColors(depth: number) {
  if (depth === 0) return LEVEL0
  if (depth === 1) return LEVEL1
  return LEVEL2
}

function buildSegmentNode(
  graphData: ChainGraphData,
  seg: SegmentTree,
  depth: number,
  levelColorIndexes: Record<number, number>,
  maxAbs: number,
  stockFontSize: number,
) {
  const stocks = graphData.nodes.filter((n) => n.segment_id === seg.id)
  const children: Record<string, unknown>[] = []
  const levelColors = segmentColors(depth)

  if (levelColorIndexes[depth] === undefined) levelColorIndexes[depth] = 0
  const colorIndex = levelColorIndexes[depth] % levelColors.length
  const segmentColor = levelColors[colorIndex]
  levelColorIndexes[depth]++

  seg.children?.forEach((child) => {
    children.push(buildSegmentNode(graphData, child, depth + 1, levelColorIndexes, maxAbs, stockFontSize))
  })

  stocks.forEach((stock) => {
    const chg = stock.changePercent
    const stockColor = stockChangeColor(chg, maxAbs)
    const label = stockLabel(stock)
    children.push({
      name: label,
      value: 1,
      stockId: stock.id,
      stockName: stock.stock_name,
      itemStyle: {
        color: stockColor,
        borderColor: contrastBorder(stockColor),
        borderWidth: 1,
      },
      label: { color: contrastText(stockColor), fontSize: stockFontSize },
    })
  })

  const totalValue = children.reduce((sum, child) => sum + ((child.value as number) || 0), 0)

  return {
    name: seg.name,
    value: totalValue || 1,
    itemStyle: {
      color: segmentColor,
      borderColor: contrastBorder(segmentColor),
      borderWidth: depth === 0 ? 2 : 1,
    },
    label: { color: contrastText(segmentColor), fontWeight: 600 },
    upperLabel: {
      show: true,
      height: 28,
      color: '#e6edf3',
      fontSize: 12,
      fontWeight: 600,
    },
    children: children.length ? children : undefined,
  }
}

export function buildTreemapOption(graphData: ChainGraphData): EChartsOption {
  const rootSegments = buildSegmentTree(graphData.segments || [])
  const levelColorIndexes: Record<number, number> = {}
  const maxAbs = maxAbsChg(graphData.nodes)
  const stockCount = graphData.nodes.length
  const stockFontSize = adaptiveStockFontSize(stockCount)
  const upperLabelHeight = adaptiveUpperLabelHeight(stockCount)

  const children = rootSegments.length
    ? rootSegments.map((seg) => buildSegmentNode(graphData, seg, 0, levelColorIndexes, maxAbs, stockFontSize))
    : graphData.segments
        .filter((seg) => graphData.nodes.some((n) => n.segment_id === seg.id))
        .map((seg) => buildSegmentNode(graphData, { ...seg, children: [] }, 0, levelColorIndexes, maxAbs, stockFontSize))

  const data = {
    name: graphData.chain.name,
    value: graphData.nodes.length || 1,
    itemStyle: {
      color: ROOT_COLOR,
      borderColor: '#6e7681',
      borderWidth: 2,
    },
    label: { color: '#e6edf3', fontSize: 13, fontWeight: 700 },
    upperLabel: { show: true, height: 32, color: '#e6edf3', fontSize: 14, fontWeight: 700 },
    children,
  }

  return {
    backgroundColor: 'transparent',
    animation: false,
    tooltip: { show: false },
    series: [
      {
        name: '产业链结构',
        type: 'treemap',
        silent: true,
        roam: false,
        nodeClick: false,
        left: CHART_INSET,
        top: CHART_INSET,
        right: CHART_INSET,
        bottom: CHART_INSET,
        width: 'auto',
        height: 'auto',
        visibleMin: 0,
        emphasis: { disabled: true },
        breadcrumb: { show: false },
        label: {
          show: true,
          formatter: '{b}',
          overflow: 'truncate',
          lineHeight: Math.max(stockFontSize + 2, 12),
          fontSize: stockFontSize,
        },
        upperLabel: { show: true, height: upperLabelHeight },
        itemStyle: {
          borderColor: '#0d1117',
          borderWidth: 1,
          gapWidth: 2,
        },
        levels: [
          { itemStyle: { borderWidth: 0, gapWidth: 2 }, upperLabel: { show: false } },
          { itemStyle: { borderWidth: 2, gapWidth: 2 } },
          { itemStyle: { borderWidth: 1, gapWidth: 1 } },
        ],
        data: [data],
      },
    ],
  }
}
