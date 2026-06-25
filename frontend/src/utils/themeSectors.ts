import type { IndustrySectorTreeNode, ThemeKey } from '../types'

export const ALL_SUB_SECTOR = '全部'

export function sortSectorNodes(nodes: IndustrySectorTreeNode[]): IndustrySectorTreeNode[] {
  return [...nodes].sort((a, b) => b.sortOrder - a.sortOrder || a.name.localeCompare(b.name, 'zh-CN'))
}

export function findTreeNode(
  nodes: IndustrySectorTreeNode[],
  id: string,
): IndustrySectorTreeNode | null {
  for (const node of nodes) {
    if (node.id === id) return node
    if (node.children?.length) {
      const found = findTreeNode(node.children, id)
      if (found) return found
    }
  }
  return null
}

export function findThemeRoot(
  tree: IndustrySectorTreeNode[],
  _themeKey: ThemeKey,
  label: string,
): IndustrySectorTreeNode | null {
  const byName = tree.find((n) => !n.parentId && n.name === label)
  if (byName) return byName
  return tree.find((n) => !n.parentId && n.name.includes(label.slice(0, 1))) ?? null
}

export function buildSectorFilterLabel(
  themeRoot: IndustrySectorTreeNode | null,
  primarySectorId: string | null,
  childSectorId: string | null,
): string {
  if (!primarySectorId || !themeRoot) return ''
  const primary = findTreeNode([themeRoot], primarySectorId)
  if (!primary) return ''
  if (childSectorId) {
    const child = findTreeNode([primary], childSectorId)
    return child ? `${primary.name} / ${child.name}` : primary.name
  }
  return primary.name
}
