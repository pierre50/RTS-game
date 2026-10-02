import { BUILDING_TYPES, SHEET_TYPES } from '../../constants'
import { heroCanCommand } from '../chief'
import { isHeroInteractionTargetReachable } from '../hero/heroActionRange'
import { getMissingPlayerResources, withdrawChestResources } from '../resources/playerResourceTotals'
import { refreshUnitEquipmentStats } from './equipmentStats'
import { getForgeTier, getForgeUpgradeCost, type ForgeFamily } from './forgeUpgrades'
import type { BuildingEntity, UnitEntity } from '../../types/entities'
import type { PlayerLike } from '../../types/player'

export function canManageForge(player: PlayerLike, forge: BuildingEntity, hero?: UnitEntity | null): boolean {
  return Boolean(
    hero &&
      hero.owner === player &&
      heroCanCommand(hero) &&
      forge.owner === player &&
      forge.type === BUILDING_TYPES.forge &&
      forge.isBuilt &&
      !forge.isDead &&
      !forge.isDestroyed &&
      isHeroInteractionTargetReachable(hero, null, forge)
  )
}

export function canResearchForgeUpgrade(
  player: PlayerLike,
  forge: BuildingEntity,
  family: ForgeFamily,
  hero?: UnitEntity | null
): boolean {
  return (
    canManageForge(player, forge, hero) &&
    getForgeTier(player, family) < 3 &&
    Object.keys(
      getMissingPlayerResources(player, getForgeUpgradeCost(family, getForgeTier(player, family) + 1), {
        includeHero: false,
      })
    ).length === 0
  )
}

/** expectedTier rejects stale/double-clicked buttons without buying the next tier by accident. */
export function researchForgeUpgrade(
  player: PlayerLike,
  forge: BuildingEntity,
  family: ForgeFamily,
  expectedTier: number,
  hero?: UnitEntity | null
): boolean {
  if (expectedTier !== getForgeTier(player, family) + 1 || !canResearchForgeUpgrade(player, forge, family, hero))
    return false
  if (!withdrawChestResources(player, getForgeUpgradeCost(family, expectedTier), { includeHero: false })) return false
  player.forgeUpgrades = { ...player.forgeUpgrades, [family]: expectedTier }
  for (const unit of player.units ?? []) {
    if (unit.type === 'Hero' || unit.isDead || unit.isDestroyed) continue
    refreshUnitEquipmentStats(unit)
    unit.syncAppearanceLayers?.(unit.currentSheet ?? SHEET_TYPES.standing)
  }
  return true
}
