import { RESOURCE_TYPES, UNIT_TYPES } from '../../constants'
import { t } from '../lang'
import type { RuntimeEntity, UnitEntity } from '../../types/entities'
import type { PlayerLike } from '../../types/player'

export const IRON_MINING_MIN_AGE = 2

type IronMiningOwner = Pick<PlayerLike, 'age'> | { age?: number } | null | undefined
type IronMiningActor = { owner?: IronMiningOwner }

export function canOwnerMineIron(owner: IronMiningOwner): boolean {
  return (owner?.age ?? 0) >= IRON_MINING_MIN_AGE
}

type IronMiningTarget = { type?: string } | null | undefined

export function isIronMiningTarget(target: IronMiningTarget): boolean {
  return target?.type === RESOURCE_TYPES.iron
}

export function canMineIronResource(
  unit: IronMiningActor | null | undefined,
  target: IronMiningTarget
): boolean {
  return !isIronMiningTarget(target) || canOwnerMineIron(unit?.owner)
}

export function showIronMiningBlockedMessage(unit: UnitEntity, target: RuntimeEntity | null | undefined): void {
  if (!isIronMiningTarget(target)) return
  if (unit.type !== UNIT_TYPES.hero) return
  if (!unit.owner?.isPlayed) return
  if (canOwnerMineIron(unit.owner)) return
  if (target && !(unit.context?.controls?.instanceInCamera?.(target) ?? true)) return
  unit.context?.menu?.showMessage(t('needStrongerPickaxe'), 'warning')
}
