import { useCallback, useEffect, useState } from 'react'
import { api } from './api/client'
import PoolModule from './components/PoolModule'
import ThemeModule from './components/ThemeModule'
import IndustryModule from './components/IndustryModule'
import RadarModule from './components/RadarModule'
import type { Meta, ModuleType } from './types'

const NAV: { key: ModuleType; label: string }[] = [
  { key: 'pool', label: '股票池' },
  { key: 'theme', label: '主题方向' },
  { key: 'industry', label: '产业链研判' },
  { key: 'radar', label: '动能排行' },
]

export default function App() {
  const [module, setModule] = useState<ModuleType>('pool')
  const [meta, setMeta] = useState<Meta | null>(null)
  const [toast, setToast] = useState('')

  useEffect(() => {
    api.meta().then(setMeta).catch(console.error)
  }, [])

  const showToast = useCallback((msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(''), 2200)
  }, [])

  useEffect(() => {
    const hideCtx = () => {}
    document.addEventListener('click', hideCtx)
    return () => document.removeEventListener('click', hideCtx)
  }, [])

  const headerDate = meta ? `${meta.date} · ${meta.marketStatus}` : '—'

  return (
    <div className="app">
      <header className="header">
        <div className="brand">
          <div className="brand-mark">S</div>
          Stocker
        </div>
        <nav className="global-nav">
          {NAV.map((item) => (
            <button
              key={item.key}
              type="button"
              className={module === item.key ? 'active' : ''}
              data-module={item.key}
              onClick={() => setModule(item.key)}
            >
              {item.label}
            </button>
          ))}
        </nav>
        <div className="header-meta mono">{headerDate}</div>
      </header>

      <PoolModule active={module === 'pool'} meta={meta} onToast={showToast} />
      <ThemeModule active={module === 'theme'} onToast={showToast} />
      <IndustryModule active={module === 'industry'} onToast={showToast} />
      <RadarModule active={module === 'radar'} onToast={showToast} />

      <div className={`toast${toast ? ' show' : ''}`} id="toast">{toast}</div>
      <div className="spec-badge"><strong>Stocker</strong> · v1.0</div>
    </div>
  )
}
