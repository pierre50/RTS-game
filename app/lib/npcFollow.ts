import { ACTION_TYPES, FAMILY_TYPES } from '../constants'
import type { AnimalEntity, RuntimeEntity, UnitEntity } from '../types/entities'
import type { RuntimeCell, RuntimeMap } from '../types/map'
import { findInstancesInSight } from './grid/visibility'
import { isometricToCartesian } from './maths'

const FOLLOW_SLACK = 2
const ESCORT_ENGAGE_RANGE = 7
const ESCORT_LEASH_RANGE = 12
const FORMATION_SLOT_SPACING = 40

function cellDistance(a: Pick<RuntimeEntity, 'i' | 'j'>, b: Pick<RuntimeEntity, 'i' | 'j'>): number {
  return Math.hypot((a.i ?? 0) - (b.i ?? 0), (a.j ?? 0) - (b.j ?? 0))
}

function isRuntimeEntityDest(value: RuntimeEntity | RuntimeCell | null | undefined): value is RuntimeEntity {
  return Boolean(value && !('has' in value && 'corpses' in value))
}

function hasCombatOrder(target: RuntimeEntity): target is (UnitEntity | AnimalEntity) & {
  action?: string | null
  dest?: RuntimeCell | RuntimeEntity | null
} {
  return (
    (target.family === FAMILY_TYPES.unit || target.family === FAMILY_TYPES.animal) &&
    'action' in target &&
    'dest' in target
  )
}

function isAttackingAlly(hero: UnitEntity, target: RuntimeEntity): boolean {
  if (!hasCombatOrder(target)) return false
  return target.action === ACTION_TYPES.attack && isRuntimeEntityDest(target.dest) && target.dest?.owner === hero.owner
}

function isEscortThreat(hero: UnitEntity, target: RuntimeEntity): boolean {
  if (target === hero || target.isDead || target.isDestroyed || (target.hitPoints ?? 0) <= 0) return false
  if (isAttackingAlly(hero, target)) return true
  return target.family === FAMILY_TYPES.unit && Boolean(target.owner && hero.owner?.isEnemy?.(target.owner))
}

function findEscortThreats(hero: UnitEntity): RuntimeEntity[] {
  return findInstancesInSight<UnitEntity, RuntimeEntity>(
    hero,
    target => isEscortThreat(hero, target),
    ESCORT_ENGAGE_RANGE
  )
}

function pickEscortTarget(hero: UnitEntity, unit: UnitEntity, threats: RuntimeEntity[]): RuntimeEntity | null {
  let best: RuntimeEntity | null = null
  let bestAttacking = false
  let bestDist = Infinity
  for (const threat of threats) {
    if (!unit.getActionCondition?.(threat, ACTION_TYPES.attack)) continue
    const attacking = isAttackingAlly(hero, threat)
    if (best && bestAttacking && !attacking) continue
    const dist = cellDistance(unit, threat)
    if (best && bestAttacking === attacking && dist >= bestDist) continue
    best = threat
    bestAttacking = attacking
    bestDist = dist
  }
  return best
}

function isEscortFighting(unit: UnitEntity): boolean {
  if (unit.action !== ACTION_TYPES.attack) return false
  return isRuntimeEntityDest(unit.dest) && !unit.dest?.isDead && !unit.dest?.isDestroyed
}

function getFormationSlotOffset(slotIndex: number, totalCount: number): { back: number; side: number } {
  const width = Math.max(1, Math.ceil(Math.sqrt(totalCount)))
  const row = Math.floor(slotIndex / width)
  const col = slotIndex % width
  const rowCount = Math.min(width, totalCount - row * width)
  return { back: row + 1, side: col - (rowCount - 1) / 2 }
}

function getFormationSlotCell(
  hero: UnitEntity,
  slotIndex: number,
  totalCount: number,
  map: RuntimeMap
): RuntimeCell | null {
  const { back, side } = getFormationSlotOffset(slotIndex, totalCount)
  const rad = ((hero.degree ?? 0) - 180) * (Math.PI / 180)
  const forwardX = Math.cos(rad)
  const forwardY = Math.sin(rad)
  const rightX = -forwardY
  const rightY = forwardX
  const targetX = hero.x - forwardX * back * FORMATION_SLOT_SPACING + rightX * side * FORMATION_SLOT_SPACING
  const targetY = hero.y - forwardY * back * FORMATION_SLOT_SPACING + rightY * side * FORMATION_SLOT_SPACING
  const [ti, tj] = isometricToCartesian(targetX, targetY)
  return map.grid[ti]?.[tj] ?? null
}

export function updateNpcFollow(hero: UnitEntity): void {
  const units = hero.owner?.units
  const map = hero.context?.map
  if (!units || !map) return
  const heroCell = map.grid[hero.i]?.[hero.j]
  if (!heroCell) return
  let threats: RuntimeEntity[] | null = null
  const formationUnits: UnitEntity[] = []
  for (const unit of units) {
    if (!unit.followingHero || unit === hero || unit.isDead || unit.isDestroyed) continue
    if (unit.lookingAtHero) continue
    if (isEscortFighting(unit)) {
      if (cellDistance(hero, unit) > ESCORT_LEASH_RANGE) unit.sendTo?.(heroCell)
      continue
    }
    threats ??= findEscortThreats(hero)
    const target = pickEscortTarget(hero, unit, threats)
    if (target) {
      unit.sendToAttack?.(target)
      continue
    }
    formationUnits.push(unit)
  }
  if (!formationUnits.length) return

  formationUnits.sort((a, b) => (a.label < b.label ? -1 : a.label > b.label ? 1 : 0))

  formationUnits.forEach((unit, index) => {
    const slotCell = getFormationSlotCell(hero, index, formationUnits.length, map) ?? heroCell
    if (cellDistance(unit, slotCell) <= FOLLOW_SLACK) return
    if (unit.dest === slotCell) return
    unit.sendTo?.(slotCell)
  })
}
