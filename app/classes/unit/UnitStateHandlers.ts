import { ACTION_TYPES, FAMILY_TYPES, SHEET_TYPES, UNIT_TYPES } from '../../constants'
import {
  evaluateCombatMorale,
  resumeVillagerAutonomy,
  showAggressionFeedback,
  updateInstanceRenderVisibility,
} from '../../lib'
import { clearCombatAttackRecovery } from '../../lib/combat/combatAttackLoop'
import { applyToolAppearance } from '../../lib/hero/heroTools'
import { markUnitHealthDamaged } from '../../lib/units/unitHealth'
import { shouldSuppressAggroDuringCombatRecovery } from '../../lib/combat/combatBehavior'
import { canAutoReactToAttack, isHeroControlled } from '../../lib/units/unitControl'
import { routeUnitAwayFromPassageCell, unitHasActivePassageStopIntent } from '../../lib/buildings/passageCells'
import { keepSleepingOutsideVisual } from '../../services/rest/UnitSleepVisuals'
import { debugBanditStop } from './UnitBanditDebug'
import { UnitActions } from './UnitActions'
import type { RuntimeEntity, UnitEntity } from '../../types/entities'
import type { RuntimeCell } from '../../types/map'

type UnitStateHost = UnitEntity & {
  appearanceLayerSprites: Map<number, { loop: boolean }>
  context: NonNullable<UnitEntity['context']>
  currentCell: RuntimeCell
  getActionCondition: NonNullable<UnitEntity['getActionCondition']>
  handleChangeDest: NonNullable<UnitEntity['handleChangeDest']>
  owner: NonNullable<UnitEntity['owner']>
  runaway: (instance: RuntimeEntity) => void
  setTextures: NonNullable<UnitEntity['setTextures']>
  sprite: NonNullable<UnitEntity['sprite']>
  stopInterval: NonNullable<UnitEntity['stopInterval']>
}

export function handleUnitIsAttacked(unit: UnitStateHost, instance: RuntimeEntity | null): void {
  if (unit.context.editor) return
  if (!instance || unit.isDead) return

  markUnitHealthDamaged(unit)
  if (!canAutoReactToAttack(unit)) return

  unit.owner.reportThreat?.(unit, instance)
  const moraleDecision = evaluateCombatMorale(unit, instance)
  if (moraleDecision === 'surrender') {
    if (instance.family === FAMILY_TYPES.unit) {
      showAggressionFeedback(unit)
      if (new UnitActions(instance as UnitEntity).convertTarget(unit, { grantXp: false, stopConverter: false })) return
    }
    unit.runaway(instance)
    return
  }
  if (moraleDecision === 'flee') {
    unit.runaway(instance)
    return
  }
  if (shouldSuppressAggroDuringCombatRecovery(unit)) return
  if (unit.handleIsAttacked?.(instance, unit)) return
  if (!unit.getActionCondition(instance, ACTION_TYPES.attack)) return
  if (unit.dest === instance) return

  const currentDest = unit.dest
  showAggressionFeedback(unit)
  if (unit.context.unitRest?.handleUnitDanger(unit, instance)) {
    unit.previousDest = currentDest
    return
  }
  if (unit.type === UNIT_TYPES.villager) {
    if (instance.family === FAMILY_TYPES.animal) {
      unit.sendToHunt(instance)
    } else {
      unit.sendToAttack(instance)
    }
  } else {
    unit.sendTo(instance, ACTION_TYPES.attack)
  }
  unit.previousDest = currentDest
}

export function stopUnit(unit: UnitStateHost): void {
  if (unit.isDead || unit.isDestroyed) return
  const heroControlled = isHeroControlled(unit)
  const currentCellOccupant = unit.currentCell.has
  const currentCellHasBlockingOccupant = Boolean(
    !heroControlled &&
      unit.currentCell.solid &&
      currentCellOccupant &&
      currentCellOccupant.label !== unit.label &&
      !currentCellOccupant.isDestroyed
  )

  if (currentCellHasBlockingOccupant) {
    debugBanditStop(unit, 'stop-current-cell-occupied')
  } else if (!heroControlled && unit.currentCell.solid && currentCellOccupant?.label !== unit.label) {
    debugBanditStop(unit, 'stop-repairing-stale-current-cell')
    unit.currentCell.place(unit)
    unit.currentCell.solid = true
  }
  if (!heroControlled && resumeVillagerAutonomy?.(unit)) return
  if (
    !heroControlled &&
    !unit.action &&
    !unitHasActivePassageStopIntent(unit, unit.currentCell) &&
    routeUnitAwayFromPassageCell(unit, unit.currentCell)
  ) {
    return
  }

  clearCombatAttackRecovery(unit)
  unit.handleChangeDest()
  unit.actionLocked = false
  unit.pendingOrder = null
  unit.blockedGatherApproach = null
  unit.followAssist = null
  unit.inactif = true
  unit.action = null
  unit.dest = null
  unit.realDest = null
  unit.sprite.loop = unit.loop ?? true
  if (unit.shadow) unit.shadow.loop = unit.sprite.loop
  for (const sprite of unit.appearanceLayerSprites.values()) {
    sprite.loop = unit.loop ?? true
  }
  if (heroControlled) {
    if (unit.currentCell.has === unit) {
      unit.currentCell.has = null
      unit.currentCell.solid = false
    }
    updateInstanceRenderVisibility(unit)
    unit.visible = true
    unit.contextAction = null
    applyToolAppearance(unit, unit.context?.controls?.equippedTool ?? 'interact')
  } else if (!unit.currentCell.has || unit.currentCell.has.label === unit.label || unit.currentCell.has.isDestroyed) {
    unit.currentCell.place(unit)
    unit.currentCell.solid = true
  }
  unit.path = []
  unit.stopInterval()
  if (unit.shelterState?.status === 'outside') {
    keepSleepingOutsideVisual(unit)
    unit.actionLocked = true
    return
  }
  unit.setTextures(SHEET_TYPES.standing)
}
