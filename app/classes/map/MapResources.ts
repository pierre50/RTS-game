import { Resource } from '../Resource'
import {
  RESOURCE_TYPES,
  BIOME_TREE_CHANCE,
  BIOME_TREE_PLAYER_SAFE_DIST,
  getEnvironmentTerrainParams,
} from '../../constants'
import type { ContainerChild } from 'pixi.js'
import type { GridPosition } from '../../types/grid'
import type { RuntimeCell } from '../../types/map'
import type { ResourceEntity } from '../../types/entities'

export type ResourceDensity = keyof typeof RESOURCE_DENSITY_PROFILES
type ResourceType = string
type ResourceRange = [min: number, max: number]
type ResourceGroupEntry = [type: ResourceType, baseCount: number, quantity: number, clusterRadius: number]
type ResourceCenter = GridPosition
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
  placeResourceGroupAt(center: GridPosition, type: ResourceType, quantity: number, clusterRadius?: number): boolean
  generateForestAroundPlayer(player: GridPosition, treeCount: number): void
  findNeutralResourceCenter(
    playersPos: GridPosition[],
    placedCenters: GridPosition[],
    playerSafeDistance: number,
    minNeutralDistance: number
  ): GridPosition | null
}

const SPACED_RESOURCE_TYPES = new Set([RESOURCE_TYPES.berrybush, RESOURCE_TYPES.gold, RESOURCE_TYPES.stone])

function hasSpacedResourceAround(grid: RuntimeCell[][], i: number, j: number, radius: number = 3): boolean {
  const minI = Math.max(0, i - radius)
  const maxI = Math.min(grid.length - 1, i + radius)

  for (let ni = minI; ni <= maxI; ni++) {
    const row = grid[ni]
    const minJ = Math.max(0, j - radius)
    const maxJ = Math.min(row.length - 1, j + radius)
    for (let nj = minJ; nj <= maxJ; nj++) {
      if (SPACED_RESOURCE_TYPES.has(row[nj]?.has?.type ?? '')) return true
    }
  }
  return false
}

function createResource(map: MapResourcesMap, i: number, j: number, type: ResourceType): ResourceEntity {
  return map.addChild(new Resource({ i, j, type }, map.context as ConstructorParameters<typeof Resource>[1]))
}

const RESOURCE_DENSITY_PROFILES = {
  low: {
    neutralGroups: { berrybush: 2, stone: 2, gold: 2, tree: 4 },
    minNeutralDistance: 28,
    playerSafeDistance: 34,
  },
  moderate: {
    neutralGroups: { berrybush: 4, stone: 4, gold: 4, tree: 7 },
    minNeutralDistance: 24,
    playerSafeDistance: 30,
  },
  high: {
    neutralGroups: { berrybush: 7, stone: 6, gold: 6, tree: 11 },
    minNeutralDistance: 20,
    playerSafeDistance: 26,
  },
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
    const { grid } = this.map
    const random = () => this.map.random()
    const { i: playerI, j: playerJ } = player
    const gridWidth = grid.length
    const gridHeight = grid[0].length
    let forestCells: ResourceCenter[] = []
    const pathCells = new Set<string>()

    const rangeFactor = 0.4
    const forestRange = Math.max(30, Math.floor(this.map.size * rangeFactor))

    function distSq(x1: number, y1: number, x2: number, y2: number): number {
      return (x1 - x2) ** 2 + (y1 - y2) ** 2
    }
    const safeDistanceSq = safeDistance ** 2

    function createCircle(
      centerI: number,
      centerJ: number,
      radius: number,
      density: number = 0.7,
      edgeNoise: number = 0
    ): ResourceCenter[] {
      const circleCells: ResourceCenter[] = []
      for (let x = -radius; x <= radius; x++) {
        for (let y = -radius; y <= radius; y++) {
          const noise = random() * edgeNoise - edgeNoise / 2
          const effectiveRadius = radius - noise
          if (effectiveRadius > 0 && x * x + y * y <= effectiveRadius * effectiveRadius) {
            const cellI = centerI + x
            const cellJ = centerJ + y
            if (
              cellI >= 0 &&
              cellI < gridWidth &&
              cellJ >= 0 &&
              cellJ < gridHeight &&
              !grid[cellI][cellJ].solid &&
              grid[cellI][cellJ].category !== 'Water' &&
              grid[cellI][cellJ].type !== 'Border' &&
              grid[cellI][cellJ].type !== 'Dirt' &&
              !grid[cellI][cellJ].inclined &&
              random() < density
            ) {
              circleCells.push({ i: cellI, j: cellJ })
            }
          }
        }
      }
      return circleCells
    }

    for (let cluster = 0; cluster < clusterCount; cluster++) {
      let clusterCenterI, clusterCenterJ
      let tries = 0
      const clusterRadius = Math.floor(random() * (maxClusterRadius - minClusterRadius + 1)) + minClusterRadius
      const clusterDensity = random() * 0.5 + 0.5
      const edgeNoise = random() * 2

      do {
        clusterCenterI = playerI + Math.floor(random() * forestRange * 2 - forestRange)
        clusterCenterJ = playerJ + Math.floor(random() * forestRange * 2 - forestRange)
        tries++
        if (tries > 100) break
      } while (
        distSq(clusterCenterI, clusterCenterJ, playerI, playerJ) < safeDistanceSq ||
        clusterCenterI < 0 ||
        clusterCenterI >= gridWidth ||
        clusterCenterJ < 0 ||
        clusterCenterJ >= gridHeight ||
        grid[clusterCenterI][clusterCenterJ].category === 'Water' ||
        grid[clusterCenterI][clusterCenterJ].solid ||
        grid[clusterCenterI][clusterCenterJ].inclined
      )

      if (tries <= 100) {
        const treeCluster = createCircle(clusterCenterI, clusterCenterJ, clusterRadius, clusterDensity, edgeNoise)
        treeCluster.forEach(cell => forestCells.push(cell))
      }
    }

    const scatteredTreeCount = Math.floor(treeCount * 0.2)
    for (let i = 0; i < scatteredTreeCount; i++) {
      let soloI, soloJ
      let tries = 0

      do {
        soloI = playerI + Math.floor(random() * forestRange * 2 - forestRange)
        soloJ = playerJ + Math.floor(random() * forestRange * 2 - forestRange)
        tries++
        if (tries > 50) break
      } while (
        distSq(soloI, soloJ, playerI, playerJ) < safeDistanceSq ||
        soloI < 0 ||
        soloI >= gridWidth ||
        soloJ < 0 ||
        soloJ >= gridHeight ||
        grid[soloI][soloJ].category === 'Water' ||
        grid[soloI][soloJ].solid ||
        grid[soloI][soloJ].inclined ||
        grid[soloI][soloJ].type === 'Dirt'
      )

      if (tries <= 50) {
        forestCells.push({ i: soloI, j: soloJ })
      }
    }

    for (let clearing = 0; clearing < clusterCount; clearing++) {
      if (random() < clearingProbability) {
        let clearingCenterI, clearingCenterJ
        let tries = 0
        const clearingRadius = Math.floor(random() * 8) + 5
        const edgeNoise = random() * 1.5

        do {
          clearingCenterI = playerI + Math.floor(random() * forestRange * 2 - forestRange)
          clearingCenterJ = playerJ + Math.floor(random() * forestRange * 2 - forestRange)
          tries++
          if (tries > 100) break
        } while (
          distSq(clearingCenterI, clearingCenterJ, playerI, playerJ) < safeDistanceSq ||
          clearingCenterI < 0 ||
          clearingCenterI >= gridWidth ||
          clearingCenterJ < 0 ||
          clearingCenterJ >= gridHeight ||
          grid[clearingCenterI][clearingCenterJ].category === 'Water' ||
          grid[clearingCenterI][clearingCenterJ].solid ||
          grid[clearingCenterI][clearingCenterJ].inclined
        )

        if (tries <= 100) {
          const clearingCells = createCircle(clearingCenterI, clearingCenterJ, clearingRadius, 0, edgeNoise)
          const clearingSet = new Set(clearingCells.map(c => `${c.i},${c.j}`))
          forestCells = forestCells.filter(c => !clearingSet.has(`${c.i},${c.j}`))
        }
      }
    }

    const pathLength = 20
    const pathDirection = random() > 0.5 ? 1 : -1

    for (let step = 0; step < pathLength; step++) {
      const offsetX = step * pathDirection
      const offsetY = step
      const ni = playerI + offsetX
      const nj = playerJ + offsetY
      if (
        ni >= 0 &&
        ni < gridWidth &&
        nj >= 0 &&
        nj < gridHeight &&
        distSq(ni, nj, playerI, playerJ) >= safeDistanceSq
      ) {
        const randOffsetX = random() > 0.5 ? 1 : -1
        const randOffsetY = random() > 0.5 ? 1 : -1
        pathCells.add(`${ni + randOffsetX},${nj + randOffsetY}`)
      }
    }

    for (let idx = forestCells.length - 1; idx >= 0; idx--) {
      if (pathCells.has(`${forestCells[idx].i},${forestCells[idx].j}`)) {
        forestCells.splice(idx, 1)
      }
    }

    const cellsToPlace: ResourceCenter[] = []
    for (let i = 0; i < treeCount; i++) {
      if (forestCells.length === 0) break
      const itemIndex = Math.floor(random() * forestCells.length)
      const cell = forestCells[itemIndex]
      cellsToPlace.push(cell)
      forestCells.splice(itemIndex, 1)
    }

    for (const cell of cellsToPlace) {
      if (
        grid[cell.i][cell.j].category !== 'Water' &&
        !grid[cell.i][cell.j].waterBorder &&
        !grid[cell.i][cell.j].solid &&
        !grid[cell.i][cell.j].inclined
      ) {
        !hasSpacedResourceAround(grid, cell.i, cell.j) &&
          this.map.resources.add(createResource(this.map, cell.i, cell.j, RESOURCE_TYPES.tree))
      }
    }
  }

  async generateResourcesAroundPlayersAsync(playersPos: GridPosition[]): Promise<void> {
    const yieldFrame = () => new Promise<void>(resolve => requestAnimationFrame(() => resolve()))
    for (const player of playersPos) {
      const groups: Array<[type: ResourceType, quantity: number, range: ResourceRange]> = [
        [RESOURCE_TYPES.berrybush, 8, [7, 14]],
        [RESOURCE_TYPES.berrybush, 8, [14, 22]],
        [RESOURCE_TYPES.berrybush, 8, [22, 29]],
        [RESOURCE_TYPES.stone, 7, [7, 14]],
        [RESOURCE_TYPES.stone, 7, [14, 22]],
        [RESOURCE_TYPES.stone, 7, [22, 29]],
        [RESOURCE_TYPES.gold, 7, [7, 14]],
        [RESOURCE_TYPES.gold, 7, [14, 22]],
        [RESOURCE_TYPES.gold, 7, [22, 29]],
      ]
      for (const [type, quantity, range] of groups) {
        this.map.placeResourceGroup(player, type, quantity, range)
        await yieldFrame()
      }
      const { forestDensity } = getEnvironmentTerrainParams(this.map.environment)
      this.map.generateForestAroundPlayer(player, Math.round(this.map.size * 4 * forestDensity))
      await yieldFrame()
    }
  }

  async generateNeutralResourceGroupsAsync(playersPos: GridPosition[]): Promise<void> {
    const profile =
      RESOURCE_DENSITY_PROFILES[this.map.resourceDensity as ResourceDensity] ?? RESOURCE_DENSITY_PROFILES.moderate
    const { forestDensity } = getEnvironmentTerrainParams(this.map.environment)
    const placedCenters: GridPosition[] = []
    const sizeScale = Math.max(1, Math.round((this.map.size / 120) ** 2))
    const groupEntries: ResourceGroupEntry[] = [
      [RESOURCE_TYPES.berrybush, profile.neutralGroups.berrybush, 8, 2],
      [RESOURCE_TYPES.stone, profile.neutralGroups.stone, 7, 2],
      [RESOURCE_TYPES.gold, profile.neutralGroups.gold, 7, 2],
      [RESOURCE_TYPES.tree, Math.round(profile.neutralGroups.tree * forestDensity), 14, 4],
    ]
    let batch = 0
    for (const [type, baseCount, quantity, radius] of groupEntries) {
      for (let i = 0; i < baseCount * sizeScale; i++) {
        const center = this.map.findNeutralResourceCenter(
          playersPos,
          placedCenters,
          profile.playerSafeDistance,
          profile.minNeutralDistance
        )
        if (!center) break
        if (this.map.placeResourceGroupAt(center, type, quantity, radius)) placedCenters.push(center)
        if (++batch % 4 === 0) {
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
    clusterRadius: number = 2
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
            !cell.has &&
            !cell.border &&
            !cell.inclined &&
            // Dirt water-patches are meant to read as bare ground; trees there would also
            // fall back to the wrong sprite since resources.json has no Dirt tree variant.
            (instance !== RESOURCE_TYPES.tree || cell.type !== 'Dirt')
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

    for (const cell of cellsToPlace) {
      this.map.resources.add(createResource(this.map, cell.i, cell.j, instance))
    }
    return true
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
          this.map.resources.add(createResource(this.map, i, j, RESOURCE_TYPES.tree))
        }
      }
      if (i % 8 === 0) await yieldFrame()
    }
  }
}
