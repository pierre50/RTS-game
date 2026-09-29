import type { DevConsoleContext } from '../types'

type DisplayTreeNode = {
  children?: unknown[]
  constructor?: { name?: string }
  label?: unknown
  renderable?: boolean
  visible?: boolean
}

type DisplayTreeStats = {
  effectiveRenderable: number
  effectiveVisible: number
  maxDepth: number
  nodes: number
  renderable: number
  visible: number
}

type DisplayTreeGroup = DisplayTreeStats & {
  count: number
  label: string
}

function asDisplayTreeNode(value: unknown): DisplayTreeNode | null {
  if (!value || typeof value !== 'object') return null
  return value as DisplayTreeNode
}

function looksLikeUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
}

function displayNodeLabel(node: DisplayTreeNode): string {
  const constructorName = node.constructor?.name || 'Object'
  const label = typeof node.label === 'string' ? node.label.trim() : ''
  if (label && !looksLikeUuid(label)) return `${label} (${constructorName})`
  return constructorName
}

function collectDisplayTreeStats(root: unknown): DisplayTreeStats | null {
  const rootNode = asDisplayTreeNode(root)
  if (!rootNode) return null
  const stack: Array<{ depth: number; node: DisplayTreeNode; parentRenderable: boolean; parentVisible: boolean }> = [
    { node: rootNode, depth: 0, parentRenderable: true, parentVisible: true },
  ]
  const stats: DisplayTreeStats = {
    effectiveRenderable: 0,
    effectiveVisible: 0,
    maxDepth: 0,
    nodes: 0,
    renderable: 0,
    visible: 0,
  }

  while (stack.length) {
    const { depth, node, parentRenderable, parentVisible } = stack.pop()!
    const nodeVisible = node.visible !== false
    const nodeRenderable = node.renderable !== false
    const nodeEffectiveVisible = parentVisible && nodeVisible
    const nodeEffectiveRenderable = parentRenderable && nodeVisible && nodeRenderable
    stats.nodes++
    if (nodeVisible) stats.visible++
    if (nodeRenderable) stats.renderable++
    if (nodeEffectiveVisible) stats.effectiveVisible++
    if (nodeEffectiveRenderable) stats.effectiveRenderable++
    stats.maxDepth = Math.max(stats.maxDepth, depth)

    const children = node.children
    if (!children?.length) continue
    for (let index = children.length - 1; index >= 0; index--) {
      const child = asDisplayTreeNode(children[index])
      if (!child) continue
      stack.push({
        node: child,
        depth: depth + 1,
        parentRenderable: nodeEffectiveRenderable,
        parentVisible: nodeEffectiveVisible,
      })
    }
  }

  return stats
}

function mergeDisplayTreeStats(target: DisplayTreeGroup, stats: DisplayTreeStats): void {
  target.effectiveRenderable += stats.effectiveRenderable
  target.effectiveVisible += stats.effectiveVisible
  target.maxDepth = Math.max(target.maxDepth, stats.maxDepth)
  target.nodes += stats.nodes
  target.renderable += stats.renderable
  target.visible += stats.visible
}

function formatDisplayTreeStats(stats: DisplayTreeStats): string {
  return `nodes ${stats.nodes} | effective ${stats.effectiveRenderable} renderable/${stats.effectiveVisible} visible | flags ${stats.renderable} renderable/${stats.visible} visible | depth ${stats.maxDepth}`
}

function formatDisplayTreeSection(title: string, root: unknown, limit: number): string[] {
  const rootNode = asDisplayTreeNode(root)
  const rootStats = collectDisplayTreeStats(root)
  if (!rootNode || !rootStats) return [`${title}: unavailable`]

  const lines = [`${title}: ${formatDisplayTreeStats(rootStats)}`]
  const groups = new Map<string, DisplayTreeGroup>()
  for (const childValue of rootNode.children ?? []) {
    const child = asDisplayTreeNode(childValue)
    if (!child) continue
    const stats = collectDisplayTreeStats(child)
    if (!stats) continue
    const label = displayNodeLabel(child)
    let group = groups.get(label)
    if (!group) {
      group = {
        count: 0,
        effectiveRenderable: 0,
        effectiveVisible: 0,
        label,
        maxDepth: 0,
        nodes: 0,
        renderable: 0,
        visible: 0,
      }
      groups.set(label, group)
    }
    group.count++
    mergeDisplayTreeStats(group, stats)
  }

  const sortedGroups = [...groups.values()]
    .sort((a, b) => b.effectiveRenderable - a.effectiveRenderable || b.nodes - a.nodes)
    .slice(0, Math.max(1, limit))
  if (sortedGroups.length) lines.push(`${title} children`)
  for (const group of sortedGroups) {
    lines.push(`  ${group.label} x${group.count}: ${formatDisplayTreeStats(group)}`)
  }
  return lines
}

export function formatDisplayTreeBreakdown(context: DevConsoleContext, limit: number): string[] {
  return [
    'Display tree',
    ...formatDisplayTreeSection('stage', context.app?.stage, limit),
    ...formatDisplayTreeSection('map', context.map, limit),
  ]
}
