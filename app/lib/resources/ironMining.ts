import { MINING_RESOURCE_CONFIG, UNIT_TYPES } from '../../constants'
import { isHeroControlled } from '../units/unitControl'
import { t } from '../lang'
import type { RuntimeEntity, UnitEntity } from '../../types/entities'
import { hasIronMiningPickaxe, type MiningActor } from './miningEquipment'

type IronMiningTarget = { type?: string } | null | undefined

export function canMineIronResource(unit: MiningActor | null | undefined, target: IronMiningTarget): boolean {
  return target?.type?.toLowerCase() !== 'iron' || hasIronMiningPickaxe(unit)
}

export function canHeroStrikeLockedMine(
  unit: UnitEntity,
  target: RuntimeEntity | null | undefined,
  action: string | null | undefined = unit.action
): boolean {
  return Boolean(
    unit.type === UNIT_TYPES.hero &&
      isHeroControlled(unit) &&
      target &&
      !target.isDead &&
      !target.isDestroyed &&
      (target.quantity ?? 0) > 0 &&
      MINING_RESOURCE_CONFIG[target.type as keyof typeof MINING_RESOURCE_CONFIG]?.action === action &&
      !canMineIronResource(unit, target)
  )
}

export function showIronMiningBlockedMessage(unit: UnitEntity, target: RuntimeEntity | null | undefined): void {
  if (!target || unit.type !== UNIT_TYPES.hero || !unit.owner?.isPlayed) return
  if (canMineIronResource(unit, target)) return
  if (target && !(unit.context?.controls?.instanceInCamera?.(target) ?? true)) return
  unit.context?.menu?.showMessage(t('ironRequiresBronzePickaxe'), 'warning')
}
