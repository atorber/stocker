import { useEffect } from 'react'
import type { ModuleType, PoolType, ThemeKey } from '../types'
import { POOL_TYPES, SORT_API_MAP } from './format'

const MODULE_TABS: ModuleType[] = ['pool', 'theme', 'industry', 'radar']
const THEME_KEYS: ThemeKey[] = ['tech', 'finance', 'consumer', 'cycle']

export function getUrlParam(key: string): string | null {
  return new URLSearchParams(window.location.search).get(key)
}

export function patchUrlParams(
  updates: Record<string, string | null | undefined>,
  replace = true,
) {
  const url = new URL(window.location.href)
  for (const [key, value] of Object.entries(updates)) {
    if (value == null || value === '') url.searchParams.delete(key)
    else url.searchParams.set(key, value)
  }
  window.history[replace ? 'replaceState' : 'pushState'](window.history.state, '', url)
}

export function parseModuleTab(): ModuleType {
  const tab = getUrlParam('tab')
  if (tab && MODULE_TABS.includes(tab as ModuleType)) return tab as ModuleType
  return 'pool'
}

export function parsePoolTab(): PoolType {
  const pool = getUrlParam('pool')
  if (pool && POOL_TYPES.includes(pool as PoolType)) return pool as PoolType
  return 'daily'
}

export function parseThemeTab(): ThemeKey {
  const theme = getUrlParam('theme')
  if (theme && THEME_KEYS.includes(theme as ThemeKey)) return theme as ThemeKey
  return 'tech'
}

const SORT_API_TO_LABEL = Object.fromEntries(
  Object.entries(SORT_API_MAP).map(([label, field]) => [field, label]),
) as Record<string, string>

export function parseRadarSort(): string {
  const sort = getUrlParam('sort')
  if (sort && SORT_API_TO_LABEL[sort]) return SORT_API_TO_LABEL[sort]
  return '3日'
}

export function radarSortToParam(sortLabel: string): string {
  return SORT_API_MAP[sortLabel] || 't_3_chg'
}

export function usePopstate(callback: () => void) {
  useEffect(() => {
    window.addEventListener('popstate', callback)
    return () => window.removeEventListener('popstate', callback)
  }, [callback])
}
