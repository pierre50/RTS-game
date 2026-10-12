import { PROJECTILE_CELL_DISTANCE } from '../../ProjectileGeometry'
import {
  hasNpcWeaponInventory,
  hasUsableNpcRangedWeapon,
  getNpcWeaponChoice,
} from '../../../lib/units/combat/npcWeapons'
import { getEntityWeaponPower, getUnitCombatRange } from '../../../lib/equipment/equipmentStats'
import { wearEquippedWeapon } from '../../../lib/equipment/equipmentWear'
import { hasRangedAmmunition } from '../../../lib/units/combat/rangedAmmunition'
import { consumeRangedAmmunition } from '../../../lib/units/combat/rangedShot'
import { ACTION_TYPES, SHEET_TYPES } from '../../../constants'
import {
  BOW_SHOOT_RELEASE_FRAME,
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
  if (dest && (dest.hitPoints ?? 0) <= 0) {
    dest.die?.()
    leaveDeadPrey(unit, dest)
    return
  }
  if (!hasRangedAmmunition(unit) || (hasNpcWeaponInventory(unit) && !hasUsableNpcRangedWeapon(unit))) {
    unit.followAssist = null
    unit.stop?.()
    return
  }
  if (!unit.getActionCondition?.(dest)) {
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
  if (!hasRangedAmmunition(unit) || (hasNpcWeaponInventory(unit) && !hasUsableNpcRangedWeapon(unit))) {
    unit.stop?.()
    return
  }
  if (!spendOrWaitForEnergy(unit, unit.action, dest)) return
  const context = unit.context
  if (!context) return
  const range = getUnitCombatRange(unit)
  const weaponPower = getEntityWeaponPower(unit)
  const firedWeapon = hasNpcWeaponInventory(unit) ? getNpcWeaponChoice(unit) : null
  const projectileType = consumeRangedAmmunition(unit)
  if (!projectileType) {
    unit.stop?.()
    return
  }
  unit.context?.menu?.refreshInventory?.()
  const projectile = new Projectile(
    {
      owner: unit,
      target: dest,
      type: projectileType,
      weaponPower,
      maxDistance: range ? range * PROJECTILE_CELL_DISTANCE : undefined,
      destination: getHuntingAimPoint(unit, dest, projectileType),
    },
    context
  )
  attachProjectileToMapSpace(projectile, map)
  wearEquippedWeapon(
    unit,
    'ranged',
    firedWeapon?.weapon ? unit.inventory?.equipment?.indexOf(firedWeapon.weapon) : undefined
  )
}

export function handleUnitHuntAction(unit: UnitEntity): void {
  const huntDest = huntTarget(unit)
  if (huntDest?.isDead) {
    leaveDeadPrey(unit, huntDest)
    return
  }
  if (!hasRangedAmmunition(unit) || (hasNpcWeaponInventory(unit) && !hasUsableNpcRangedWeapon(unit))) {
    unit.followAssist = null
    unit.stop?.()
    return
  }
  const map = unit.context?.map
  const player = unit.owner
  const sprite = unit.sprite
  if (!sprite) return
  if (!unit.getActionCondition?.(unit.dest)) {
    unit.affectNewDest?.()
    return
  }
  if (!huntDest) {
    unit.affectNewDest?.()
    return
  }
  unit.setTextures?.(SHEET_TYPES.action)
  sprite.onLoop = () => updateHuntLoop(unit, player)
  onSpriteLoopAtFrame(sprite, BOW_SHOOT_RELEASE_FRAME, () => releaseHuntingProjectile(unit, map))
}
