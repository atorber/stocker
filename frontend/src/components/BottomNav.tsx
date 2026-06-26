import type { ModuleType } from '../types'

const ITEMS: { key: ModuleType; label: string }[] = [
  { key: 'pool', label: '股票池' },
  { key: 'theme', label: '主题' },
  { key: 'industry', label: '产业链' },
  { key: 'radar', label: '动能' },
]

interface Props {
  module: ModuleType
  onNavigate: (module: ModuleType) => void
}

export default function BottomNav({ module, onNavigate }: Props) {
  return (
    <nav className="bottom-nav" aria-label="主导航">
      {ITEMS.map((item) => (
        <button
          key={item.key}
          type="button"
          className={`bottom-nav-item${module === item.key ? ' active' : ''}`}
          aria-current={module === item.key ? 'page' : undefined}
          onClick={() => onNavigate(item.key)}
        >
          {item.label}
        </button>
      ))}
    </nav>
  )
}
