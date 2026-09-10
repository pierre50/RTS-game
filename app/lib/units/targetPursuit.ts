import { getEntitySpaceMapLike, sameMapSpace } from '../mapSpaces'
import { knownTarget, observeTarget, playerSeesTarget } from './playerTargetKnowledge'
import type { RuntimeEntity, UnitEntity } from '../../types/entities'
import type { RuntimeCell } from '../../types/map'

const searches = new WeakMap<UnitEntity, { target: RuntimeEntity; action: string; cell: RuntimeCell }>()
const targetActions = new Set([
  'attack',
  'hunt',
  'captureHorse',
  'convert',
  'heal',
  'chopwood',
  'forageberry',
  'minegold',
  'minecopper',
  'mineiron',
  'minestone',
  'farm',
  'takemeat',
])

/** Route to remembered terrain, never to a hidden entity's live coordinates. */
export function routeToRememberedTarget(unit: UnitEntity, target: RuntimeEntity, action: string | null): boolean {
  if (!action || !targetActions.has(action)) return false
  if (playerSeesTarget(unit.owner, target)) {
    observeTarget(unit.owner, target)
    searches.delete(unit)
    return false
  }
  const known = knownTarget(unit.owner, target)
  const last = known ?? (unit.dest === target ? unit.realDest : null)
  const map = getEntitySpaceMapLike(unit, unit.context?.map)
  const cell = last && map?.grid[last.i]?.[last.j]
  if (!cell || (known && known.spaceId !== (unit.spaceId || 'outside'))) {
    unit.stop?.()
    return true
  }
  unit.sendToEvt?.(cell, null, { forceRepath: true, preserveAutonomy: true })
  searches.set(unit, { target, action, cell })
  return true
}

export function updateTargetPursuit(unit: UnitEntity): boolean {
  const search = searches.get(unit)
  if (search) {
    if (unit.dest !== search.cell || unit.action) {
      searches.delete(unit)
      return false
    }
    if (sameMapSpace(unit, search.target) && playerSeesTarget(unit.owner, search.target)) {
      searches.delete(unit)
      unit.sendToEvt?.(search.target, search.action, { forceRepath: true, preserveAutonomy: true })
      return true
    }
    return false
  }
  const target = unit.dest
  return Boolean(
    target && 'family' in target && routeToRememberedTarget(unit, target as RuntimeEntity, unit.action ?? null)
  )
}
