import { FAMILY_TYPES, UNIT_TYPES, WORK_TYPES } from '../constants'
import { applyCombatHit } from '../lib/combat/combatHit'
import { applyDiplomaticAggression } from '../lib/combat/diplomaticAggression'
import { getEntityWeaponPower } from '../lib/equipment/equipmentStats'
import { playAudibleSoundCue, type AudibleInstance } from '../lib/audio/sound'
import { getCombatXpBonus, XP_CATEGORIES } from '../lib/units/unitExperience'
import type { GameContextLike } from '../types/context'
import type { CommandSound, RuntimeEntity, UnitEntity } from '../types/entities'
import type { Point } from '../types/grid'

type ImpactProjectile = {
  context: GameContextLike
  destinationPoint: Point
  owner: RuntimeEntity
  sounds?: { impact?: CommandSound }
  spawnOrigin: Point
  weaponPower?: number
  getDamageFactor(): number
}

export function getProjectileXpCategory(projectile: ImpactProjectile): string | null {
  if (projectile.owner.family !== FAMILY_TYPES.unit) return null
  return projectile.owner.type === UNIT_TYPES.villager && (projectile.owner as UnitEntity).work === WORK_TYPES.hunter
    ? XP_CATEGORIES.hunting
    : XP_CATEGORIES.ranged
}

export function applyProjectileHit(projectile: ImpactProjectile, instance: RuntimeEntity): void {
  const {
    context: { menu, player },
  } = projectile

  if (instance.family === FAMILY_TYPES.building) {
    playAudibleSoundCue(projectile as AudibleInstance, projectile.sounds?.impact, { profile: 'projectile' })
  }

  const openingAggression = applyDiplomaticAggression(projectile.owner, instance)
  if (openingAggression.changed && !openingAggression.hostileNow) return

  const xpCategory = getProjectileXpCategory(projectile)
  const xpBonusDamage = xpCategory ? getCombatXpBonus(projectile.owner as UnitEntity, xpCategory) : 0
  const damageFactor = projectile.getDamageFactor()
  const baseDamage = projectile.weaponPower ?? getEntityWeaponPower(projectile.owner)
  const damage = baseDamage > 0 ? Math.max(1, Math.round(baseDamage * damageFactor)) : undefined

  applyCombatHit(projectile.owner, instance, {
    attacker: projectile.owner,
    bonusDamage: xpBonusDamage,
    damageType: 'pierce',
    defaultDamage: damage,
    hitDirection: {
      x: projectile.destinationPoint.x - projectile.spawnOrigin.x,
      y: projectile.destinationPoint.y - projectile.spawnOrigin.y,
    },
    menu,
    notifyTarget: 'survived',
    player,
    xpCategory,
    xpUnit: xpCategory ? (projectile.owner as UnitEntity) : null,
  })
}
