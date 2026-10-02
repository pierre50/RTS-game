import { UNIT_TYPES } from '../../constants'
import { BANDIT_FACTION_ID } from '../../lib/campaign/playerRoster'
import type { ResourceAmount } from '../../types/common'
import type { FactionSave } from '../../types/save'
import { FACTION_RAID_MIN_HATE, FACTION_RAID_INTERVAL_DAYS, roundTributeCost } from './TributeRaidRules'
import type { TributeRaidSystem } from './TributeRaidSystem'
import { selectFactionRaidArmy } from './FactionRaidEconomy'

export function isBaseWorld(runtime: TributeRaidSystem): boolean {
  const graph = runtime.context.getWorldGraph?.()
  const currentWorldId = runtime.context.getCurrentWorldId?.()
  return Boolean(graph?.rootWorldId && currentWorldId && graph.rootWorldId === currentWorldId)
}

export function findAngryKnownFaction(
  runtime: TributeRaidSystem,
  options: { ignoreBaseWorld?: boolean } = {}
): FactionSave | null {
  if (!options.ignoreBaseWorld && !runtime.isBaseWorld()) return null
  const factions = Object.values(runtime.context.getCampaignFactions?.() ?? {})
  const angry = factions
    .filter(faction => faction.id !== BANDIT_FACTION_ID && faction.relationScore <= FACTION_RAID_MIN_HATE)
    .filter(faction => selectFactionRaidArmy(runtime.context, faction.id) !== null)
    .filter(faction => {
      const last = runtime.context.getCampaignEconomy?.()?.lastFactionRaidDays?.[faction.id]
      return last == null || (runtime.context.dayNight?.state?.day ?? 1) - last >= FACTION_RAID_INTERVAL_DAYS
    })
    .sort((a, b) => a.relationScore - b.relationScore)
  const worst = angry[0]
  if (!worst) return null

  const worstScore = worst.relationScore
  const candidates = angry.filter(faction => faction.relationScore <= worstScore + 20)
  return candidates[Math.floor((runtime.context.map.random?.() ?? Math.random()) * candidates.length)] ?? worst
}

export function getBanditRaidSize(runtime: TributeRaidSystem): number {
  const day = runtime.context.dayNight?.state?.day ?? 1
  return Math.max(2, Math.min(7, 2 + Math.floor(day / 5)))
}

export function getFactionRaidSize(runtime: TributeRaidSystem, faction: FactionSave): number {
  const militaryCount = runtime.getLivingPlayerMilitaryCount()
  const hateBonus = Math.max(0, Math.floor(Math.abs(Math.min(0, faction.relationScore)) / 25))
  const randomBonus = Math.floor((runtime.context.map.random?.() ?? Math.random()) * 3)
  return Math.max(2, Math.min(9, 2 + Math.floor(militaryCount / 2) + hateBonus + randomBonus))
}

export function getBanditTributeCost(runtime: TributeRaidSystem): ResourceAmount {
  const day = runtime.context.dayNight?.state?.day ?? 1
  return roundTributeCost({
    food: 40 + day * 5,
    gold: 25 + day * 4,
  })
}

export function getFactionTributeCost(runtime: TributeRaidSystem, faction: FactionSave): ResourceAmount {
  const day = runtime.context.dayNight?.state?.day ?? 1
  const hate = Math.max(0, Math.abs(Math.min(0, faction.relationScore)))
  const soldiers = runtime.getLivingPlayerMilitaryCount()
  return roundTributeCost({
    food: 45 + day * 4 + soldiers * 8 + Math.floor(hate * 0.8),
    gold: 25 + day * 3 + soldiers * 5 + Math.floor(hate * 0.6),
  })
}

export function getLivingPlayerMilitaryCount(runtime: TributeRaidSystem): number {
  return (runtime.context.player?.units ?? []).filter(
    unit => !unit.isDead && !unit.isDestroyed && unit.type !== UNIT_TYPES.villager && unit.type !== UNIT_TYPES.hero
  ).length
}
