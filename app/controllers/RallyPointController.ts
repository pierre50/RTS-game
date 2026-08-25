import type { Texture } from 'pixi.js'
import { AnimatedSprite, Assets } from 'pixi.js'
import { COLOR_GREEN, COLOR_RED } from '../constants'
import {
  bindAnimatedSpriteToTicker,
  drawInstanceBlinkingSelection,
  getRallyPointFrames,
  RALLY_POINT_SHEET_ID,
} from '../lib'
import type { ControlsLike } from '../types/context'
import type { BuildingEntity, RuntimeEntity } from '../types/entities'
import type { RuntimeCell } from '../types/map'
import type { InteractiveSprite } from '../types/pixi'

type RallyPointSheet = {
  textures: Record<string, Texture>
  data: { animationSpeed?: number }
}

type RallyPointControls = ControlsLike & {
  buildingPlacer: {
    getPointerCell(): RuntimeCell | null
  }
}

export class RallyPointController {
  controls: RallyPointControls
  building: BuildingEntity | null
  preview: AnimatedSprite | null
  direction: number

  constructor(controls: RallyPointControls) {
    this.controls = controls
    this.building = null
    this.preview = null
    this.direction = 0
  }

  get active(): boolean {
    return Boolean(this.building)
  }

  start(building: BuildingEntity): void {
    this.cancel()
    this.building = building
    this.direction = this.controls.context.map.randomRange(0, 1)
    this.preview = this.createFlag()
    this.preview.visible = false
    this.controls.addChild(this.preview)
    this.handleMouseMove()
  }

  createFlag(): AnimatedSprite {
    const sheet = Assets.cache.get(RALLY_POINT_SHEET_ID) as RallyPointSheet
    const flag = new AnimatedSprite(getRallyPointFrames(sheet.textures, this.direction)) as InteractiveSprite
    bindAnimatedSpriteToTicker(flag, this.controls.context.app)
    flag.animationSpeed = sheet.data.animationSpeed ?? 0.3
    if (flag.texture.defaultAnchor) flag.anchor.set(flag.texture.defaultAnchor.x, flag.texture.defaultAnchor.y)
    flag.eventMode = 'none'
    flag.roundPixels = true
    flag.play()
    return flag
  }

  canPlace(cell: RuntimeCell): boolean {
    if (!cell || !cell.visible) return false
    if (cell.has && !cell.has.isDestroyed && cell.has !== this.building) return true
    if (cell.solid || cell.inclined || cell.border) return false
    return cell.category !== 'Water' && !cell.waterBorder
  }

  handleMouseMove(): void {
    if (!this.active || !this.preview) return
    const cell = this.controls.buildingPlacer.getPointerCell()
    if (!cell) return

    this.preview.visible = true
    this.preview.x = cell.x - this.controls.camera.x
    this.preview.y = cell.y - this.controls.camera.y
    this.preview.tint = this.canPlace(cell) ? COLOR_GREEN : COLOR_RED
  }

  handleMouseUp(cell: RuntimeCell): boolean {
    if (!this.active || !this.canPlace(cell)) return false
    this.building!.setRallyPoint?.(cell, this.direction)
    const entity = cell.has
    if (entity && !entity.isDestroyed) {
      drawInstanceBlinkingSelection(entity)
    }
    this.cancel()
    return true
  }

  handleMouseUpOnEntity(entity: RuntimeEntity): boolean {
    if (!this.active || !entity || entity.isDestroyed) return false
    const {
      context: { map },
    } = this.controls
    const cell = map.grid[entity.i]?.[entity.j]
    if (!cell || !cell.visible) return false
    this.building!.setRallyPoint?.(cell, this.direction)
    drawInstanceBlinkingSelection(entity)
    this.cancel()
    return true
  }

  cancel({ clear = false }: { clear?: boolean } = {}): void {
    if (clear) this.building?.clearRallyPoint?.()
    this.preview?.destroy()
    this.preview = null
    this.building = null
    this.direction = 0
  }
}
