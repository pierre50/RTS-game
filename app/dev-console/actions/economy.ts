import { DAY_NIGHT_CONFIG } from '../../config/gameplay'
import { getPlayerResourceTotals } from '../../lib/resources/playerResourceTotals'
import type { CommandResult, DevConsoleContext } from '../types'
import type { RegionEconomySave } from '../../types/save'

type EconomyRow = RegionEconomySave['summaries'][string] & {
  player: string
  civilization: string
  region: string
  mode: string
  simulatedUntilMs: number
}

function counts(items: Array<{ type: string }>): Record<string, number> {
  const result: Record<string, number> = {}
  for (const item of items) result[item.type] = (result[item.type] ?? 0) + 1
  return result
}

const living = (entity: { isDead?: boolean; isDestroyed?: boolean }) => !entity.isDead && !entity.isDestroyed
const amounts = (values: object) =>
  Object.entries(values)
    .filter(([, value]) => Number(value) !== 0)
    .map(([key, value]) => `${key}: ${value}`)
    .join(', ') || '-'

export function economyReport(args: string[], context: DevConsoleContext): CommandResult {
  const json = args.includes('--json')
  const filters = args.filter(arg => arg !== '--json')
  if (filters.length > 1) return { ok: false, message: 'Usage: economy [all|civilization|player|region] [--json]' }
  const filter = (filters[0] ?? 'all').toLowerCase()
  const now = context.dayNight?.getElapsedMs?.() ?? 0
  const activeWorld = context.getCurrentWorldId?.()
  const regions = Object.values(context.getCampaignEconomy?.()?.regions ?? {})
  const activeRegion = regions.find(region => region.worldId === activeWorld)
  const rows: EconomyRow[] = context.players.map(player => {
    const buildings = player.buildings.filter(living)
    const units = player.units.filter(living)
    return {
      player: player.factionId || player.label || player.civ || 'player',
      civilization: player.civ ?? '',
      region: activeRegion?.regionId ?? activeWorld ?? 'active',
      mode: 'live',
      simulatedUntilMs: now,
      population: player.population ?? units.length,
      populationMax: player.populationMax,
      stocks: getPlayerResourceTotals(player, { includeHero: false }),
      military: counts(units.filter(unit => unit.type !== 'Villager' && unit.type !== 'Hero')),
      buildings: counts(buildings.filter(building => building.isBuilt)),
      constructionProjects: buildings.filter(building => !building.isBuilt).length,
      trainingProjects: buildings.reduce((total, building) => total + (building.trainingQueue?.length ?? 0), 0),
      idleWorkers: units.filter(unit => unit.type === 'Villager' && unit.inactif).length,
    }
  })
  for (const region of regions) {
    if (region === activeRegion) continue
    for (const [id, summary] of Object.entries(region.summaries)) {
      rows.push({
        ...summary,
        player: id,
        civilization: context.getCampaignFactions?.()?.[id]?.civilization ?? id.replace(/^civ-/, ''),
        region: region.regionId,
        mode: region.worldId ? 'offscreen / visited' : 'offscreen / unvisited',
        simulatedUntilMs: region.simulatedUntilMs,
      })
    }
  }
  const selected = rows.filter(
    row =>
      filter === 'all' || [row.player, row.civilization, row.region].some(value => value.toLowerCase().includes(filter))
  )
  if (!selected.length) return { ok: false, message: `No economy matches "${filter}". Use economy all.` }
  if (json) return { ok: true, message: JSON.stringify(selected, null, 2) }
  return {
    ok: true,
    message: selected
      .map(row => {
        const days = row.simulatedUntilMs / DAY_NIGHT_CONFIG.dayLengthMs
        const delay = Math.max(0, now - row.simulatedUntilMs) / DAY_NIGHT_CONFIG.dayLengthMs
        return [
          `${row.civilization || row.player} (${row.player}) | ${row.mode}`,
          `Region: ${row.region}`,
          `Simulated: ${days.toFixed(2)} days since start | pending: ${delay.toFixed(2)} days`,
          `Population: ${row.population}/${row.populationMax} | construction: ${row.constructionProjects} | training: ${row.trainingProjects}`,
          `Stocks (without hero): ${amounts(row.stocks)}`,
          `Buildings: ${amounts(row.buildings)}`,
          ...(row.constructionDecision ? [`Last offscreen construction decision: ${row.constructionDecision}`] : []),
          `Military: ${amounts(row.military)}`,
        ].join('\n')
      })
      .join('\n\n'),
  }
}
