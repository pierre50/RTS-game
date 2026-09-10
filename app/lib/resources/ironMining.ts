import { UNIT_TYPES } from '../../constants'
import { t } from '../lang'
import type { RuntimeEntity, UnitEntity } from '../../types/entities'
import { canGatherAgeResource, getResourceRequiredAge, AGE_LABEL_KEYS } from '../objectives/ageRules'

type IronMiningOwner = { age?: number } | null | undefined
type IronMiningActor = { owner?: IronMiningOwner }
type IronMiningTarget = { type?: string } | null | undefined

export function canOwnerMineMineral(owner: IronMiningOwner, resource: string): boolean {
  return canGatherAgeResource(owner, resource)
}

export function canMineIronResource(unit: IronMiningActor | null | undefined, target: IronMiningTarget): boolean {
  return canOwnerMineMineral(unit?.owner, target?.type ?? '')
}

export function showIronMiningBlockedMessage(unit: UnitEntity, target: RuntimeEntity | null | undefined): void {
  if (!target || unit.type !== UNIT_TYPES.hero || !unit.owner?.isPlayed) return
  if (canOwnerMineMineral(unit.owner, target.type ?? '')) return
  if (target && !(unit.context?.controls?.instanceInCamera?.(target) ?? true)) return
  unit.context?.menu?.showMessage(
    t('tooltipRequiresAge', { age: t(AGE_LABEL_KEYS[getResourceRequiredAge(target.type ?? '')] ?? 'stoneAge') }),
    'warning'
  )
}
