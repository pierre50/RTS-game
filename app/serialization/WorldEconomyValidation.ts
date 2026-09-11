import { fail, isObject, isFiniteNumber } from './SaveValidationPrimitives'
import type { CampaignSave, LoadedGameConfig } from '../types/save'
import { validateSeedWorld } from './SaveMapValidation'
import {
  validatePlayers,
  validateResources,
  validateAnimals,
  validateNaturalResourceRespawnSlots,
} from './SaveEntityValidators'

export function validateWorldEconomy(campaign: CampaignSave, config: LoadedGameConfig): void {
  const economy = campaign.economy
  if (economy == null) return
  if (!isObject(economy) || economy.version !== 1 || !isObject(economy.regions))
    fail('Invalid save file: world economy is invalid.')
  if (
    economy.lastFactionRaidDays != null &&
    (!isObject(economy.lastFactionRaidDays) ||
      Object.values(economy.lastFactionRaidDays).some(day => !Number.isInteger(day) || Number(day) < 1))
  )
    fail('Invalid save file: faction raid cooldown is invalid.')
  for (const [id, region] of Object.entries(economy.regions)) {
    if (
      !isObject(region) ||
      region.regionId !== id ||
      !isFiniteNumber(region.simulatedUntilMs) ||
      region.simulatedUntilMs < 0
    )
      fail('Invalid save file: economy region is invalid.')
    if (
      !Array.isArray(region.terrain) ||
      !region.terrain.length ||
      region.terrain.some(row => typeof row !== 'string' || /[^#~:.]/.test(row))
    )
      fail('Invalid save file: economy terrain is invalid.')
    if (region.worldId != null) {
      const world = campaign.worlds[region.worldId]
      if (
        !world ||
        (world.state.world?.worldRegionId ?? world.state.config?.worldRegionId) !== id ||
        region.initialState != null
      )
        fail('Invalid save file: economy world reference is invalid.')
    } else {
      if (
        !region.initialState ||
        (region.initialState.world?.worldRegionId ?? region.initialState.config?.worldRegionId) !== id
      )
        fail('Invalid save file: economy initial state is missing.')
      const state = region.initialState
      const size = validateSeedWorld(state, null)
      validatePlayers(state.players, size, config, undefined, { abstractEconomy: true })
      validateResources(state.resources, size, config)
      validateAnimals(state.animals, size, config)
      validateNaturalResourceRespawnSlots(state.naturalResourceRespawnSlots, size, config)
    }
  }
}
