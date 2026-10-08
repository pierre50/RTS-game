import { getPlayerResourceTotals } from '../../lib/resources/playerResourceTotals'
import { savedResourceOwner } from '../world/offline/OfflineWorldWork'
import { deferredVillageState } from '../world/distantVillages/DeferredVillageStore'
import type { GameContextLike } from '../../types/context'

const living = (entity: { isDead?: boolean; isDestroyed?: boolean }) => !entity.isDead && !entity.isDestroyed
const signed = (value: number) => `${value > 0 ? '+' : ''}${Math.round(value * 100) / 100}`

/** Snapshot values, never references to mutable inventories. Deferred villages stay unloaded. */
export function captureTimeSkipReport(context: GameContextLike) {
  return {
    elapsed: context.dayNight!.getElapsedMs(),
    day: context.dayNight!.state.day,
    label:
      `${context.dayNight!.getDayLabel?.() ?? context.dayNight!.state.day} ${context.dayNight!.getTimeLabel?.() ?? ''}`.trim(),
    owners: new Map(
      (context.players ?? []).map(owner => {
        const saved = deferredVillageState(owner)
        const source = saved ?? owner
        const units = (source.units ?? []).filter(living)
        const buildings = (source.buildings ?? []).filter(living)
        const bags: Record<string, number> = {}
        const types: Record<string, number> = {}
        for (const unit of units) {
          types[unit.type] = (types[unit.type] ?? 0) + 1
          if (unit.type === 'Hero' || unit.controlMode === 'hero') continue
          for (const [key, amount] of Object.entries(unit.inventory?.resources ?? {}))
            bags[key] = (bags[key] ?? 0) + (amount ?? 0)
        }
        return [
          owner.label,
          {
            mode: source.developmentMode === 'static' ? 'static' : 'dynamic',
            deferred: Boolean(saved),
            stocks: { ...getPlayerResourceTotals(saved ? savedResourceOwner(saved) : owner, { includeHero: false }) },
            bags,
            types,
            built: buildings.filter(building => building.isBuilt).length,
            projects: buildings.filter(building => !building.isBuilt).length,
            training: buildings.reduce((total, building) => total + (building.trainingQueue?.length ?? 0), 0),
            health: units.reduce((total, unit) => total + (unit.hitPoints ?? 0), 0),
            energy: units.reduce((total, unit) => total + (unit.energy ?? 0), 0),
            meals: new Map(units.map(unit => [unit.label, unit.lastMealAt])),
          },
        ] as const
      })
    ),
  }
}

type Snapshot = ReturnType<typeof captureTimeSkipReport>

function deltas(before: Record<string, number>, after: Record<string, number>): string {
  return (
    [...new Set([...Object.keys(before), ...Object.keys(after)])]
      .filter(key => key !== 'food') // Food is an aggregate of the individual provisions.
      .sort()
      .flatMap(key => {
        const delta = (after[key] ?? 0) - (before[key] ?? 0)
        return Math.abs(delta) >= 0.005 ? [`${key} ${signed(delta)}`] : []
      })
      .join(', ') || 'unchanged'
  )
}

export function formatTimeSkipReport(before: Snapshot, after: Snapshot, completed: boolean, hourMs: number): string {
  const lines = [
    `nextday ${completed ? 'completed' : 'interrupted'}: ${before.label} → ${after.label}`,
    `${((after.elapsed - before.elapsed) / hourMs).toFixed(2)} / 24h; daily boundaries: ${after.day - before.day}`,
    'Net changes (production minus spending/meals; HP/energy totals also include arrivals):',
  ]
  for (const [label, current] of after.owners) {
    const previous = before.owners.get(label)
    if (!previous) continue
    const meals = [...current.meals].filter(
      ([unit, at]) => at != null && at > (previous.meals.get(unit) ?? -Infinity)
    ).length
    lines.push(
      `${label} [${current.mode}${current.deferred ? ', deferred' : ''}]`,
      `  stocks: ${deltas(previous.stocks, current.stocks)}; bags: ${deltas(previous.bags, current.bags)}`,
      `  units: ${deltas(previous.types, current.types)}; built ${signed(current.built - previous.built)}; projects ${signed(current.projects - previous.projects)}; training queue ${signed(current.training - previous.training)}`,
      `  HP ${signed(current.health - previous.health)}; energy ${signed(current.energy - previous.energy)}; meal checkpoints advanced: ${meals}`
    )
  }
  lines.push(
    'Static settlements keep their economic rules. Movement/combat are not replayed; danger can interrupt the simulation.'
  )
  return lines.join('\n')
}
