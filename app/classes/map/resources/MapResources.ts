import { Resource } from '../../Resource'
import {
  RESOURCE_TYPES,
  BIOME_TREE_CHANCE,
  BIOME_TREE_PLAYER_SAFE_DIST,
  WATER_BORDER_PLACEMENT_CLEARANCE,
  getEnvironmentTerrainParams,
} from '../../../constants'
import { hasWaterBorderWithin } from '../../../lib'
import { NATURAL_RESOURCE_REGROWTH_BY_TYPE } from '../../../config/gameplay'
import { generateForestAroundPlayer as generateForestAroundPlayerResources } from './MapForestResources'
import { hasSpacedResourceAround } from './MapResourceSpacing'
import {
  NEUTRAL_RESOURCE_QUANTITY_RANGES,
  SCATTERED_STONE_QUANTITY_RANGE,
  rollResourceQuantity,
} from './ResourceQuantityRanges'
import { pickTreeTextureNameForFamily, type TreeTextureFamily } from './TreeResourceTextures'
import type { ContainerChild } from 'pixi.js'
import type { GridPosition } from '../../../types/grid'
import type { RuntimeCell } from '../../../types/map'
import type { ResourceEntity } from '../../../types/entities'
import type { SaveEntityState } from '../../../types/save'

export type ResourceDensity = keyof typeof RESOURCE_DENSITY_PROFILES
type NeutralResourceProfileKey = keyof (typeof RESOURCE_DENSITY_PROFILES)['moderate']['neutralGroups']
type ResourceType = string
type ScatteredHerbProfile = {
  type: ResourceType
  countMultiplier: Partial<Record<string, number>>
}
type ResourceGroupEntry = {
  type: ResourceType
  quantity: number
  clusterRadius: number
  playerSafeDistance: number
  minNeutralDistance: number
}
type NeutralResourceGroup = ResourceGroupEntry & {
  profileKey: NeutralResourceProfileKey
}
type ResourceCenter = GridPosition
type ResourcePlacementOptions = {
  isNaturalResource?: boolean
  textureName?: string
  textureNameFactory?: () => string | undefined
  playerAvoidPositions?: GridPosition[]
  playerClearance?: number
  quantity?: number
  totalQuantity?: number
  startsMature?: boolean
}
type TreeResourceGenerationOptions = {
  treeTextureFamily?: TreeTextureFamily | null
}

const RELOCATED_RESPAWN_TYPES = new Set<string>([RESOURCE_TYPES.berrybush, RESOURCE_TYPES.wheat])
const PLAYER_START_RESOURCE_CLEARANCE = 6
type MapResourcesMap = {
  context: object
  grid: RuntimeCell[][]
  size: number
  mapType?: string
  environment?: string
  resourceDensity?: ResourceDensity
  resources: Set<ResourceEntity>
  random(): number
  randomRange(min: number, max: number): number
  randomItem<T>(items: T[]): T
  addChild<T extends ContainerChild>(child: T): T
  placeResourceGroupAt(
    center: GridPosition,
    type: ResourceType,
    quantity: number,
    clusterRadius?: number,
    options?: ResourcePlacementOptions
  ): boolean
  respawnNaturalResource?(slot: SaveEntityState): boolean
  naturalResourceRespawnSlots?: SaveEntityState[]
  generateForestAroundPlayer(player: GridPosition, treeCount: number): void
  findNeutralResourceCenter(
    playersPos: GridPosition[],
    placedCenters: GridPosition[],
    playerSafeDistance: number,
    minNeutralDistance: number
  ): GridPosition | null
}

const NEUTRAL_RESOURCE_GROUPS: NeutralResourceGroup[] = [
  {
    type: RESOURCE_TYPES.berrybush,
    profileKey: 'berrybush',
    quantity: 5,
    clusterRadius: 2,
    playerSafeDistance: PLAYER_START_RESOURCE_CLEARANCE,
    minNeutralDistance: 28,
  },
  {
    type: RESOURCE_TYPES.wheat,
    profileKey: 'wheat',
    quantity: 4,
    clusterRadius: 2,
    playerSafeDistance: PLAYER_START_RESOURCE_CLEARANCE,
    minNeutralDistance: 28,
  },
  {
    type: RESOURCE_TYPES.stone,
    profileKey: 'stone',
    quantity: 4,
    clusterRadius: 2,
    playerSafeDistance: PLAYER_START_RESOURCE_CLEARANCE,
    minNeutralDistance: 24,
  },
  {
    type: RESOURCE_TYPES.copper,
    profileKey: 'copper',
    quantity: 3,
    clusterRadius: 2,
    playerSafeDistance: PLAYER_START_RESOURCE_CLEARANCE,
    minNeutralDistance: 26,
  },
  {
    type: RESOURCE_TYPES.iron,
    profileKey: 'iron',
    quantity: 2,
    clusterRadius: 2,
    playerSafeDistance: PLAYER_START_RESOURCE_CLEARANCE,
    minNeutralDistance: 30,
  },
  {
    // Gold is a rare one-tile "vein" rather than a multi-tile mine: see
    // NEUTRAL_RESOURCE_QUANTITY_RANGES for its (tiny) per-tile amount.
    type: RESOURCE_TYPES.gold,
    profileKey: 'gold',
    quantity: 1,
    clusterRadius: 1,
    playerSafeDistance: PLAYER_START_RESOURCE_CLEARANCE,
    minNeutralDistance: 34,
  },
]

function createResource(
  map: MapResourcesMap,
  i: number,
  j: number,
  type: ResourceType,
  options: ResourcePlacementOptions = {}
): ResourceEntity {
  return map.addChild(
    new Resource(
      {
        i,
        j,
        type,
        isNaturalResource: options.isNaturalResource ?? true,
        textureName: options.textureName,
        quantity: options.quantity,
        totalQuantity: options.totalQuantity,
        startsMature: options.startsMature,
      },
      map.context as ConstructorParameters<typeof Resource>[1]
    )
  )
}

function berryBushTextureName(frame: number): string {
  return `${String(frame).padStart(3, '0')}_resources/berrybush`
}

const RESOURCE_DENSITY_PROFILES = {
  low: {
    // Gold is intentionally near-absent at low density: it's a rare find, not a resource
    // a game is expected to always provide.
    neutralGroups: { berrybush: 1, wheat: 1, stone: 2, copper: 1, iron: 1, gold: 0, tree: 3 },
    minNeutralDistance: 34,
    playerSafeDistance: PLAYER_START_RESOURCE_CLEARANCE,
  },
  moderate: {
    neutralGroups: { berrybush: 2, wheat: 2, stone: 3, copper: 2, iron: 1, gold: 1, tree: 4 },
    minNeutralDistance: 32,
    playerSafeDistance: PLAYER_START_RESOURCE_CLEARANCE,
  },
  high: {
    neutralGroups: { berrybush: 4, wheat: 4, stone: 5, copper: 4, iron: 3, gold: 1, tree: 7 },
    minNeutralDistance: 26,
    playerSafeDistance: PLAYER_START_RESOURCE_CLEARANCE,
  },
}

const SCATTERED_STONE_PROFILES: Record<ResourceDensity, number> = {
  low: 4,
  moderate: 8,
  high: 14,
}

const SCATTERED_STONE_ENVIRONMENT_MULTIPLIERS: Record<string, number> = {
  Temperate: 1,
  BlackForest: 0.8,
  Jungle: 0.6,
  Desert: 1,
  Steppe: 0.9,
}

const SCATTERED_STONE_PLAYER_SAFE_DISTANCE = PLAYER_START_RESOURCE_CLEARANCE
const SCATTERED_STONE_RESOURCE_CLEARANCE = 7
const SCATTERED_HERB_PLAYER_SAFE_DISTANCE = PLAYER_START_RESOURCE_CLEARANCE
const SCATTERED_HERB_RESOURCE_CLEARANCE = 4

const SCATTERED_HERB_PROFILES: Record<ResourceDensity, number> = {
  low: 10,
  moderate: 20,
  high: 32,
}

const SCATTERED_HERBS: ScatteredHerbProfile[] = [
  {
    type: RESOURCE_TYPES.medicinalHerb,
    countMultiplier: {
      Temperate: 1.2,
      BlackForest: 0.85,
      Jungle: 1,
      Desert: 0.3,
      Steppe: 0.8,
    },
  },
  {
    type: RESOURCE_TYPES.toxicHerb,
    countMultiplier: {
      Temperate: 0.65,
      BlackForest: 1.25,
      Jungle: 1.4,
      Desert: 0.4,
      Steppe: 0.5,
    },
  },
  {
    type: RESOURCE_TYPES.fiberPlant,
    countMultiplier: {
      Temperate: 1,
      BlackForest: 0.9,
      Jungle: 1.15,
      Desert: 0.25,
      Steppe: 0.85,
    },
  },
]

const ENVIRONMENT_NEUTRAL_RESOURCE_MULTIPLIERS: Record<string, Partial<Record<NeutralResourceProfileKey, number>>> = {
  Temperate: {
    berrybush: 1,
    wheat: 1,
    stone: 1,
    copper: 1,
    iron: 1,
    gold: 1,
    tree: 1,
  },
  BlackForest: {
    berrybush: 0.8,
    wheat: 0.5,
    stone: 0.8,
    copper: 0.75,
    iron: 0.7,
    gold: 0.85,
    tree: 1,
  },
  Jungle: {
    berrybush: 1.1,
    wheat: 0.45,
    stone: 0.7,
    copper: 0.7,
    iron: 0.65,
    gold: 0.8,
    tree: 1,
  },
  Desert: {
    berrybush: 0.25,
    wheat: 0.1,
    stone: 0.7,
    copper: 0.8,
    iron: 0.7,
    gold: 1,
    tree: 0.3,
  },
  Steppe: {
    berrybush: 0.75,
    wheat: 1.2,
    stone: 0.9,
    copper: 0.85,
    iron: 0.75,
    gold: 0.8,
    tree: 4,
  },
}

export function getNeutralResourceGroupCount(
  resourceDensity: ResourceDensity | undefined,
  environment: string | undefined,
  profileKey: NeutralResourceProfileKey,
  mapSize: number
): number {
  const profile = RESOURCE_DENSITY_PROFILES[resourceDensity as ResourceDensity] ?? RESOURCE_DENSITY_PROFILES.moderate
  const sizeScale = Math.max(1, Math.round((mapSize / 120) ** 2))
  const resourceMultiplier = ENVIRONMENT_NEUTRAL_RESOURCE_MULTIPLIERS[environment ?? '']?.[profileKey] ?? 1
  const terrainMultiplier = profileKey === 'tree' ? getEnvironmentTerrainParams(environment).forestDensity : 1

  return Math.round(profile.neutralGroups[profileKey] * resourceMultiplier * terrainMultiplier) * sizeScale
}

export function getScatteredStoneCount(
  resourceDensity: ResourceDensity | undefined,
  environment: string | undefined,
  mapSize: number
): number {
  const density = resourceDensity as ResourceDensity
  const baseCount = SCATTERED_STONE_PROFILES[density] ?? SCATTERED_STONE_PROFILES.moderate
  const environmentMultiplier = SCATTERED_STONE_ENVIRONMENT_MULTIPLIERS[environment ?? ''] ?? 1
  const sizeScale = Math.max(1, Math.round((mapSize / 120) ** 2))

  return Math.round(baseCount * environmentMultiplier) * sizeScale
}

export function getScatteredHerbCount(
  resourceDensity: ResourceDensity | undefined,
  environment: string | undefined,
  mapSize: number,
  herb: ScatteredHerbProfile
): number {
  const density = resourceDensity as ResourceDensity
  const baseCount = SCATTERED_HERB_PROFILES[density] ?? SCATTERED_HERB_PROFILES.moderate
  const environmentMultiplier = herb.countMultiplier[environment ?? ''] ?? 0
  const sizeScale = Math.max(1, Math.round((mapSize / 120) ** 2))
  return Math.round(baseCount * environmentMultiplier * sizeScale)
}

function shuffled<T>(items: T[], random: () => number): T[] {
  const result = [...items]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    const item = result[i]
    result[i] = result[j]
    result[j] = item
  }
  return result
}

export class MapResources {
  map: MapResourcesMap

  constructor(map: MapResourcesMap) {
    this.map = map
  }

  generateForestAroundPlayer(
    player: GridPosition,
    treeCount: number,
    clusterCount: number = 12,
    minClusterRadius: number = 5,
    maxClusterRadius: number = 10,
    safeDistance: number = PLAYER_START_RESOURCE_CLEARANCE,
    clearingProbability: number = 0.6,
    options: TreeResourceGenerationOptions = {}
  ): void {
    generateForestAroundPlayerResources(
      this.map,
      player,
      treeCount,
      clusterCount,
      minClusterRadius,
      maxClusterRadius,
      safeDistance,
      clearingProbability,
      options
    )
  }

  async generateNeutralResourceGroupsAsync(
    playersPos: GridPosition[],
    options: TreeResourceGenerationOptions = {}
  ): Promise<void> {
    const profile =
      RESOURCE_DENSITY_PROFILES[this.map.resourceDensity as ResourceDensity] ?? RESOURCE_DENSITY_PROFILES.moderate
    const placedCenters: GridPosition[] = []
    const groupEntries: ResourceGroupEntry[] = []
    for (const group of NEUTRAL_RESOURCE_GROUPS) {
      const count = getNeutralResourceGroupCount(
        this.map.resourceDensity,
        this.map.environment,
        group.profileKey,
        this.map.size
      )
      for (let i = 0; i < count; i++) groupEntries.push(group)
    }
    const treeGroupCount = getNeutralResourceGroupCount(
      this.map.resourceDensity,
      this.map.environment,
      'tree',
      this.map.size
    )
    const treeParams = getEnvironmentTerrainParams(this.map.environment)
    const treeNeutralDistanceFactor =
      this.map.environment === 'Steppe' ? 0.5 : treeParams.forestDensity < 0.15 ? 1.15 : 1
    for (let i = 0; i < treeGroupCount; i++) {
      groupEntries.push({
        type: RESOURCE_TYPES.tree,
        quantity: 14,
        clusterRadius: 4,
        playerSafeDistance: profile.playerSafeDistance,
        minNeutralDistance: Math.round(profile.minNeutralDistance * treeNeutralDistanceFactor),
      })
    }
    let batch = 0
    for (const group of shuffled(groupEntries, () => this.map.random())) {
      const center = this.map.findNeutralResourceCenter(
        playersPos,
        placedCenters,
        group.playerSafeDistance,
        group.minNeutralDistance
      )
      const placementOptions: ResourcePlacementOptions = {
        playerAvoidPositions: playersPos,
        playerClearance: PLAYER_START_RESOURCE_CLEARANCE,
      }
      if (group.type === RESOURCE_TYPES.wheat) {
        placementOptions.startsMature = true
      } else if (group.type === RESOURCE_TYPES.tree) {
        placementOptions.textureNameFactory = () => this.pickTreeTextureName(options.treeTextureFamily)
      }
      if (
        center &&
        this.map.placeResourceGroupAt(center, group.type, group.quantity, group.clusterRadius, placementOptions)
      ) {
        placedCenters.push(center)
      }
      if (++batch % 4 === 0) {
        await new Promise<void>(resolve => requestAnimationFrame(() => resolve()))
      }
    }
    await this.generateScatteredStoneAsync(playersPos)
    await this.generateScatteredHerbsAsync(playersPos)
  }

  async generateScatteredStoneAsync(playersPos: GridPosition[]): Promise<void> {
    const { grid } = this.map
    const count = getScatteredStoneCount(this.map.resourceDensity, this.map.environment, this.map.size)
    const playerSafeDistanceSq = SCATTERED_STONE_PLAYER_SAFE_DISTANCE ** 2
    const border = 8
    let placed = 0
    let batch = 0

    for (let attempt = 0; attempt < count * 80 && placed < count; attempt++) {
      const i = this.map.randomRange(border, this.map.size - border)
      const j = this.map.randomRange(border, this.map.size - border)
      const cell = grid[i]?.[j]
      if (!cell || cell.solid || cell.category === 'Water' || cell.has || cell.border || cell.inclined) continue
      if (hasWaterBorderWithin(grid, i, j, WATER_BORDER_PLACEMENT_CLEARANCE)) continue
      if (hasSpacedResourceAround(grid, i, j, SCATTERED_STONE_RESOURCE_CLEARANCE)) continue

      const tooCloseToPlayer = playersPos.some(pos => (pos.i - i) ** 2 + (pos.j - j) ** 2 < playerSafeDistanceSq)
      if (tooCloseToPlayer) continue

      const rolledQuantity = rollResourceQuantity(() => this.map.random(), SCATTERED_STONE_QUANTITY_RANGE)
      this.map.resources.add(
        createResource(this.map, i, j, RESOURCE_TYPES.stone, {
          quantity: rolledQuantity,
          totalQuantity: rolledQuantity,
        })
      )
      placed++

      if (++batch % 12 === 0) {
        await new Promise<void>(resolve => requestAnimationFrame(() => resolve()))
      }
    }
  }

  async generateScatteredHerbsAsync(playersPos: GridPosition[]): Promise<void> {
    const { grid } = this.map
    const playerSafeDistanceSq = SCATTERED_HERB_PLAYER_SAFE_DISTANCE ** 2
    const border = 8
    let batch = 0

    for (const herb of shuffled(SCATTERED_HERBS, () => this.map.random())) {
      const count = getScatteredHerbCount(this.map.resourceDensity, this.map.environment, this.map.size, herb)
      let placed = 0
      for (let attempt = 0; attempt < count * 120 && placed < count; attempt++) {
        const i = this.map.randomRange(border, this.map.size - border)
        const j = this.map.randomRange(border, this.map.size - border)
        const cell = grid[i]?.[j]
        if (!cell || cell.solid || cell.category === 'Water' || cell.has || cell.border || cell.inclined) continue
        if (hasWaterBorderWithin(grid, i, j, WATER_BORDER_PLACEMENT_CLEARANCE)) continue
        if (hasSpacedResourceAround(grid, i, j, SCATTERED_HERB_RESOURCE_CLEARANCE)) continue

        const tooCloseToPlayer = playersPos.some(pos => (pos.i - i) ** 2 + (pos.j - j) ** 2 < playerSafeDistanceSq)
        if (tooCloseToPlayer) continue

        const rolledQuantity = rollResourceQuantity(
          () => this.map.random(),
          NEUTRAL_RESOURCE_QUANTITY_RANGES[herb.type]
        )
        this.map.resources.add(
          createResource(this.map, i, j, herb.type, {
            quantity: rolledQuantity,
            totalQuantity: rolledQuantity,
          })
        )
        placed++

        if (++batch % 12 === 0) {
          await new Promise<void>(resolve => requestAnimationFrame(() => resolve()))
        }
      }
    }
  }

  findNeutralResourceCenter(
    playersPos: GridPosition[],
    placedCenters: GridPosition[],
    playerSafeDistance: number,
    minNeutralDistance: number
  ): GridPosition | null {
    const border = 10
    const playerSafeDistanceSq = playerSafeDistance ** 2
    const minNeutralDistanceSq = minNeutralDistance ** 2

    for (let attempt = 0; attempt < 300; attempt++) {
      const i = this.map.randomRange(border, this.map.size - border)
      const j = this.map.randomRange(border, this.map.size - border)
      const cell = this.map.grid[i]?.[j]
      if (!cell || cell.solid || cell.category === 'Water' || cell.has || cell.border || cell.inclined) continue
      if (hasWaterBorderWithin(this.map.grid, i, j, WATER_BORDER_PLACEMENT_CLEARANCE)) continue

      const tooCloseToPlayer = playersPos.some(pos => (pos.i - i) ** 2 + (pos.j - j) ** 2 < playerSafeDistanceSq)
      if (tooCloseToPlayer) continue

      const tooCloseToGroup = placedCenters.some(pos => (pos.i - i) ** 2 + (pos.j - j) ** 2 < minNeutralDistanceSq)
      if (tooCloseToGroup) continue

      return { i, j }
    }

    return null
  }

  placeResourceGroupAt(
    center: GridPosition,
    instance: ResourceType,
    quantity: number,
    clusterRadius: number = 2,
    options: ResourcePlacementOptions = {}
  ): boolean {
    const { grid } = this.map
    const playerAvoidPositions = options.playerAvoidPositions ?? []
    const playerClearanceSq = (options.playerClearance ?? 0) ** 2

    function getValidCells(ci: number, cj: number, radius: number): ResourceCenter[] {
      const cells: ResourceCenter[] = []
      for (let dx = -radius; dx <= radius; dx++) {
        for (let dy = -radius; dy <= radius; dy++) {
          const newI = ci + dx
          const newJ = cj + dy
          if (!grid[newI]?.[newJ]) continue
          const cell = grid[newI][newJ]
          if (
            !hasSpacedResourceAround(grid, cell.i, cell.j) &&
            !playerAvoidPositions.some(pos => (pos.i - cell.i) ** 2 + (pos.j - cell.j) ** 2 < playerClearanceSq) &&
            !cell.solid &&
            cell.category !== 'Water' &&
            !hasWaterBorderWithin(grid, cell.i, cell.j, WATER_BORDER_PLACEMENT_CLEARANCE) &&
            !cell.has &&
            !cell.border &&
            !cell.inclined &&
            // Dirt/Snow patches are meant to read as bare ground; trees there would also
            // fall back to the wrong sprite since resources.json has no matching tree variants.
            (instance !== RESOURCE_TYPES.tree || (cell.type !== 'Dirt' && cell.type !== 'Snow'))
          ) {
            cells.push({ i: newI, j: newJ })
          }
        }
      }
      return cells
    }

    let validCells = getValidCells(center.i, center.j, clusterRadius)
    if (validCells.length < quantity) validCells = getValidCells(center.i, center.j, clusterRadius + 1)
    if (validCells.length < quantity) return false

    const cellsToPlace: ResourceCenter[] = []
    for (let i = 0; i < quantity; i++) {
      if (!validCells.length) break
      const idx = Math.floor(this.map.random() * validCells.length)
      cellsToPlace.push(validCells.splice(idx, 1)[0])
    }

    const sharedTextureName = options.textureName ?? this.getSharedGroupTextureName(instance)
    for (const cell of cellsToPlace) {
      const rolledQuantity =
        options.quantity ?? rollResourceQuantity(() => this.map.random(), NEUTRAL_RESOURCE_QUANTITY_RANGES[instance])
      this.map.resources.add(
        createResource(this.map, cell.i, cell.j, instance, {
          textureName: options.textureNameFactory?.() ?? sharedTextureName,
          isNaturalResource: options.isNaturalResource ?? true,
          quantity: rolledQuantity,
          totalQuantity: rolledQuantity,
          startsMature: options.startsMature,
        })
      )
    }
    return true
  }

  respawnNaturalResource(slot: SaveEntityState): boolean {
    if (!Object.hasOwn(NATURAL_RESOURCE_REGROWTH_BY_TYPE, slot.type)) return false
    if (!RELOCATED_RESPAWN_TYPES.has(slot.type)) {
      const cell = this.map.grid[slot.i]?.[slot.j]
      if (!cell || cell.solid || cell.category === 'Water' || cell.has || cell.border || cell.inclined) return false
      const totalQuantity =
        typeof slot.totalQuantity === 'number'
          ? slot.totalQuantity
          : rollResourceQuantity(() => this.map.random(), NEUTRAL_RESOURCE_QUANTITY_RANGES[slot.type])
      const config = NATURAL_RESOURCE_REGROWTH_BY_TYPE[slot.type as keyof typeof NATURAL_RESOURCE_REGROWTH_BY_TYPE]
      const quantity =
        typeof totalQuantity === 'number'
          ? Math.max(1, Math.ceil(totalQuantity * config.respawnQuantityRatio))
          : undefined
      this.map.resources.add(
        createResource(this.map, slot.i, slot.j, slot.type, {
          isNaturalResource: true,
          quantity,
          totalQuantity,
        })
      )
      return true
    }
    const border = 10
    const attempts = Math.max(120, this.map.size * 2)
    for (let attempt = 0; attempt < attempts; attempt++) {
      const i = this.map.randomRange(border, this.map.size - border)
      const j = this.map.randomRange(border, this.map.size - border)
      const cell = this.map.grid[i]?.[j]
      if (!cell || cell.solid || cell.category === 'Water' || cell.has || cell.border || cell.inclined) continue
      if (hasWaterBorderWithin(this.map.grid, i, j, WATER_BORDER_PLACEMENT_CLEARANCE)) continue
      if (hasSpacedResourceAround(this.map.grid, i, j)) continue

      const rolledQuantity = rollResourceQuantity(() => this.map.random(), NEUTRAL_RESOURCE_QUANTITY_RANGES[slot.type])
      const config = NATURAL_RESOURCE_REGROWTH_BY_TYPE[slot.type as keyof typeof NATURAL_RESOURCE_REGROWTH_BY_TYPE]
      const quantity =
        typeof rolledQuantity === 'number'
          ? Math.max(1, Math.ceil(rolledQuantity * config.respawnQuantityRatio))
          : undefined
      this.map.resources.add(
        createResource(this.map, i, j, slot.type, {
          isNaturalResource: true,
          textureName: slot.type === RESOURCE_TYPES.berrybush ? slot.textureName : undefined,
          quantity,
          totalQuantity: rolledQuantity,
          startsMature: slot.type === RESOURCE_TYPES.wheat ? true : undefined,
        })
      )
      return true
    }
    return false
  }

  getSharedGroupTextureName(instance: ResourceType): string | undefined {
    if (instance !== RESOURCE_TYPES.berrybush) return undefined
    return berryBushTextureName(this.map.randomItem([1, 2]))
  }

  pickTreeTextureName(family: TreeTextureFamily | null | undefined): string | undefined {
    return pickTreeTextureNameForFamily(family, items => this.map.randomItem(items))
  }

  async generateBiomeTreesAsync(
    playersPos: GridPosition[],
    options: TreeResourceGenerationOptions = {}
  ): Promise<void> {
    const yieldFrame = () => new Promise<void>(resolve => requestAnimationFrame(() => resolve()))
    const { grid, size } = this.map
    const safeDistSq = BIOME_TREE_PLAYER_SAFE_DIST ** 2
    // Every environment's ground is single-type (see MapGeneration#generateTerrain). A cell's
    // forest type (DarkForest/Jungle) can come from exactly one of three sources per
    // environment — the dominant groundType (BlackForest/Jungle), a patchwork patch, or a
    // lake shore (both only Desert today) — and each has its own tunable chance instead of
    // BIOME_TREE_CHANCE's default, which was tuned for that type being a small patch on the
    // old mixed-biome map and would leave almost no walkable gaps at full-environment coverage.
    // Patchwork and lake-shore cells can share the same terrainType (both 'Jungle' for Desert)
    // with no per-cell record of which one produced a given cell, so a matching cell resolves
    // patchwork.treeChance first — see EnvironmentTerrainParams.lakes.shoreTreeChance's comment.
    const params = getEnvironmentTerrainParams(this.map.environment)
    for (let i = 1; i < size; i++) {
      for (let j = 1; j < size; j++) {
        const cell = grid[i][j]
        if (cell.has || cell.solid || cell.border || cell.inclined || cell.category === 'Water') continue
        if (hasWaterBorderWithin(grid, i, j, WATER_BORDER_PLACEMENT_CLEARANCE)) continue
        let chance = BIOME_TREE_CHANCE[cell.type as keyof typeof BIOME_TREE_CHANCE] ?? 0
        if (cell.type === params.groundType && params.groundTreeChance != null) {
          chance = params.groundTreeChance
        } else if (cell.type === params.patchwork.terrainType && params.patchwork.treeChance != null) {
          chance = params.patchwork.treeChance
        } else if (cell.type === params.lakes.shoreType && params.lakes.shoreTreeChance != null) {
          chance = params.lakes.shoreTreeChance
        }
        if (chance === 0) continue
        if (playersPos.some(p => (p.i - i) ** 2 + (p.j - j) ** 2 < safeDistSq)) continue
        if (this.map.random() < chance) {
          const rolledQuantity = rollResourceQuantity(
            () => this.map.random(),
            NEUTRAL_RESOURCE_QUANTITY_RANGES[RESOURCE_TYPES.tree]
          )
          this.map.resources.add(
            createResource(this.map, i, j, RESOURCE_TYPES.tree, {
              textureName: this.pickTreeTextureName(options.treeTextureFamily),
              quantity: rolledQuantity,
              totalQuantity: rolledQuantity,
            })
          )
        }
      }
      if (i % 8 === 0) await yieldFrame()
    }
  }
}
