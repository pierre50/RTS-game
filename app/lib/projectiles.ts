import { getForgeTier, type ForgeUpgradeOwner } from './equipment/forgeUpgrades'
import type { ContainerChild } from 'pixi.js'
import type { RuntimeMap } from '../types/map'

type ProjectileEquipmentOwner = ForgeUpgradeOwner

type RuntimeProjectileDisplay = ContainerChild & {
  attachToMapSpace?: () => void
}

const MATERIAL_ARROW_PROJECTILES = ['ArrowCeramic', 'ArrowCopper', 'ArrowBronze', 'ArrowIron'] as const

function getForgeArrowProjectile(player?: ProjectileEquipmentOwner | null): string {
  const tier = getForgeTier(player, 'arrows')
  return MATERIAL_ARROW_PROJECTILES[Math.min(tier, MATERIAL_ARROW_PROJECTILES.length - 1)]
}

export function getEffectiveProjectileType(projectileType: string, player?: ProjectileEquipmentOwner | null): string {
  return projectileType === 'Arrow' ? getForgeArrowProjectile(player) : projectileType
}

export function attachProjectileToMapSpace(projectile: RuntimeProjectileDisplay, map: RuntimeMap): void {
  if (typeof projectile.attachToMapSpace === 'function') {
    projectile.attachToMapSpace()
    return
  }
  map.addChild(projectile)
}
