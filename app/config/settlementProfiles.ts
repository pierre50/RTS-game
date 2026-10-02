import { CIVILIZATIONS } from './civilizations'
import type { VillageStartProfile } from '../types/save'

export type SettlementType = 'outpost' | 'village' | 'city'
export type DevelopmentMode = 'static' | 'dynamic'

/** Stable across visits and saves; explicit map/setup choices take precedence. */
export function defaultSettlementType(key: string): SettlementType {
  const index = CIVILIZATIONS.findIndex(civilization => civilization.value === key)
  if (index >= 0) return (['village', 'city', 'outpost'] as const)[index % 3]
  let hash = 0
  for (const character of key) hash = (hash * 31 + character.charCodeAt(0)) >>> 0
  return (['outpost', 'village', 'city'] as const)[hash % 3]
}

export function isStaticSettlement(owner: { developmentMode?: DevelopmentMode }): boolean {
  return owner.developmentMode === 'static'
}

export const SETTLEMENT_PROFILES: Record<SettlementType, VillageStartProfile> = {
  outpost: {
    settlementType: 'outpost',
    developmentMode: 'static',
    buildingLevel: 0,
    buildings: { FireCamp: 1, WatchTower: 2 },
    units: { Fantassin: 4, Bowman: 2 },
  },
  village: {
    settlementType: 'village',
    developmentMode: 'static',
    buildingLevel: 1,
    wheatFields: 4,
    buildings: { Granary: 1, StoragePit: 1, CampBrazier: 4 },
    units: { Chief: 1, Villager: 10, Fantassin: 5, Bowman: 1 },
    depotStocks: { Granary: { wheat: 200 }, StoragePit: { wood: 150, stone: 100 } },
  },
  city: {
    settlementType: 'city',
    developmentMode: 'static',
    buildingLevel: 2,
    forgeUpgrades: { axes: 3, pickaxes: 3, hammers: 3, weapons: 3, arrows: 3, armor: 3 },
    wheatFields: 8,
    buildings: {
      TownCenter: 1,
      Temple: 1,
      Market: 1,
      Forge: 1,
      Barracks: 1,
      ArcheryRange: 1,
      Stable: 1,
      Granary: 3,
      StoragePit: 2,
      WatchTower: 3,
      CampBrazier: 10,
    },
    units: { Chief: 1, Villager: 24, Fantassin: 12, Bowman: 6 },
    depotStocks: { Granary: { wheat: 250 }, StoragePit: { wood: 150, stone: 100, iron: 25, copper: 25 } },
  },
}
