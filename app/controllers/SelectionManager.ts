import { Assets, AnimatedSprite, Graphics } from 'pixi.js'
import type { Texture } from 'pixi.js'
import { bindAnimatedSpriteToTicker, pointsDistance, pointInRectangle, getAnimationFrames, playSoundCue } from '../lib'
import { canSelectUnitWithRts, canUseRtsSelection, getRtsCommandableUnits } from '../lib/unitControl'
import { COLOR_WHITE, COMMAND_POINTER_SHEET_ID, MAX_SELECT_UNITS, SOUND_CUES, UNIT_TYPES } from '../constants'
import type { ControlsLike, SelectionRectangle } from '../types/context'
import type { CommandSound, UnitEntity } from '../types/entities'
import type { RuntimeCell } from '../types/map'
import type { InteractiveSprite } from '../types/pixi'

export class SelectionManager {
  controls: ControlsLike

  constructor(controls: ControlsLike) {
    this.controls = controls
  }

  handleMouseMove(): void {
    const { controls } = this
    if (!canUseRtsSelection(controls)) return
    const {
      context: { player, app },
    } = controls

    if (
      !controls.mouseRectangle &&
      controls.pointerStart &&
      pointsDistance(controls.mouse.x, controls.mouse.y, controls.pointerStart.x, controls.pointerStart.y) > 5
    ) {
      controls.mouseRectangle = {
        x: controls.pointerStart.x,
        y: controls.pointerStart.y,
        width: 0,
        height: 0,
        graph: new Graphics(),
      }
      app.stage.addChild(controls.mouseRectangle.graph)
    }

    if (controls.mouseRectangle) {
      if (player.selectedUnits.length || player.selectedBuilding) {
        player.unselectAll()
      }
      const graph = controls.mouseRectangle.graph
      graph.clear()

      controls.mouseRectangle.width = controls.mouse.x - controls.mouseRectangle.x
      controls.mouseRectangle.height = controls.mouse.y - controls.mouseRectangle.y

      const x = Math.min(controls.mouseRectangle.x, controls.mouseRectangle.x + controls.mouseRectangle.width)
      const y = Math.min(controls.mouseRectangle.y, controls.mouseRectangle.y + controls.mouseRectangle.height)
      const w = Math.abs(controls.mouseRectangle.width)
      const h = Math.abs(controls.mouseRectangle.height)

      graph.rect(x, y, w, h).stroke(COLOR_WHITE)
    }
  }

  handleMouseUp(): void {
    const { controls } = this
    if (!canUseRtsSelection(controls)) return
    const {
      context: { menu, player },
    } = controls

    let selectVillager: UnitEntity | undefined
    let countSelect = 0
    player.unselectAll()
    const rectangle = controls.mouseRectangle
    if (!rectangle) return
    for (let i = 0; i < player.units.length; i++) {
      const unit = player.units[i]
      if (
        player.selectedUnits.length < MAX_SELECT_UNITS &&
        this.isUnitSelectable(unit) &&
        this.isUnitInsideSelection(unit, rectangle)
      ) {
        unit.select?.()
        countSelect++
        if (unit.type === UNIT_TYPES.villager) selectVillager = unit
        player.selectedUnits.push(unit)
      }
    }
    if (countSelect) {
      if (selectVillager) {
        player.selectedUnit = selectVillager
        menu.setActionTarget(selectVillager)
      } else {
        // TODO SELECT UNITS THAT HAVE THE MOST FREQUENCY
        player.selectedUnit = player.selectedUnits[0]
        menu.setActionTarget(player.selectedUnits[0])
      }
    }
    if (controls.mouseRectangle) {
      controls.mouseRectangle.graph.destroy(true)
      controls.mouseRectangle = null
    }
  }

  isUnitSelectable(unit: UnitEntity): boolean {
    return Boolean(
      unit &&
        !unit.loadedInTransport &&
        !unit.isDead &&
        !unit.isDestroyed &&
        unit.visible !== false &&
        canSelectUnitWithRts(unit)
    )
  }

  handleClick(cell: RuntimeCell): void {
    const { controls } = this
    const pointerSheet = Assets.cache.get(COMMAND_POINTER_SHEET_ID) as { textures: Record<string, Texture> }
    const pointer = new AnimatedSprite(getAnimationFrames(pointerSheet.textures)) as InteractiveSprite
    bindAnimatedSpriteToTicker(pointer, controls.context.app)
    pointer.animationSpeed = 0.2
    pointer.loop = false
    pointer.anchor.set(0.5, 0.5)
    const pointerPos = controls.screenToLocal(controls.mouse.x, controls.mouse.y)
    pointer.x = pointerPos.x
    pointer.y = pointerPos.y
    pointer.eventMode = 'auto'
    pointer.roundPixels = true
    pointer.onComplete = () => {
      pointer.destroy()
    }
    pointer.play()
    controls.addChild(pointer)
    this.sendUnits(cell)
  }

  sendUnits(cell: RuntimeCell): void {
    const { controls } = this
    const {
      context: { player, map },
    } = controls
    const commandableUnits = getRtsCommandableUnits(player.selectedUnits)
    if (!commandableUnits.length) return
    const { minX, minY, maxX, maxY } = this.getSelectionGridBounds(commandableUnits)
    const centerX = minX + Math.round((maxX - minX) / 2)
    const centerY = minY + Math.round((maxY - minY) / 2)
    let hasSentVillager = false
    let hasSentSoldier = false
    for (let u = 0; u < commandableUnits.length; u++) {
      const unit = commandableUnits[u]
      const finalX = cell.i + (unit.i - centerX)
      const finalY = cell.j + (unit.j - centerY)
      if (unit.type === UNIT_TYPES.villager) hasSentVillager = true
      else hasSentSoldier = true
      if (map.grid[finalX] && map.grid[finalX][finalY]) {
        unit.sendTo?.(map.grid[finalX][finalY])
      } else {
        unit.sendTo?.(cell)
      }
    }
    const selectedCommandSound = this.getSelectionCommandSound(commandableUnits)
    if (selectedCommandSound) {
      playSoundCue(selectedCommandSound)
      return
    }
    if (hasSentSoldier) {
      playSoundCue(SOUND_CUES.unit.militaryCommand)
    } else if (hasSentVillager) {
      playSoundCue(commandableUnits.find((unit: UnitEntity) => unit.type === UNIT_TYPES.villager)?.sounds?.command)
    }
  }

  getSelectionCommandSound(units: UnitEntity[]): CommandSound | null {
    if (!units.length) return null
    const getCommandSound = (unit: UnitEntity) => unit.sounds?.command ?? null
    if (!units.every(unit => getCommandSound(unit) != null)) return null
    const commandSound = getCommandSound(units[0])
    const normalizedCommandSound = JSON.stringify(commandSound)
    if (!units.every(unit => JSON.stringify(getCommandSound(unit)) === normalizedCommandSound)) return null
    return commandSound
  }

  isUnitInsideSelection(unit: UnitEntity, rectangle: SelectionRectangle): boolean {
    const screenPosition = this.controls.localToScreen(unit.x - this.controls.camera.x, unit.y - this.controls.camera.y)
    return pointInRectangle(
      screenPosition.x,
      screenPosition.y,
      rectangle.x,
      rectangle.y,
      rectangle.width,
      rectangle.height,
      true
    )
  }

  getSelectionGridBounds(units: UnitEntity[]): { minX: number; minY: number; maxX: number; maxY: number } {
    let minX = Infinity
    let minY = Infinity
    let maxX = -Infinity
    let maxY = -Infinity

    for (let i = 0; i < units.length; i++) {
      const unit = units[i]
      if (unit.i < minX) minX = unit.i
      if (unit.j < minY) minY = unit.j
      if (unit.i > maxX) maxX = unit.i
      if (unit.j > maxY) maxY = unit.j
    }

    return { minX, minY, maxX, maxY }
  }
}
