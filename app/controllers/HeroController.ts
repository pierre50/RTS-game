import { getInstanceDegree } from '../lib'
import { ARPG_DIRECTIONS, ARPG_KEYS, HERO_ACTION_MOVE_SPEED_FACTOR, SHEET_TYPES, STEP_TIME } from '../constants'
import { applyToolAppearance, triggerToolAction, triggerToolAttackAt, type HeroTool } from '../lib/heroTools'
import { setUnitControlMode } from '../lib/unitControl'
import type Controls from '../classes/Controls'
import type { UnitEntity } from '../types/entities'

const TARGET_FRAME_MS = 1000 / 60

export class HeroController {
  controls: Controls
  heroUnit: UnitEntity | null
  equippedTool: HeroTool | null
  keysPressed: Set<string>
  wasMoving: boolean
  mouseHeld: boolean

  constructor(controls: Controls) {
    this.controls = controls
    this.heroUnit = null
    this.equippedTool = null
    this.keysPressed = new Set()
    this.wasMoving = false
    this.mouseHeld = false
  }

  isActive(): boolean {
    return Boolean(this.heroUnit && !this.heroUnit.isDead && !this.heroUnit.isDestroyed)
  }

  handleKeyDown(key: string): boolean {
    if (!this.isActive()) return false

    if (key === 'i') {
      this.controls.context.menu?.toggleInventory?.()
      return true
    }

    if (key === 'e') {
      if (this.heroUnit) triggerToolAction(this.heroUnit, this.equippedTool)
      return true
    }

    if (ARPG_KEYS.has(key)) {
      if (this.keysPressed.size === 0 && !this.heroUnit?.actionLocked) this.heroUnit?.stop?.()
      this.keysPressed.add(key)
      return true
    }

    return false
  }

  handleKeyUp(key: string): void {
    if (ARPG_KEYS.has(key)) this.keysPressed.delete(key)
    if (key === 'e') this.heroUnit?.stop?.()
  }

  update(frameScale: number): void {
    const unit = this.heroUnit
    if (!unit) return
    if (this.mouseHeld && !unit.actionLocked && unit.currentSheet !== SHEET_TYPES.action) this.attackTowardCursor()
    const attacking = Boolean(unit.actionLocked)

    let dx = 0
    let dy = 0
    for (const key of this.keysPressed) {
      const dir = ARPG_DIRECTIONS[key]
      if (!dir) continue
      dx += dir.dx
      dy += dir.dy
    }
    const isMoving = dx !== 0 || dy !== 0

    // Gather/build actions own the action sheet callback; idle aiming must not reset it.
    if (!attacking && !isMoving && unit.currentSheet !== SHEET_TYPES.action) {
      const aimPoint = this.controls.getWorldPointUnderCursor()
      const aimDegree = getInstanceDegree(unit, aimPoint.x, aimPoint.y)
      if (unit.degree !== aimDegree) {
        unit.degree = aimDegree
        unit.setTextures?.(unit.currentSheet === SHEET_TYPES.walking ? SHEET_TYPES.walking : SHEET_TYPES.standing)
      }
    }

    let moved = false
    if (isMoving) {
      const len = Math.hypot(dx, dy)
      const speedFactor = attacking ? HERO_ACTION_MOVE_SPEED_FACTOR : 1
      const distance = (unit.speed ?? 0) * speedFactor * (TARGET_FRAME_MS / STEP_TIME) * frameScale
      moved = unit.moveDirect?.(dx / len, dy / len, distance) ?? false
    }
    if (moved) {
      if (!attacking && unit.currentSheet !== SHEET_TYPES.walking) unit.setTextures?.(SHEET_TYPES.walking)
      if (!attacking && !unit.sprite?.playing) unit.sprite?.play?.()
      this.wasMoving = true
    } else if (this.wasMoving) {
      this.wasMoving = false
      if (!attacking) {
        unit.setTextures?.(SHEET_TYPES.standing)
        unit.sprite?.stop?.()
      }
    }
  }

  attackTowardCursor(): boolean {
    const hero = this.heroUnit
    if (!hero) return false
    if (hero.actionLocked) return false
    hero.stop?.()
    return triggerToolAttackAt(hero, this.equippedTool, this.controls.getWorldPointUnderCursor())
  }

  handlePrimaryPointerDown(): void {
    const beforeLoad = this.heroUnit?.loading ?? 0
    const triggered = this.attackTowardCursor()
    const unit = this.heroUnit
    const deliveredLoad = beforeLoad > 0 && (unit?.loading ?? 0) <= 0
    this.mouseHeld = triggered && !deliveredLoad
  }

  handlePointerUp(): void {
    this.mouseHeld = false
    const unit = this.heroUnit
    if (!unit || unit.actionLocked || unit.currentSheet !== SHEET_TYPES.action) return
    const sprite = unit.sprite
    if (!sprite) {
      unit.previousDest = null
      unit.stop?.()
      return
    }
    sprite.onLoop = () => {
      sprite.onLoop = undefined
      unit.previousDest = null
      unit.stop?.()
    }
  }

  setEquippedTool(tool: HeroTool | null): void {
    this.equippedTool = tool
    if (tool && this.heroUnit) applyToolAppearance(this.heroUnit, tool)
    this.controls.context.menu?.setEquippedTool?.(tool)
  }

  stopKeyboardMove(): void {
    this.keysPressed.clear()
  }

  cancelActiveInteraction(): void {
    this.stopKeyboardMove()
    this.mouseHeld = false
  }

  initFromPlayerStart(): boolean {
    const {
      context: { map, player },
    } = this.controls

    if (!map.arpgMode || !player?.units?.length) return false

    if (this.heroUnit && this.heroUnit !== player.units[0]) {
      setUnitControlMode(this.heroUnit, 'rts')
    }
    this.heroUnit = player.units[0]
    setUnitControlMode(this.heroUnit, 'arpg')
    this.heroUnit.stop?.()
    player.unselectAll?.()
    this.heroUnit.select?.()
    player.selectedUnit = this.heroUnit
    player.selectedUnits = [this.heroUnit]
    this.setEquippedTool('unarmed')
    this.controls.context.menu?.setBottombar?.(this.heroUnit)
    this.controls.setCamera(this.heroUnit.x, this.heroUnit.y)
    return true
  }
}
