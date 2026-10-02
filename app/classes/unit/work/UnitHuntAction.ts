import { ACTION_TYPES, SHEET_TYPES } from '../../../constants'
import {
  BOW_SHOOT_RELEASE_FRAME,
  HUNTING_PROJECTILE,
  getHuntingAimPoint,
  onSpriteLoopAtFrame,
  playerCanSeeInstance,
  syncMovedActionTarget,
} from '../../../lib'
import { attachProjectileToMapSpace } from '../../../lib/projectiles'
import { isHeroControlled } from '../../../lib/units/unitControl'
import { spendOrWaitForEnergy } from '../../../lib/units/unitEnergy'
import type { RuntimeEntity, UnitEntity } from '../../../types/entities'
import { Projectile } from '../../Projectile'
import { stopManualHeroAction } from '../UnitManualHeroWork'

type HuntMap = NonNullable<UnitEntity['context']>['map']

function isRuntimeEntity(value: UnitEntity['dest'] | null | undefined): value is RuntimeEntity {
  return Boolean(value && !('has' in value && 'corpses' in value))
}

function huntTarget(unit: UnitEntity): RuntimeEntity | null {
  return isRuntimeEntity(unit.dest) ? unit.dest : null
}

function leaveDeadPrey(unit: UnitEntity, prey: RuntimeEntity): void {
  if (isHeroControlled(unit)) {
    stopManualHeroAction(unit)
    return
  }
  if (unit.followAssist?.action === ACTION_TYPES.hunt) {
    unit.followAssist = null
    unit.stop?.()
    return
  }
  unit.previousDest ? unit.goBackToPrevious?.() : unit.sendToTakeMeat?.(prey)
}

function updateHuntLoop(unit: UnitEntity, player: UnitEntity['owner']): void {
  const dest = huntTarget(unit)
  if (!unit.getActionCondition?.(dest)) {
    if (dest && (dest.hitPoints ?? 0) <= 0) {
      dest.die?.()
      leaveDeadPrey(unit, dest)
      return
    }
    unit.affectNewDest?.()
    return
  }
  if (!unit.isUnitAtDest?.(unit.action, dest)) {
    if (unit.context?.map?.revealEverything || (dest && playerCanSeeInstance(dest, player))) {
      unit.sendToEvt?.(dest ?? null, ACTION_TYPES.hunt, { forceRepath: true })
    } else {
      unit.stop?.()
    }
    return
  }
  syncMovedActionTarget(unit, dest)
}

function releaseHuntingProjectile(unit: UnitEntity, map: HuntMap | undefined): void {
  const dest = huntTarget(unit)
  if (!dest || !unit.getActionCondition?.(dest) || !unit.realDest || !map) return
  if (!spendOrWaitForEnergy(unit, unit.action, dest)) return
  const context = unit.context
  if (!context) return
  const projectile = new Projectile(
    {
      owner: unit,
      target: dest,
      type: HUNTING_PROJECTILE,
      destination: getHuntingAimPoint(unit, dest),
    },
    context
  )
  attachProjectileToMapSpace(projectile, map)
}

export function handleUnitHuntAction(unit: UnitEntity): void {
  const map = unit.context?.map
  const player = unit.owner
  const sprite = unit.sprite
  if (!sprite) return
  if (!unit.getActionCondition?.(unit.dest)) {
    unit.affectNewDest?.()
    return
  }
  const huntDest = huntTarget(unit)
  if (!huntDest) {
    unit.affectNewDest?.()
    return
  }
  if (huntDest.isDead) {
    leaveDeadPrey(unit, huntDest)
    return
  }
  unit.setTextures?.(SHEET_TYPES.action)
  sprite.onLoop = () => updateHuntLoop(unit, player)
  onSpriteLoopAtFrame(sprite, BOW_SHOOT_RELEASE_FRAME, () => releaseHuntingProjectile(unit, map))
}
