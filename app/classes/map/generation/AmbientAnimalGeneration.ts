import { hasWaterBorderWithin } from '../../../lib'
import { AMBIENT_ANIMAL_CHANCE, ANIMAL_PLAYER_SAFE_DIST, WATER_BORDER_PLACEMENT_CLEARANCE } from '../../../constants'
import type { AnimalOptions } from '../../animal/Animal'
import type { GridPosition } from '../../../types/grid'
import type { RuntimeCell, RuntimeMap } from '../../../types/map'
import type { RuntimeEntity } from '../../../types/entities'

export type AmbientAnimalProfile = {
  weight: number
  groupChance: number
  groupSize: [min: number, max: number]
  radius: number
}

type AmbientAnimalMap = Pick<RuntimeMap, 'grid' | 'random' | 'randomRange' | 'randomItem'>
type AnimalCreator = (options: AnimalOptions) => void

const DEFAULT_AMBIENT_ANIMAL_PROFILE: AmbientAnimalProfile = {
  weight: 1,
  groupChance: 0.35,
  groupSize: [1, 2],
  radius: 2,
}
const AMBIENT_ANIMAL_PROFILES: Record<string, AmbientAnimalProfile> = {
  Deer: { weight: 4, groupChance: 0.9, groupSize: [3, 6], radius: 3 },
  Hare: { weight: 3, groupChance: 0.55, groupSize: [1, 4], radius: 2 },
  BlackGrouse: { weight: 3, groupChance: 0.75, groupSize: [2, 5], radius: 2 },
  Fox: { weight: 1, groupChance: 0.2, groupSize: [1, 2], radius: 3 },
  Boar: { weight: 0.7, groupChance: 0.15, groupSize: [1, 2], radius: 2 },
  Horse: { weight: 1.4, groupChance: 0.65, groupSize: [2, 4], radius: 3 },
}
const ANIMAL_HABITAT_WEIGHTS: Record<string, Record<string, number>> = {
  Grass: { Deer: 1.15, Hare: 1.1, BlackGrouse: 1.15, Fox: 0.85, Boar: 0.75, Horse: 1.25 },
  DarkForest: { Deer: 1.1, Hare: 0.85, BlackGrouse: 0.8, Fox: 1.2, Boar: 1.4, Horse: 0.75 },
  Jungle: { Deer: 0.85, Hare: 0.85, BlackGrouse: 0.75, Fox: 1.05, Boar: 1.15, Horse: 0.65 },
  Desert: { Deer: 0.5, Hare: 1.05, BlackGrouse: 0.5, Fox: 1.1, Boar: 0.45, Horse: 0.9 },
  Steppe: { Deer: 0.8, Hare: 1.2, BlackGrouse: 1.05, Fox: 0.8, Boar: 0.35, Horse: 3.2 },
}

function pickWeightedItem<T>(random: () => number, entries: Array<[T, number]>): T {
  const total = entries.reduce((sum, [, weight]) => sum + Math.max(weight, 0), 0)
  if (total <= 0) return entries[0][0]
  let roll = random() * total
  for (const [item, weight] of entries) {
    roll -= Math.max(weight, 0)
    if (roll <= 0) return item
  }
  return entries[entries.length - 1][0]
}

export function getAmbientAnimalProfile(type: string): AmbientAnimalProfile {
  return AMBIENT_ANIMAL_PROFILES[type] ?? DEFAULT_AMBIENT_ANIMAL_PROFILE
}

export function pickAmbientAnimalType(options: {
  animals: Record<string, unknown>
  biome: string
  isInPlayerStartSafeZone: (radius: number) => boolean
  random: () => number
}): string {
  const excludedGeneratedAnimalTypes = new Set(['Wolf'])
  const dangerousAnimalTypes = new Set(['Boar'])
  const availableTypes = Object.keys(options.animals).filter(type => {
    if (excludedGeneratedAnimalTypes.has(type)) return false
    return !dangerousAnimalTypes.has(type) || !options.isInPlayerStartSafeZone(20)
  })
  const types = availableTypes.length ? availableTypes : Object.keys(options.animals)
  const habitatMultipliers = ANIMAL_HABITAT_WEIGHTS[options.biome] ?? {}
  const weightedEntries: Array<[string, number]> = types.map(type => [
    type,
    getAmbientAnimalProfile(type).weight * (habitatMultipliers[type] ?? 1),
  ])

  return pickWeightedItem(options.random, weightedEntries)
}

export function canPlaceAmbientAnimalAt(
  map: AmbientAnimalMap,
  i: number,
  j: number,
  options: {
    hasWaterNeighbor: () => boolean
    isInPlayerStartSafeZone: (radius: number) => boolean
  }
): boolean {
  const cell = map.grid[i]?.[j]
  return Boolean(
    cell &&
      !cell.solid &&
      !cell.has &&
      !cell.border &&
      !cell.waterBorder &&
      !hasWaterBorderWithin(map.grid, i, j, WATER_BORDER_PLACEMENT_CLEARANCE) &&
      !cell.inclined &&
      cell.category !== 'Water' &&
      !options.hasWaterNeighbor() &&
      !options.isInPlayerStartSafeZone(ANIMAL_PLAYER_SAFE_DIST)
  )
}

export function placeAmbientAnimalGroup(
  map: AmbientAnimalMap,
  i: number,
  j: number,
  type: string,
  options: {
    canPlace: (i: number, j: number) => boolean
    createAnimal: AnimalCreator
  }
): void {
  if (!options.canPlace(i, j)) return

  const profile = getAmbientAnimalProfile(type)
  const shouldGroup = map.random() < profile.groupChance
  const targetSize = shouldGroup ? map.randomRange(profile.groupSize[0], profile.groupSize[1]) : 1
  const candidates: GridPosition[] = [{ i, j }]

  for (let di = -profile.radius; di <= profile.radius; di++) {
    for (let dj = -profile.radius; dj <= profile.radius; dj++) {
      if (di === 0 && dj === 0) continue
      if (di * di + dj * dj > profile.radius * profile.radius) continue
      const ni = i + di
      const nj = j + dj
      if (options.canPlace(ni, nj)) candidates.push({ i: ni, j: nj })
    }
  }

  const toPlace = Math.min(targetSize, candidates.length)
  for (let index = 0; index < toPlace; index++) {
    const candidateIndex = index === 0 ? 0 : map.randomRange(0, candidates.length - 1)
    const cell = candidates.splice(candidateIndex, 1)[0]
    options.createAnimal({ i: cell.i, j: cell.j, type })
  }
}

export function generateAmbientAnimalSets(
  map: AmbientAnimalMap & { size: number },
  options: {
    hasSolidNeighbor: (i: number, j: number) => boolean
    hasWaterNeighbor: (i: number, j: number) => boolean
    pickType: (i: number, j: number) => string
    placeGroup: (i: number, j: number, type: string) => void
  }
): void {
  for (let i = 0; i <= map.size; i++) {
    for (let j = 0; j <= map.size; j++) {
      if (shouldSpawnAmbientAnimal(map, i, j, options)) {
        options.placeGroup(i, j, options.pickType(i, j))
      }
    }
  }
}

export async function generateAmbientAnimalSetsAsync(
  map: AmbientAnimalMap & { pregeneratedBlueprintId?: string | null; size: number },
  options: {
    hasSolidNeighbor: (i: number, j: number) => boolean
    hasWaterNeighbor: (i: number, j: number) => boolean
    pickType: (i: number, j: number) => string
    placeGroup: (i: number, j: number, type: string) => void
    yieldToBrowser: () => Promise<void>
  }
): Promise<void> {
  for (let i = 0; i <= map.size; i++) {
    for (let j = 0; j <= map.size; j++) {
      if (shouldSpawnAmbientAnimal(map, i, j, options)) {
        options.placeGroup(i, j, options.pickType(i, j))
      }
    }
    const yieldEvery = map.pregeneratedBlueprintId ? 32 : 8
    if (i % yieldEvery === 0) await options.yieldToBrowser()
  }
}

function shouldSpawnAmbientAnimal(
  map: AmbientAnimalMap,
  i: number,
  j: number,
  options: {
    hasSolidNeighbor: (i: number, j: number) => boolean
    hasWaterNeighbor: (i: number, j: number) => boolean
  }
): boolean {
  const cell = map.grid[i][j]
  if (options.hasSolidNeighbor(i, j) || cell.has || cell.solid || cell.border || cell.inclined) return false
  const hasWaterBorderClearance = hasWaterBorderWithin(map.grid, i, j, WATER_BORDER_PLACEMENT_CLEARANCE)
  return (
    !options.hasWaterNeighbor(i, j) &&
    !hasWaterBorderClearance &&
    cell.category !== 'Water' &&
    map.random() < AMBIENT_ANIMAL_CHANCE
  )
}

export function createSpawnSearchCell(
  i: number,
  j: number,
  terrainType: 0 | 1 | 2 | 3 | 4 | 5 | 7
): RuntimeCell {
  return {
    i,
    j,
    x: 0,
    y: 0,
    z: 0,
    type: terrainType === 2 ? 'Water' : 'Land',
    category: terrainType === 2 ? 'Water' : 'Land',
    border: false,
    waterBorder: false,
    solid: false,
    visible: false,
    inclined: false,
    has: null,
    corpses: new Set(),
    fogSprites: [],
    viewBy: new Set(),
    updateVisible() {},
    place(entity: RuntimeEntity) {
      this.has = entity
    },
    setFog() {},
    removeFog() {},
  }
}
