import { Resource } from '../../Resource'
import {
  RESOURCE_TYPES,
  BIOME_TREE_CHANCE,
  BIOME_TREE_PLAYER_SAFE_DIST,
  WATER_BORDER_PLACEMENT_CLEARANCE,
  getEnvironmentTerrainParams,
} from '../../../constants'
import { hasWaterBorderWithin } from '../../../lib'
import { generateForestAroundPlayer as generateForestAroundPlayerResources } from './MapForestResources'
import { hasSpacedResourceAround } from './MapResourceSpacing'
import {
  NEUTRAL_RESOURCE_QUANTITY_RANGES,
  SCATTERED_STONE_QUANTITY_RANGE,
  rollResourceQuantity,
} from './ResourceQuantityRanges'
import type { ContainerChild } from 'pixi.js'
import type { GridPosition } from '../../../types/grid'
import type { RuntimeCell } from '../../../types/map'
import type { ResourceEntity } from '../../../types/entities'
import type { SaveEntityState } from '../../../types/save'

export type ResourceDensity = keyof typeof RESOURCE_DENSITY_PROFILES
type NeutralResourceProfileKey = keyof (typeof RESOURCE_DENSITY_PROFILES)['moderate']['neutralGroups']
type ResourceType = string
type ResourceRange = [min: number, max: number]
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
  quantity?: number
  totalQuantity?: number
  startsMature?: boolean
}
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
  placeResourceGroup(player: GridPosition, type: ResourceType, quantity: number, range: ResourceRange): boolean
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

const PLAYER_RESOURCE_GROUPS: Array<[type: ResourceType, quantity: number, range: ResourceRange]> = [
  [RESOURCE_TYPES.berrybush, 8, [7, 14]],
  [RESOURCE_TYPES.berrybush, 8, [14, 22]],
  [RESOURCE_TYPES.berrybush, 8, [22, 29]],
]

const NEUTRAL_RESOURCE_GROUPS: NeutralResourceGroup[] = [
  {
    type: RESOURCE_TYPES.berrybush,
    profileKey: 'berrybush',
    quantity: 8,
    clusterRadius: 2,
    playerSafeDistance: 26,
    minNeutralDistance: 20,
  },
  {
    type: RESOURCE_TYPES.wheat,
    profileKey: 'wheat',
    quantity: 7,
    clusterRadius: 3,
    playerSafeDistance: 24,
    minNeutralDistance: 20,
  },
  {
    type: RESOURCE_TYPES.stone,
    profileKey: 'stone',
    quantity: 8,
    clusterRadius: 3,
    playerSafeDistance: 14,
    minNeutralDistance: 15,
  },
  {
    type: RESOURCE_TYPES.copper,
    profileKey: 'copper',
    quantity: 7,
    clusterRadius: 3,
    playerSafeDistance: 20,
    minNeutralDistance: 18,
  },
  {
    type: RESOURCE_TYPES.iron,
    profileKey: 'iron',
    quantity: 6,
    clusterRadius: 2,
    playerSafeDistance: 26,
    minNeutralDistance: 22,
  },
  {
    // Gold is a rare one-tile "vein" rather than a multi-tile mine: see
    // NEUTRAL_RESOURCE_QUANTITY_RANGES for its (tiny) per-tile amount.
    type: RESOURCE_TYPES.gold,
    profileKey: 'gold',
    quantity: 1,
    clusterRadius: 1,
    playerSafeDistance: 40,
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
    neutralGroups: { berrybush: 2, wheat: 2, stone: 3, copper: 2, iron: 2, gold: 0, tree: 4 },
    minNeutralDistance: 28,
    playerSafeDistance: 34,
  },
  moderate: {
    neutralGroups: { berrybush: 4, wheat: 4, stone: 6, copper: 4, iron: 3, gold: 1, tree: 7 },
    minNeutralDistance: 24,
    playerSafeDistance: 30,
  },
  high: {
    neutralGroups: { berrybush: 7, wheat: 7, stone: 9, copper: 7, iron: 5, gold: 2, tree: 11 },
    minNeutralDistance: 20,
    playerSafeDistance: 26,
  },
}

const SCATTERED_STONE_PROFILES: Record<ResourceDensity, number> = {
  low: 10,
  moderate: 20,
  high: 34,
}

const SCATTERED_STONE_ENVIRONMENT_MULTIPLIERS: Record<string, number> = {
  Temperate: 1,
  BlackForest: 0.9,
  Jungle: 0.7,
  Desert: 1.6,
}

const SCATTERED_STONE_PLAYER_SAFE_DISTANCE = 20
const SCATTERED_STONE_RESOURCE_CLEARANCE = 4

const ENVIRONMENT_NEUTRAL_RESOURCE_MULTIPLIERS: Record<string, Partial<Record<NeutralResourceProfileKey, number>>> = {
  Temperate: {
    berrybush: 1,
    wheat: 1.2,
    stone: 1,
    copper: 1,
    iron: 1,
    gold: 1,
    tree: 1,
  },
  BlackForest: {
    berrybush: 0.8,
    wheat: 0.65,
    stone: 1,
    copper: 0.9,
    iron: 0.9,
    gold: 0.85,
    tree: 1.25,
  },
  Jungle: {
    berrybush: 1.25,
    wheat: 0.75,
    stone: 0.85,
    copper: 0.85,
    iron: 0.8,
    gold: 0.8,
    tree: 1.25,
  },
  Desert: {
    berrybush: 0.45,
    wheat: 0.25,
    stone: 1.25,
    copper: 1.3,
    iron: 1.2,
    gold: 1.3,
    tree: 0.7,
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
    safeDistance: number = 20,
    clearingProbability: number = 0.6
  ): void {
    generateForestAroundPlayerResources(
      this.map,
      player,
      treeCount,
      clusterCount,
      minClusterRadius,
      maxClusterRadius,
      safeDistance,
      clearingProbability
    )
  }

  async generateResourcesAroundPlayersAsync(playersPos: GridPosition[]): Promise<void> {
    const yieldFrame = () => new Promise<void>(resolve => requestAnimationFrame(() => resolve()))
    for (const player of playersPos) {
      for (const [type, quantity, range] of PLAYER_RESOURCE_GROUPS) {
        this.map.placeResourceGroup(player, type, quantity, range)
        await yieldFrame()
      }
    }
  }

  async generateNeutralResourceGroupsAsync(playersPos: GridPosition[]): Promise<void> {
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
    for (let i = 0; i < treeGroupCount; i++) {
      groupEntries.push({
        type: RESOURCE_TYPES.tree,
        quantity: 14,
        clusterRadius: 4,
        playerSafeDistance: profile.playerSafeDistance,
        minNeutralDistance: Math.round(profile.minNeutralDistance * (treeParams.forestDensity < 0.15 ? 1.15 : 1)),
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
      const options = group.type === RESOURCE_TYPES.wheat ? { startsMature: true } : undefined
      if (center && this.map.placeResourceGroupAt(center, group.type, group.quantity, group.clusterRadius, options)) {
        placedCenters.push(center)
      }
      if (++batch % 4 === 0) {
        await new Promise<void>(resolve => requestAnimationFrame(() => resolve()))
      }
    }
    await this.generateScatteredStoneAsync(playersPos)
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

  placeResourceGroup(player: GridPosition, instance: ResourceType, quantity: number, range: ResourceRange): boolean {
    const angle = this.map.random() * 2 * Math.PI
    const dist = range[0] + this.map.random() * (range[1] - range[0])
    const centerI = Math.round(player.i + Math.cos(angle) * dist)
    const centerJ = Math.round(player.j + Math.sin(angle) * dist)

    return this.map.placeResourceGroupAt({ i: centerI, j: centerJ }, instance, quantity)
  }

  placeResourceGroupAt(
    center: GridPosition,
    instance: ResourceType,
    quantity: number,
    clusterRadius: number = 2,
    options: ResourcePlacementOptions = {}
  ): boolean {
    const { grid } = this.map

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
          textureName: sharedTextureName,
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
    if (slot.type !== RESOURCE_TYPES.berrybush && slot.type !== RESOURCE_TYPES.wheat) return false
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
      this.map.resources.add(
        createResource(this.map, i, j, slot.type, {
          isNaturalResource: true,
          textureName: slot.type === RESOURCE_TYPES.berrybush ? slot.textureName : undefined,
          quantity: rolledQuantity,
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

  async generateBiomeTreesAsync(playersPos: GridPosition[]): Promise<void> {
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
