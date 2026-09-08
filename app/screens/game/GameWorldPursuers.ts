import { getGaiaAnimals } from '../../lib/playerState'
import { isOutsideSpaceId } from '../../lib/mapSpaces'
import { instanceIsInInsightRange } from '../../lib/units/insightDetection'
import type { GameContextLike } from '../../types/context'
import type { AnimalEntity, UnitEntity } from '../../types/entities'
import type { PendingWorldPursuer, SaveEntityState, SerializedSave } from '../../types/save'
import type { TravelPartyState } from './GameTravelParty'

export type WorldPursuer = Omit<PendingWorldPursuer, 'arrival' | 'remainingMs'>

export function collectWorldPursuers(
  context: GameContextLike,
  snapshot: SerializedSave,
  party: TravelPartyState
): WorldPursuer[] {
  const partyLabels = new Set([party.hero, ...party.followers].flatMap(unit => (unit?.label ? [unit.label] : [])))
  const result: WorldPursuer[] = []
  const collect = (
    entity: UnitEntity | AnimalEntity,
    saved: SaveEntityState | undefined,
    owner?: WorldPursuer['owner']
  ): void => {
    const target = entity.dest
    if (
      !saved?.label ||
      partyLabels.has(saved.label) ||
      entity.isDead ||
      entity.isDestroyed ||
      (entity.hitPoints ?? 1) <= 0
    )
      return
    if (!target || !('label' in target) || !target.label || !partyLabels.has(target.label)) return
    if (!isOutsideSpaceId(entity.spaceId) || !isOutsideSpaceId(target.spaceId)) return
    if (!instanceIsInInsightRange(entity, target)) return
    result.push({ entity: structuredClone(saved), owner, targetLabel: target.label })
  }
  for (const player of context.players ?? []) {
    const savedPlayer = snapshot.players.find(saved => saved.label === player.label)
    if (!savedPlayer) continue
    const owner = {
      label: savedPlayer.label,
      type: savedPlayer.type,
      isPlayed: savedPlayer.isPlayed,
      civ: savedPlayer.civ,
      color: savedPlayer.color,
      factionId: savedPlayer.factionId,
      name: savedPlayer.name,
      gender: savedPlayer.gender,
      heroAppearance: savedPlayer.heroAppearance,
      age: savedPlayer.age,
      technologies: savedPlayer.technologies,
      civilizationLevel: savedPlayer.civilizationLevel,
      team: savedPlayer.team,
      diplomacy: savedPlayer.diplomacy,
    }
    for (const unit of player.units)
      collect(
        unit,
        savedPlayer.units?.find(saved => saved.label === unit.label),
        owner
      )
  }
  for (const animal of getGaiaAnimals(context.map.gaia)) {
    collect(
      animal as AnimalEntity,
      snapshot.animals?.find(saved => saved.label === animal.label)
    )
  }
  return result
}

export function removeWorldPursuers(snapshot: SerializedSave, pursuers: WorldPursuer[]): SerializedSave {
  if (!pursuers.length) return snapshot
  const labels = new Set(pursuers.map(pursuer => pursuer.entity.label))
  const state = structuredClone(snapshot)
  for (const player of state.players) {
    const previousCount = player.units?.length ?? 0
    player.units = player.units?.filter(unit => !labels.has(unit.label))
    if (player.population != null)
      player.population = Math.max(0, player.population - previousCount + (player.units?.length ?? 0))
  }
  state.animals = state.animals.filter(animal => !labels.has(animal.label))
  for (const row of state.map ?? [])
    for (const cell of row) {
      if (cell?.has && labels.has(cell.has)) delete cell.has
    }
  return state
}
