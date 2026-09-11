import { decodeEconomyTerrain, summarizeEconomy } from '../world/WorldEconomy'
import { UNIT_TYPES } from '../../constants/entities'
import { isLiving, OfflineWorldSpatial } from '../world/OfflineWorldSpatial'
import type { GameContextLike } from '../../types/context'
import type { FactionExpeditionSave, SaveEntityState } from '../../types/save'
import type { TributeRaidUnit } from '../TributeRaidRules'
import { depositChestResources } from '../../lib/resources/playerResourceTotals'
import { savedResourceOwner } from '../world/OfflineWorldWork'

export function creditFactionRaidTribute(context: GameContextLike, expedition: FactionExpeditionSave): void {
  const source = factionArmySource(context, expedition.regionId, expedition.playerLabel)
  if (!source) return
  depositChestResources(savedResourceOwner(source.player, source.state.players), expedition.tribute)
  summarizeEconomy(source.region, source.state)
}

export function factionArmySource(context: GameContextLike, regionId: string, playerLabel: string) {
  const region = context.getCampaignEconomy?.()?.regions[regionId]
  if (!region || (region.worldId && region.worldId === context.getCurrentWorldId?.())) return null
  const state = region.worldId ? context.getCampaignWorldState?.(region.worldId) : region.initialState
  const player = state?.players.find(player => player.label === playerLabel)
  return state && player ? { region, state, player } : null
}

export type FactionRaidArmy = { regionId: string; playerLabel: string; units: SaveEntityState[] }

export function selectFactionRaidArmy(context: GameContextLike, factionId: string, limit = 9): FactionRaidArmy | null {
  const ratio = context.map.difficulty === 'easy' ? 0.3 : context.map.difficulty === 'hard' ? 0.5 : 0.4
  const candidates: FactionRaidArmy[] = []
  for (const region of Object.values(context.getCampaignEconomy?.()?.regions ?? {})) {
    if (region.worldId && region.worldId === context.getCurrentWorldId?.()) continue
    const state = region.worldId ? context.getCampaignWorldState?.(region.worldId) : region.initialState
    for (const player of state?.players ?? []) {
      if (player.type !== 'AI' || player.factionId !== factionId || !player.label) continue
      const soldiers = (player.units ?? []).filter(
        unit =>
          isLiving(unit) &&
          unit.label &&
          !unit.factionExpedition &&
          !unit.trainingTargetType &&
          !unit.followingHero &&
          unit.controlMode !== 'hero' &&
          [UNIT_TYPES.infantry, UNIT_TYPES.bowman, UNIT_TYPES.scout].includes(unit.type)
      )
      const count = Math.min(limit, Math.floor(soldiers.length * ratio))
      if (count < 2) continue
      candidates.push({ regionId: region.regionId, playerLabel: player.label, units: soldiers.slice(0, count) })
    }
  }
  return candidates.sort((a, b) => b.units.length - a.units.length || a.regionId.localeCompare(b.regionId))[0] ?? null
}

export function commitFactionRaidArmy(context: GameContextLike, army: FactionRaidArmy): boolean {
  const source = factionArmySource(context, army.regionId, army.playerLabel)
  if (!source || !army.units.every(unit => source.player.units?.includes(unit) && isLiving(unit))) return false
  const selected = new Set(army.units)
  source.player.units = source.player.units!.filter(unit => !selected.has(unit))
  source.player.population = Math.max(0, (source.player.population ?? 0) - army.units.length)
  summarizeEconomy(source.region, source.state)
  return true
}

export function returnFactionRaidUnit(context: GameContextLike, unit: TributeRaidUnit): boolean {
  const expedition = unit.factionExpedition
  if (!expedition || unit.isDead || unit.isDestroyed || (unit.hitPoints ?? 0) <= 0) return false
  const source = factionArmySource(context, expedition.regionId, expedition.playerLabel)
  if (!source) return false
  if (source.player.units?.some(saved => saved.label === expedition.original.label)) return true
  const spatial = new OfflineWorldSpatial(decodeEconomyTerrain(source.region.terrain), source.state, () => 2)
  const position = spatial.findNear(expedition.original)
  if (!position) return false
  const returned = structuredClone(expedition.original)
  Object.assign(returned, position, { hitPoints: unit.hitPoints, action: null, dest: null, path: [], inactif: true })
  delete returned.offlineWork
  delete returned.factionExpedition
  if (unit.inventory) returned.inventory = structuredClone(unit.inventory)
  if (unit.experience) returned.experience = structuredClone(unit.experience)
  returned.mountedOnHorse = unit.mountedOnHorse
  returned.horseColor = unit.horseColor
  source.player.units ??= []
  source.player.units.push(returned)
  source.player.population = (source.player.population ?? 0) + 1
  summarizeEconomy(source.region, source.state)
  return true
}

export function expeditionState(
  army: FactionRaidArmy,
  original: SaveEntityState,
  raidId: string,
  factionId: string,
  tribute: FactionExpeditionSave['tribute']
): FactionExpeditionSave {
  return {
    raidId,
    factionId,
    regionId: army.regionId,
    playerLabel: army.playerLabel,
    original: structuredClone(original),
    phase: 'approaching',
    tribute: { ...tribute },
  }
}
