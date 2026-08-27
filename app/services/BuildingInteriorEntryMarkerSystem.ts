import { Graphics } from 'pixi.js'
import { LABEL_TYPES } from '../constants'
import { getBuildingInteriorEntryCell } from '../lib/buildings/interiors'
import { getKnownBuildings } from '../lib/buildings/knownBuildings'
import {
  INTERACTION_CELL_MARKER_PULSE_MS,
  INTERACTION_CELL_MARKER_Z_INDEX,
  drawInteractionCellMarker,
  interactionCellPulse,
} from '../lib/ui/interactionCellMarker'
import type { GameContextLike } from '../types/context'
import type { RuntimeMap } from '../types/map'

type TickerLike = { deltaMS?: number; elapsedMS?: number }

const TARGET_FRAME_MS = 1000 / 60

export class BuildingInteriorEntryMarkerSystem {
  context: GameContextLike
  elapsedMs: number
  layer: Graphics
  map: RuntimeMap
  _onTick: (ticker: TickerLike) => void

  constructor(context: GameContextLike, map: RuntimeMap) {
    this.context = context
    this.map = map
    this.elapsedMs = 0
    this.layer = new Graphics()
    this.layer.eventMode = 'none'
    this.layer.label = LABEL_TYPES.buildingInteriorEntry
    this.layer.zIndex = INTERACTION_CELL_MARKER_Z_INDEX
    map.addChild(this.layer)

    this._onTick = ticker => {
      this.update(ticker.deltaMS ?? ticker.elapsedMS ?? TARGET_FRAME_MS)
    }
    context.app.ticker.add(this._onTick)
    this.update(0)
  }

  update(deltaMs: number): void {
    this.layer.clear()
    const buildings = getKnownBuildings(this.context)
    if (!buildings.length) return

    this.elapsedMs = (this.elapsedMs + deltaMs) % INTERACTION_CELL_MARKER_PULSE_MS
    const pulse = interactionCellPulse(this.elapsedMs)
    for (const building of buildings) {
      const cell = getBuildingInteriorEntryCell(building, this.map.grid)
      if (!cell || cell.terrainHidden || cell.category === 'Water') continue
      drawInteractionCellMarker(this.layer, cell, pulse)
    }
  }

  destroy(): void {
    this.context.app.ticker.remove(this._onTick)
    this.layer.parent?.removeChild(this.layer)
    this.layer.destroy(true)
  }
}
