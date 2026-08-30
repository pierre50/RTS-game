import { interiorCellKey } from '../../lib/buildings/interiorDecorations'
import { HORSE_TAMING_STATUS } from '../../lib/horses/horseTaming'
import {
  getStableInteriorHorseLabel,
  isStableInteriorSpace,
  type StableInteriorSpace,
} from '../../lib/horses/stableInteriorHorseIdentity'
import { getStableHorses, type StableHorse } from '../../lib/horses/stableHorses'
import type { GameContextLike } from '../../types/context'
import type { RuntimeEntity } from '../../types/entities'
import type { RuntimeCell, RuntimeMapSpace } from '../../types/map'

type StableInteriorHorseSpace = StableInteriorSpace & {
  sleepCells: RuntimeCell[]
}

function isInteriorFloorCell(cell: RuntimeCell | null | undefined): cell is RuntimeCell {
  return Boolean(cell && !cell.terrainHidden && !cell.border && !cell.waterBorder && cell.category !== 'Water')
}

function isStableInteriorHorseSpace(space: RuntimeMapSpace): space is StableInteriorHorseSpace {
  return isStableInteriorSpace(space) && Array.isArray((space as StableInteriorHorseSpace).sleepCells)
}

function isStableInteriorHorseForSpace(space: StableInteriorHorseSpace, entity: RuntimeEntity | null | undefined): boolean {
  return Boolean(
    entity &&
      entity.family === 'animal' &&
      entity.type === 'Horse' &&
      entity.spaceId === space.id &&
      entity.label?.startsWith(`${space.id}:stable-horse:`)
  )
}

function updateStableInteriorHorse(entity: RuntimeEntity, horse: StableHorse): void {
  Object.assign(entity, {
    ambientMovement: false,
    horseColor: horse.horseColor,
    strategy: undefined,
    tamingStatus: HORSE_TAMING_STATUS.tamed,
  })
  entity.animalBehavior?.stop?.()
  entity.updateTexture?.()
}

function findStableInteriorHorseCell(space: StableInteriorHorseSpace, usedCells: Set<string>): RuntimeCell | null {
  for (const cell of space.sleepCells) {
    if (usedCells.has(interiorCellKey(cell))) continue
    if (!isInteriorFloorCell(cell) || cell.has || cell.solid) continue
    return cell
  }
  return null
}

export function syncStableInteriorHorses(context: GameContextLike, space: RuntimeMapSpace): void {
  if (!isStableInteriorHorseSpace(space)) return
  const createAnimal = context.map.gaia?.createAnimal
  const expectedHorses = getStableHorses(space.building)
  const existingHorses = (context.map.gaia?.animals ?? []).filter(entity => isStableInteriorHorseForSpace(space, entity))
  const existingByLabel = new Map(existingHorses.map(entity => [entity.label, entity]))
  const expectedLabels = new Set(expectedHorses.map((_, index) => getStableInteriorHorseLabel(space.id, index)))
  const usedCells = new Set<string>()

  for (const entity of existingHorses) {
    if (!expectedLabels.has(entity.label)) {
      entity.clear?.()
      continue
    }
    if (entity.currentCell) usedCells.add(interiorCellKey(entity.currentCell))
  }

  expectedHorses.forEach((horse, index) => {
    const label = getStableInteriorHorseLabel(space.id, index)
    const existing = existingByLabel.get(label)
    if (existing && !existing.isDestroyed) {
      updateStableInteriorHorse(existing, horse)
      return
    }
    if (typeof createAnimal !== 'function') return
    const cell = findStableInteriorHorseCell(space, usedCells)
    if (!cell) return
    usedCells.add(interiorCellKey(cell))
    const entity = createAnimal.call(context.map.gaia, {
      i: cell.i,
      j: cell.j,
      spaceId: space.id,
      type: 'Horse',
      horseColor: horse.horseColor,
      tamingStatus: HORSE_TAMING_STATUS.tamed,
      ambientMovement: false,
      strategy: undefined,
    })
    entity.label = label
    updateStableInteriorHorse(entity, horse)
  })
}
