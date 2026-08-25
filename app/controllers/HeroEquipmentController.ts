import {
  applyToolAppearance,
  cancelHeroDefense,
  cancelHeroLasso,
  cancelHeroPowerCharge,
  HERO_TOOL_ORDER,
  isHeroPowerChargeActiveForTool,
  isHeroToolAvailable,
  type HeroEquippedItem,
} from '../lib/heroTools'
import type { ControlsLike } from '../types/context'
import type { UnitEntity } from '../types/entities'
import type { HeroAimPoint } from './HeroControllerSupport'

type HeroEquipmentHost = {
  controls: ControlsLike
  equippedItem: HeroEquippedItem | null
  heroUnit: UnitEntity | null
  mouseHeld: boolean
  primaryClickPoint: HeroAimPoint | null
}

export class HeroEquipmentController {
  host: HeroEquipmentHost

  constructor(host: HeroEquipmentHost) {
    this.host = host
  }

  equipToolAt(index: number): boolean {
    const tool = HERO_TOOL_ORDER[index]
    if (!tool) return false
    this.setEquippedItem(tool)
    return true
  }

  cycleTool(direction: 1 | -1): boolean {
    const currentIndex = Math.max(0, HERO_TOOL_ORDER.indexOf(this.host.equippedItem ?? 'interact'))
    const nextIndex = (currentIndex + direction + HERO_TOOL_ORDER.length) % HERO_TOOL_ORDER.length
    return this.equipToolAt(nextIndex)
  }

  setEquippedItem(item: HeroEquippedItem | null): void {
    const unit = this.host.heroUnit
    if (item && unit && !isHeroToolAvailable(unit, item)) return
    if (unit?.heroDefenseActive) cancelHeroDefense(unit)
    if (unit && item !== 'lasso') cancelHeroLasso(unit)
    if (unit && !isHeroPowerChargeActiveForTool(unit, item)) {
      cancelHeroPowerCharge(unit)
      this.host.mouseHeld = false
      this.host.primaryClickPoint = null
    }
    this.host.equippedItem = item
    if (unit?.actionLocked) {
      unit.stop?.()
    } else if (item && unit) {
      applyToolAppearance(unit, item)
    }
    this.host.controls.context.menu?.setEquippedItem?.(item)
    this.host.controls.context.menu?.setEquippedTool?.(item)
  }
}
