import { Graphics } from 'pixi.js'
import { LABEL_TYPES } from '../constants'
import { getInteriorExitCell } from '../lib/buildings/interiorExits'
import {
  INTERACTION_CELL_MARKER_PULSE_MS,
  INTERACTION_CELL_MARKER_Z_INDEX,
  drawInteractionCellMarker,
  interactionCellPulse,
} from '../lib/ui/InteractionCellMarker'
import type { GameContextLike } from '../types/context'
import type { RuntimeMap } from '../types/map'

type TickerLike = { deltaMS?: number; elapsedMS?: number }

const TARGET_FRAME_MS = 1000 / 60

export class InteriorExitMarkerSystem {
  context: GameContextLike
  layer: Graphics
  map: RuntimeMap
  elapsedMs: number
  _onTick: (ticker: TickerLike) => void

  constructor(context: GameContextLike, map: RuntimeMap) {
    this.context = context
    this.map = map
    this.elapsedMs = 0
    this.layer = new Graphics()
    this.layer.eventMode = 'none'
    this.layer.label = LABEL_TYPES.interiorExit
    this.layer.zIndex = INTERACTION_CELL_MARKER_Z_INDEX
    map.addChild(this.layer)

    this._onTick = ticker => {
      this.update(ticker.deltaMS ?? ticker.elapsedMS ?? TARGET_FRAME_MS)
    }
    context.app.ticker.add(this._onTick)
    this.update(0)
  }

  update(deltaMs: number): void {
    const cell = getInteriorExitCell(this.map)
    this.layer.clear()
    if (!cell) return

    this.elapsedMs = (this.elapsedMs + deltaMs) % INTERACTION_CELL_MARKER_PULSE_MS
    drawInteractionCellMarker(this.layer, cell, interactionCellPulse(this.elapsedMs))
  }

  destroy(): void {
    this.context.app.ticker.remove(this._onTick)
    this.layer.parent?.removeChild(this.layer)
    this.layer.destroy(true)
  }
}
