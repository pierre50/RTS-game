import { claimHeroHome, getHouseholdUnits } from './households'
import type { BuildingEntity, UnitEntity } from '../../types/entities'
import type { GameContextLike } from '../../types/context'

/** Keep inactive region snapshots consistent with the travelling hero's chosen home. */
export function setHeroHome(context: GameContextLike, hero: UnitEntity, house: BuildingEntity): boolean {
  if (!hero.owner || house.owner !== hero.owner || !claimHeroHome(hero.owner, hero, house)) return false
  const states = new Set([
    ...Object.keys(context.getWorldGraph?.()?.nodes ?? {}).map(id => context.getCampaignWorldState?.(id)),
    ...Object.values(context.getCampaignEconomy?.()?.regions ?? {}).map(region => region.initialState),
  ])
  const owners = [...(context.players ?? []), ...[...states].flatMap(state => state?.players ?? [])]
  for (const owner of owners) {
    for (const building of owner.buildings ?? []) {
      if (building.heroHomeResident?.label === hero.label && building.label !== hero.homeHouseLabel)
        delete building.heroHomeResident
    }
    for (const savedHero of getHouseholdUnits(owner)) {
      if (savedHero.label !== hero.label) continue
      savedHero.homeHouseLabel = hero.homeHouseLabel
      savedHero.homeBedLabel = hero.homeBedLabel
    }
  }
  return true
}
