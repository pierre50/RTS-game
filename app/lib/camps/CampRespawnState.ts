import type { GridPosition } from '../../types/grid'

export type CampRespawnState = GridPosition & {
  id: string
  unitTypes: string[]
  caveId?: string
  clearedAtMs?: number
  generation: number
}

const states = new WeakMap<object, CampRespawnState[]>()

export function campRespawnStates(map: object): CampRespawnState[] {
  let entries = states.get(map)
  if (!entries) states.set(map, (entries = []))
  return entries
}

export function restoreCampRespawnStates(map: object, entries: CampRespawnState[]): void {
  states.set(
    map,
    entries.map(entry => ({ ...entry, unitTypes: [...entry.unitTypes] }))
  )
}

export function serializeCampRespawnStates(map: object): CampRespawnState[] {
  return campRespawnStates(map).map(entry => ({ ...entry, unitTypes: [...entry.unitTypes] }))
}
