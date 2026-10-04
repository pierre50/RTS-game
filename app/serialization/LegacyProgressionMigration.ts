import { normalizeForgeUpgrades } from '../lib/equipment/forgeUpgrades'
import type { SaveEntityState, SavePlayerState } from '../types/save'

/** Legacy ages are read only at the save boundary and never retained in runtime state. */
export function migrateLegacyProgression(player: Pick<SavePlayerState, 'forgeUpgrades' | 'buildings'>): void {
  const legacy = player as typeof player & {
    age?: number
    ageRulesVersion?: number
    technologies?: unknown
    researchTechnology?: unknown
    researchLoading?: unknown
  }
  const rawAge =
    typeof legacy.age === 'number' && Number.isFinite(legacy.age) ? Math.max(0, Math.min(3, Math.floor(legacy.age))) : 0
  const canonicalAge = legacy.ageRulesVersion === 1 ? Math.min(rawAge, 2) : Math.min(rawAge, 1) + Number(rawAge === 3)
  if (!player.forgeUpgrades) {
    const tier = canonicalAge >= 2 ? 3 : canonicalAge >= 1 ? 2 : 0
    player.forgeUpgrades = { axes: tier, pickaxes: tier, hammers: tier, weapons: tier, arrows: tier, armor: tier }
  }
  player.forgeUpgrades = normalizeForgeUpgrades(player)
  for (const building of player.buildings ?? []) migrateBuilding(building, canonicalAge)
  delete legacy.age
  delete legacy.technologies
  delete legacy.researchTechnology
  delete legacy.researchLoading
  delete legacy.ageRulesVersion
}

function migrateBuilding(building: SaveEntityState, ownerLegacyAge: number): void {
  if (!building || typeof building !== 'object' || Array.isArray(building))
    throw new Error('Invalid save file: building is invalid.')
  const legacy = building as SaveEntityState & {
    technology?: unknown
    buildingAge?: number
    assetAge?: number
    buildingUpgrade?: { targetAge?: number }
  }
  const oldLevel = legacy.buildingAge ?? legacy.assetAge ?? ownerLegacyAge
  building.buildingLevel ??= typeof oldLevel === 'number' ? Math.min(1, Math.max(0, Math.floor(oldLevel))) : 0
  if (building.buildingUpgrade && typeof building.buildingUpgrade === 'object') {
    const upgrade = building.buildingUpgrade as typeof building.buildingUpgrade & { targetAge?: number }
    upgrade.targetLevel ??= upgrade.targetAge ?? 1
    delete upgrade.targetAge
  }
  delete legacy.technology
  delete legacy.buildingAge
  delete legacy.assetAge
  if (building.interiorBuildings != null && !Array.isArray(building.interiorBuildings))
    throw new Error('Invalid save file: interior buildings must be an array.')
  for (const child of building.interiorBuildings ?? []) migrateBuilding(child, 0)
}
