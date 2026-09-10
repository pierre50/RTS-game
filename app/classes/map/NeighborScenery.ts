import { applyPreparedTerrain } from './generation/PreparedMapContent'
import { Assets, Container, Sprite } from 'pixi.js'
import { CELL_DEPTH, CELL_HEIGHT, CELL_WIDTH } from '../../constants'
import { getGroundReliefLevel, getInstanceZIndex, getTexture } from '../../lib'
import { getLocalMapBounds, localToGrid } from '../../lib/localMapLayout'
import { GenerationCell } from '../cell/GenerationCell'
import { TerrainBakeCell } from '../cell/TerrainBakeCell'
import { createSquareLocalBlueprint } from './generation/LocalMapBlueprint'
import {
  formatTerrainPatchBorders,
  formatTerrainWaterBorder,
  formatTerrainWaterBorderOverlays,
} from './terrain/MapTerrainAppearance'
import { formatTerrainRelief } from './terrain/MapTerrainReliefAppearance'
import type { TerrainMap } from './terrain/MapTerrainTypes'
import type { MapBlueprint, MapGenerationMap } from './MapGenerationTypes'
import type { RuntimeMap } from '../../types/map'
import type { SerializedSave } from '../../types/save'

type VisibilityGroup = { displays: Container[]; i: number; j: number; visible?: boolean }
const sources = new WeakMap<object, MapBlueprint>()
const visuals = new WeakMap<object, VisibilityGroup[]>()
const preparedBlueprints = new WeakMap<MapBlueprint, MapBlueprint>()

export function setNeighborScenerySource(map: MapGenerationMap, blueprint: MapBlueprint): void {
  sources.set(map, blueprint)
  visuals.delete(map)
}

// Offsets follow the same region axes as WorldRegionTravelSystem.
function neighborSceneryOffset(dx: number, dy: number, span: number): { x: number; y: number } {
  return { x: dy * span, y: dx * span }
}

function neighborBlueprint(source: MapBlueprint, saved: SerializedSave | null | undefined): MapBlueprint {
  let prepared = preparedBlueprints.get(source)
  if (!prepared) {
    prepared = createSquareLocalBlueprint(source)
    preparedBlueprints.set(source, prepared)
  }
  if (!saved?.world?.localGridLayout && !saved?.config?.localGridLayout) return prepared

  // Saved scenery must never mutate the shared, pregenerated baseline.
  const blueprint = {
    ...prepared,
    resources: saved.resources.filter(resource => !resource.isDead && !resource.isDestroyed),
  }
  if (saved.map) {
    delete blueprint.terrainAppearance
    blueprint.terrain = prepared.terrain.map(row => row.slice())
    blueprint.relief = prepared.relief?.map(row => row.slice()) ?? prepared.terrain.map(row => row.map(() => 0))
    for (let i = 0; i < saved.map.length; i++) {
      for (let j = 0; j < (saved.map[i]?.length ?? 0); j++) {
        const cell = saved.map[i]?.[j]
        if (!cell || blueprint.terrain[i]?.[j] == null) continue
        blueprint.terrain[i][j] = cell.type
        blueprint.relief[i][j] = cell.z ?? 0
      }
    }
  }
  return blueprint
}

export function buildNeighborScenery(map: MapGenerationMap): void {
  const source = sources.get(map)
  sources.delete(map)
  if (!map.localGridLayout || !source?.worldRegion || !source.visualNeighbors?.length) return
  const layout = map.localGridLayout
  const bounds = getLocalMapBounds(map.localGridLayout)
  const span = bounds.right - bounds.left
  const groups = new Map<string, VisibilityGroup>()
  const terrainLayer = new Container({ label: 'neighborTerrain', eventMode: 'none', sortableChildren: true })
  terrainLayer.zIndex = -0.5
  map.addChild(terrainLayer)

  for (const neighbor of source.visualNeighbors) {
    const regionId = map.worldManifest?.maps?.find(
      entry => entry.region.x === neighbor.region.x && entry.region.y === neighbor.region.y
    )?.id
    const saved = regionId ? map.context.getCampaignWorldState?.(regionId) : null
    const blueprint = neighborBlueprint(neighbor.blueprint, saved)
    const offset = neighborSceneryOffset(
      neighbor.region.x - source.worldRegion.x,
      neighbor.region.y - source.worldRegion.y,
      span
    )
    // Include enough rows for the tallest static resource and the largest elevation.
    let reach = CELL_WIDTH * 2
    const measuredTextures = new Set<string>()
    const definitions = Assets.cache.get('config')?.resources
    for (const resource of blueprint.resources ?? []) {
      if (!resource.textureName) continue
      const key = `${resource.type}:${resource.textureName}`
      if (measuredTextures.has(key)) continue
      measuredTextures.add(key)
      const texture = getTexture(resource.textureName, Assets)
      const scale = definitions?.[resource.type]?.spriteScale ?? 1
      if (texture) reach = Math.max(reach, texture.height * scale, texture.width * scale)
    }
    let maxRelief = 0
    for (const row of blueprint.relief ?? [])
      for (const z of row) if (z != null) maxRelief = Math.max(maxRelief, Math.abs(z))
    reach += maxRelief * CELL_DEPTH
    const near = (x: number, y: number, margin: number) =>
      x >= bounds.left - margin && x <= bounds.right + margin && y >= bounds.top - margin && y <= bounds.bottom + margin
    const outside = (x: number, y: number) => x < bounds.left || x > bounds.right || y < bounds.top || y > bounds.bottom
    const grid: GenerationCell[][] = Array.from({ length: blueprint.size + 1 }, () => [])
    const context = {
      map: {
        seed: blueprint.seed,
        grid,
        size: blueprint.size,
        randomItem: <T>(items: T[]) => items[0],
        randomRange: (min: number) => min,
        invalidateReliefCoastDistances() {},
      },
    }
    for (let i = 0; i <= blueprint.size; i++) {
      for (let j = 0; j <= blueprint.size; j++) {
        const type = blueprint.terrain[i]?.[j]
        if (type == null) continue
        const x = ((i - j) * CELL_WIDTH) / 2 + offset.x
        const y = ((i + j) * CELL_HEIGHT) / 2 + offset.y
        if (!near(x, y, reach + CELL_WIDTH * 2)) continue
        grid[i][j] = new GenerationCell({ i, j, type: String(type), z: blueprint.relief?.[i]?.[j] ?? 0 }, context)
      }
    }
    const terrain = Object.assign(new Container(), {
      grid,
      size: blueprint.size,
      seed: blueprint.seed,
    }) as unknown as TerrainMap
    if (blueprint.terrainAppearance) applyPreparedTerrain(terrain, blueprint.terrainAppearance)
    else {
      formatTerrainWaterBorder(terrain)
      formatTerrainRelief(terrain, false)
      formatTerrainPatchBorders(terrain)
      formatTerrainWaterBorderOverlays(terrain)
    }
    terrain.destroy()

    const register = (display: Container, x: number, y: number) => {
      const row = Math.max(0, Math.min(layout.rows - 1, Math.round((y - bounds.top) / (CELL_HEIGHT / 2))))
      const column = Math.max(
        0,
        Math.min(
          layout.columns - 1 - (row % 2),
          Math.round((x - bounds.left - ((row % 2) * CELL_WIDTH) / 2) / CELL_WIDTH)
        )
      )
      const key = `${column}:${row}`
      let group = groups.get(key)
      if (!group) {
        group = { ...localToGrid(column, row, layout), displays: [] }
        groups.set(key, group)
      }
      group.displays.push(display)
    }
    for (const row of grid)
      for (const cell of row) {
        if (!cell) continue
        const flatX = ((cell.i - cell.j) * CELL_WIDTH) / 2 + offset.x
        const flatY = ((cell.i + cell.j) * CELL_HEIGHT) / 2 + offset.y
        if (!outside(flatX, flatY) || !near(flatX, flatY, reach)) continue
        const baked = new TerrainBakeCell(cell, context)
        const appearance = cell._terrainAppearance
        if (appearance.waterBorder)
          baked.setWaterBorder(appearance.waterBorder.resourceName, appearance.waterBorder.index)
        if (appearance.relief) baked.setReliefBorder(appearance.relief.index, appearance.relief.elevation)
        for (const direction of appearance.patchBorders ?? [])
          baked.setPatchBorder(direction, appearance.patchBorderGroundType ?? undefined)
        const display = new Container({ eventMode: 'none', sortableChildren: true })
        display.position.set(offset.x, offset.y)
        display.zIndex = cell.i + cell.j + offset.y / (CELL_HEIGHT / 2)
        for (const child of baked.getTerrainBakeChildren()) display.addChild(child)
        terrainLayer.addChild(display)
        register(display, flatX, flatY)
      }
    for (const resource of blueprint.resources ?? []) {
      const cell = grid[resource.i]?.[resource.j]
      if (!cell || !resource.textureName || cell.category === 'Water' || cell.waterBorder) continue
      const x = ((cell.i - cell.j) * CELL_WIDTH) / 2 + offset.x
      const y = ((cell.i + cell.j) * CELL_HEIGHT) / 2 + offset.y
      if (!outside(x, y) || !near(x, y, reach)) continue
      const texture = getTexture(resource.textureName, Assets)
      if (!texture) continue
      const sprite = new Sprite(texture)
      sprite.label = 'neighborResource'
      const definition = definitions?.[resource.type]
      sprite.scale.set(definition?.spriteScale ?? 1)
      if (texture.defaultAnchor) sprite.anchor.copyFrom(texture.defaultAnchor)
      sprite.roundPixels = true
      sprite.eventMode = 'none'
      sprite.position.set(x, y - getGroundReliefLevel(cell) * CELL_DEPTH)
      sprite.zIndex = getInstanceZIndex({ x, y, z: cell.z })
      map.addChild(sprite)
      register(sprite, x, y)
    }
  }
  visuals.set(map, [...groups.values()])
  updateNeighborSceneryVisibility(map)
}

export function updateNeighborSceneryVisibility(map: RuntimeMap): void {
  for (const group of visuals.get(map) ?? []) {
    const cell = map.grid[group.i]?.[group.j]
    const visible = Boolean(map.revealEverything || cell?.viewed || cell?.viewBy?.size)
    if (visible === group.visible) continue
    group.visible = visible
    for (const display of group.displays) display.visible = visible
  }
}
