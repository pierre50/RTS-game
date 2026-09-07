import type { RuntimeEntity, UnitEntity } from '../../types/entities'

export function stableUnitSeed(unit: UnitEntity): number {
  const value = unit.label ?? `${unit.type}:${unit.i}:${unit.j}`
  let hash = 0
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0
  }
  return hash
}

export function restDistance(a: Pick<RuntimeEntity, 'i' | 'j'>, b: Pick<RuntimeEntity, 'i' | 'j'>): number {
  return Math.abs(a.i - b.i) + Math.abs(a.j - b.j)
}

export function hitPointRatio(entity: Pick<RuntimeEntity, 'hitPoints' | 'totalHitPoints'>): number {
  const total = entity.totalHitPoints ?? 0
  if (total <= 0) return 1
  return Math.max(0, Math.min(1, (entity.hitPoints ?? total) / total))
}
