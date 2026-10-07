import { BUILDING_TYPES, SHEET_TYPES } from '../../constants'
import { heroCanCommand } from '../chief'
import { isHeroInteractionTargetReachable } from '../hero/heroActionRange'
import { getMissingPlayerResources, withdrawChestResources } from '../resources/playerResourceTotals'
import { refreshUnitEquipmentStats } from './equipmentStats'
import { getForgeTier, getForgeUpgradeCost, type ForgeFamily } from './forgeUpgrades'
import type { BuildingEntity, UnitEntity } from '../../types/entities'
import type { PlayerLike } from '../../types/player'

export function canManageVillageResearch(
  player: PlayerLike,
  townCenter: BuildingEntity,
  hero?: UnitEntity | null
): boolean {
  return Boolean(
    hero &&
      hero.owner === player &&
      heroCanCommand(hero) &&
      townCenter.owner === player &&
      townCenter.type === BUILDING_TYPES.townCenter &&
      townCenter.isBuilt &&
      !townCenter.isDead &&
      !townCenter.isDestroyed &&
      isHeroInteractionTargetReachable(hero, null, townCenter)
  )
}

export function canResearchVillageUpgrade(
  player: PlayerLike,
  townCenter: BuildingEntity,
  family: ForgeFamily,
  hero?: UnitEntity | null
): boolean {
  return (
    canManageVillageResearch(player, townCenter, hero) &&
    getForgeTier(player, family) < 3 &&
    Object.keys(
      getMissingPlayerResources(player, getForgeUpgradeCost(family, getForgeTier(player, family) + 1), {
        includeHero: false,
      })
    ).length === 0
  )
}

/** expectedTier rejects stale/double-clicked buttons without buying the next tier by accident. */
export function researchVillageUpgrade(
  player: PlayerLike,
  townCenter: BuildingEntity,
  family: ForgeFamily,
  expectedTier: number,
  hero?: UnitEntity | null
): boolean {
  if (expectedTier !== getForgeTier(player, family) + 1 || !canResearchVillageUpgrade(player, townCenter, family, hero))
    return false
  if (!withdrawChestResources(player, getForgeUpgradeCost(family, expectedTier), { includeHero: false })) return false
  // Keep the existing save field so previously acquired research remains valid.
  player.forgeUpgrades = { ...player.forgeUpgrades, [family]: expectedTier }
  for (const unit of player.units ?? []) {
    if (unit.isDead || unit.isDestroyed) continue
    refreshUnitEquipmentStats(unit)
    unit.syncAppearanceLayers?.(unit.currentSheet ?? SHEET_TYPES.standing)
  }
  return true
}
