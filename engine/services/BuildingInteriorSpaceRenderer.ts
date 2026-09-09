import type { ContainerChild } from 'pixi.js'
import { Container, Graphics } from 'pixi.js'
import type { MapBlueprint } from '../../app/classes/map/MapGeneration'
import { CELL_HEIGHT, CELL_WIDTH, LABEL_TYPES } from '../../app/constants'
import {
  drawInteractionCellMarker,
  INTERACTION_CELL_MARKER_PULSE_MS,
  interactionCellPulse,
} from '../../app/lib/ui/interactionCellMarker'
import type { GameContextLike } from '../../app/types/context'
import type { BuildingEntity } from '../../app/types/entities'
import type { RuntimeCell } from '../../app/types/map'
import type { BuildingInteriorRuntimeSpace, InteriorSpaceMapAdapter, TickerLike } from './BuildingInteriorSpaceTypes'

const TARGET_FRAME_MS = 1000 / 60

const INTERIOR_RENDER_Z_INDEX = 1_000_000_001

const INTERIOR_BACKDROP_Z_INDEX = -2

const INTERIOR_SCENE_LAYER_Z_INDEX = 0

const INTERIOR_TERRAIN_LAYER_Z_INDEX = -0.5

const INTERIOR_ENTITY_LAYER_Z_INDEX = 1

const BACKDROP_ALPHA = 1

export function createSpaceMapAdapter(
  context: GameContextLike,
  grid: RuntimeCell[][],
  blueprint: MapBlueprint,
  container: Container
): InteriorSpaceMapAdapter {
  const sourceMap = context.map
  return {
    grid,
    size: blueprint.size,
    ...(blueprint.seed === undefined ? {} : { seed: blueprint.seed }),
    mapType: 'interior',
    revealEverything: true,
    revealTerrain: true,
    instantMode: true,
    startingResources: sourceMap.startingResources,
    resources: new Set(),
    random: () => sourceMap.random(),
    randomRange: (min: number, max: number) => sourceMap.randomRange(min, max),
    randomItem: <T>(items: T[]) => sourceMap.randomItem(items),
    invalidateReliefCoastDistances: () => {},
    invalidateWaterOverlay: () => {},
    setCoordinate: () => {},
    updateRenderChunks: () => {},
    addToInstanceBucket: entity => sourceMap.addToInstanceBucket(entity),
    removeFromInstanceBucket: entity => sourceMap.removeFromInstanceBucket(entity),
    updateInstanceBucket: (entity, oldI, oldJ) => sourceMap.updateInstanceBucket(entity, oldI, oldJ),
    addChild: <U extends ContainerChild[]>(...children: U): U[0] => container.addChild(...children),
    removeChild: <T extends ContainerChild>(child: T): T => {
      container.removeChild(child)
      return child
    },
  }
}

export class BuildingInteriorSpaceRenderer extends Container {
  backdrop: Graphics
  context: GameContextLike
  entityLayer: Container
  elapsedMs: number
  exitMarker: Graphics
  grid: RuntimeCell[][]
  mapType: 'interior'
  sceneLayer: Container
  shadowLayer: Container
  size: number
  space: BuildingInteriorRuntimeSpace | null
  spaceId: string
  terrainLayer: Container
  _onTick: (ticker: TickerLike) => void

  constructor(context: GameContextLike, id: string, grid: RuntimeCell[][], size: number) {
    super()
    this.context = context
    this.elapsedMs = 0
    this.grid = grid
    this.mapType = 'interior'
    this.size = size
    this.space = null
    this.spaceId = id
    this.label = 'building-interior-space'
    this.eventMode = 'none'
    this.sortableChildren = true
    this.zIndex = INTERIOR_RENDER_Z_INDEX

    this.backdrop = new Graphics()
    this.backdrop.eventMode = 'none'
    this.backdrop.label = 'building-interior-backdrop'
    this.backdrop.zIndex = INTERIOR_BACKDROP_Z_INDEX
    this.sceneLayer = new Container()
    this.sceneLayer.eventMode = 'auto'
    this.sceneLayer.label = 'building-interior-scene'
    this.sceneLayer.sortableChildren = true
    this.sceneLayer.zIndex = INTERIOR_SCENE_LAYER_Z_INDEX
    this.shadowLayer = new Container()
    this.shadowLayer.eventMode = 'none'
    this.shadowLayer.label = 'building-interior-shadow-source'
    this.shadowLayer.sortableChildren = true
    this.terrainLayer = new Container()
    this.terrainLayer.eventMode = 'none'
    this.terrainLayer.label = 'building-interior-terrain'
    this.terrainLayer.sortableChildren = true
    this.terrainLayer.zIndex = INTERIOR_TERRAIN_LAYER_Z_INDEX
    this.entityLayer = new Container()
    this.entityLayer.eventMode = 'auto'
    this.entityLayer.label = 'building-interior-entities'
    this.entityLayer.sortableChildren = true
    this.entityLayer.zIndex = INTERIOR_ENTITY_LAYER_Z_INDEX
    this.exitMarker = new Graphics()
    this.exitMarker.eventMode = 'none'
    this.exitMarker.label = LABEL_TYPES.interiorExit
    this.addChild(this.backdrop, this.sceneLayer)
    this.sceneLayer.addChild(this.terrainLayer, this.entityLayer)
    this.entityLayer.addChild(this.exitMarker)

    this._onTick = ticker => this.update(ticker.deltaMS ?? ticker.elapsedMS ?? TARGET_FRAME_MS)
    context.app.ticker.add(this._onTick)
    this.setActive(false)
  }

  setActive(active: boolean): void {
    this.visible = active
    this.renderable = active
  }

  update(deltaMs: number): void {
    if (!this.visible || !this.space) return
    this.updateBackdrop()
    this.updateExitMarker(deltaMs)
  }

  updateBackdrop(): void {
    const viewport = this.context.controls?.getViewportMetrics?.()
    if (!viewport) return
    const padding = Math.max(CELL_WIDTH * 4, 256)
    this.backdrop.clear()
    this.backdrop
      .rect(
        viewport.visibleLeft - this.x - padding,
        viewport.visibleTop - this.y - padding,
        viewport.visibleWidth + padding * 2,
        viewport.visibleHeight + padding * 2
      )
      .fill({ color: 0x050608, alpha: BACKDROP_ALPHA })
  }

  updateExitMarker(deltaMs: number): void {
    this.exitMarker.clear()
    const cell = this.space?.exitCell
    if (!cell) return
    this.elapsedMs = (this.elapsedMs + deltaMs) % INTERACTION_CELL_MARKER_PULSE_MS
    this.exitMarker.zIndex = (cell.zIndex ?? cell.i + cell.j) + 0.05
    drawInteractionCellMarker(this.exitMarker, cell, interactionCellPulse(this.elapsedMs))
  }

  override destroy(options?: Parameters<Container['destroy']>[0]): void {
    this.context.app.ticker.remove(this._onTick)
    this.parent?.removeChild(this)
    this.shadowLayer.destroy({ children: true, texture: false, textureSource: false })
    super.destroy(options ?? { children: true, texture: false, textureSource: false })
  }
}

export function placeRendererNearBuilding(
  renderer: BuildingInteriorSpaceRenderer,
  building: BuildingEntity,
  exitCell: RuntimeCell | null
): void {
  const anchor = {
    x: building.x,
    y: building.y - CELL_HEIGHT,
  }
  renderer.x = anchor.x - (exitCell?.x ?? 0)
  renderer.y = anchor.y - (exitCell?.y ?? 0)
}
