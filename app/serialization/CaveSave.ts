import type { CaveDefinition } from '../types/cave'
import { fail, isObject } from './SaveValidationPrimitives'

export function validateCaveDefinition(value: unknown): asserts value is CaveDefinition {
  if (
    !isObject(value) ||
    typeof value.id !== 'string' ||
    !value.id ||
    !['small', 'medium', 'large'].includes(String(value.tier)) ||
    typeof value.blueprintId !== 'string' ||
    !new RegExp(`^cave-${value.tier}-(?:${value.tier === 'small' ? 'circle' : 'branches|loop|chamber'})$`).test(
      value.blueprintId
    ) ||
    !Number.isSafeInteger(value.seed) ||
    Number(value.seed) < 0
  ) {
    fail('Invalid cave definition.')
  }
}

export function validateCaveOccupantReferences(players: unknown[]): void {
  const records = players as Array<{
    buildings?: Array<{ cave?: CaveDefinition }>
    units?: Array<{ cavePosition?: unknown }>
    corpses?: Array<{ cavePosition?: unknown }>
  }>
  const caves = new Map<string, CaveDefinition>()
  for (const player of records)
    for (const building of player.buildings ?? []) {
      if (!building.cave) continue
      if (caves.has(building.cave.id)) fail('Duplicate cave identity.')
      caves.set(building.cave.id, building.cave)
    }
  for (const player of records)
    for (const unit of [...(player.units ?? []), ...(player.corpses ?? [])]) {
      if (unit.cavePosition == null) continue
      const value = unit.cavePosition
      if (!isObject(value) || typeof value.caveId !== 'string' || !caves.has(value.caveId)) fail('Missing saved cave.')
      const edge = caves.get(value.caveId)?.tier === 'large' ? 64 : 32
      if (
        ![value.i, value.j].every(
          coordinate => Number.isInteger(coordinate) && Number(coordinate) >= 0 && Number(coordinate) < edge
        )
      ) {
        fail('Invalid cave occupant position.')
      }
    }
}
