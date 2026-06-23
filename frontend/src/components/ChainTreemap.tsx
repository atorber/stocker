import { useEffect, useRef } from 'react'
import * as echarts from 'echarts'
import type { ChainGraphData } from '../types'
import { buildTreemapOption } from '../utils/chainTreemap'

interface Props {
  graphData: ChainGraphData
}

export default function ChainTreemap({ graphData }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const wrap = wrapRef.current
    const el = chartRef.current
    if (!wrap || !el) return

    const chart = echarts.init(el, undefined, { renderer: 'canvas' })

    const syncSize = () => {
      const width = wrap.clientWidth
      const height = wrap.clientHeight
      if (width > 0 && height > 0) chart.resize({ width, height })
    }

    chart.setOption(buildTreemapOption(graphData), true)
    syncSize()

    const observer = new ResizeObserver(syncSize)
    observer.observe(wrap)
    window.addEventListener('resize', syncSize)

    return () => {
      observer.disconnect()
      window.removeEventListener('resize', syncSize)
      chart.dispose()
    }
  }, [graphData])

  return (
    <div ref={wrapRef} className="chain-treemap-wrap">
      <div ref={chartRef} className="chain-treemap" />
    </div>
  )
}
