import { CORPSE_TIME, FADE_DURATION_MS, MENU_INFO_IDS, POPULATION_MAX, SHEET_TYPES } from '../../constants'
import { canUpdateMinimap, getEntityCell, playAudibleSoundCue, updateInstanceVisibility } from '../../lib'
import { runAfterDeathFlash } from '../../lib/entities/deathFlash'
import { clearEntityVisualFeedback } from '../../lib/entities/entityVisualFeedback'
import { fadeOutThenClear } from '../../lib/entities/entityFade'
import { clearCombatAttackRecovery } from '../../lib/combat/combatAttackLoop'
import { initializeUnitCorpseLootEquipment } from '../../lib/equipment/equipmentLoot'
import { getEntityHitPointsText } from '../../lib/entities/entityHealthDisplay'
import { isUnitVisualAnimationCurrent, setUnitVisualSheet } from '../../lib/units/unitVisualTransition'
import { clearSleepingVisualState } from '../../services/rest/UnitSleepVisuals'
import type { AnimatedSprite } from 'pixi.js'
import type { UnitEntity } from '../../types/entities'

type ParentDisplay = {
  parent?: {
    removeChild: (child: unknown) => unknown
  } | null
}

export class UnitLifecycle {
  unit: UnitEntity

  constructor(unit: UnitEntity) {
    this.unit = unit
  }

  decompose() {
    const unit = this.unit
    const map = unit.context?.map
    const sprite = unit.sprite as AnimatedSprite
    clearEntityVisualFeedback(unit)
    const token = setUnitVisualSheet(unit, SHEET_TYPES.corpse, {
      frame: 0,
      loop: false,
      play: 'play',
    })
    sprite.animationSpeed = sprite.textures.length / (CORPSE_TIME * 60)
    sprite.onComplete = () => {
      if (isUnitVisualAnimationCurrent(unit, token)) fadeOutThenClear(unit, FADE_DURATION_MS)
    }
    if (map) {
      const cell = getEntityCell(unit, map)
      if (cell?.has === unit) {
        cell.has = null
        cell.corpses.add(unit)
        cell.solid = false
      }
    }
  }

  death() {
    const unit = this.unit
    clearEntityVisualFeedback(unit)
    const sprite = unit.sprite as AnimatedSprite
    const token = setUnitVisualSheet(unit, SHEET_TYPES.dying, {
      frame: 0,
      loop: false,
      play: 'play',
    })
    unit.zIndex = (unit.zIndex ?? 0) - 1
    sprite.onComplete = runAfterDeathFlash(sprite, () => {
      if (!isUnitVisualAnimationCurrent(unit, token)) return
      updateInstanceVisibility(unit)
      const corpses = unit.owner?.corpses
      const index = corpses?.indexOf(unit) ?? -1
      if (index < 0) {
        corpses?.push(unit)
      }
      this.decompose()
    })
  }

  die() {
    const unit = this.unit
    if (unit.isDead) {
      return
    }
    const player = unit.owner
    const menu = unit.context?.menu

    playAudibleSoundCue(unit, unit.sounds?.die, { profile: 'combat' })

    unit.stopInterval?.()
    clearCombatAttackRecovery(unit)
    clearSleepingVisualState(unit)
    clearTimeout(unit.visibilityTimeout as number | undefined)
    clearEntityVisualFeedback(unit)
    if (unit.selected && unit.owner?.isPlayed) {
      player?.unselectUnit?.(unit)
    }
    const dest = unit.dest
    if (dest && 'isUsedBy' in dest && dest.isUsedBy === unit) {
      dest.isUsedBy = null
    }
    unit.hitPoints = 0
    unit.path = []
    unit.action = null
    unit.isDead = true
    initializeUnitCorpseLootEquipment(unit)
    unit.removeHealthBar?.()
    unit.context?.map.removeFromInstanceBucket(unit)
    unit.unselect?.()
    if (unit.owner) {
      unit.owner.population--
      if (unit.owner.isPlayed && unit.owner.selectedBuilding && unit.owner.selectedBuilding.displayPopulation) {
        menu?.updateInfo?.(
          MENU_INFO_IDS.populationText,
          unit.owner.population + '/' + Math.min(POPULATION_MAX, unit.owner.populationMax)
        )
      }
      const index = unit.owner.units.indexOf(unit)
      if (index >= 0) {
        unit.owner.units.splice(index, 1)
      }
      if (unit.owner.selectedUnit === unit) {
        menu?.updateInfo?.(MENU_INFO_IDS.hitPoints, getEntityHitPointsText(unit))
      }
    }
    this.death()
    canUpdateMinimap(unit, player) &&
      unit.owner &&
      menu?.isMiniMapActive?.() !== false &&
      menu?.updatePlayerMiniMapEvt?.(unit.owner)
    unit.context?.checkDefeat?.()
  }

  clear() {
    const unit = this.unit
    const map = unit.context?.map
    clearEntityVisualFeedback(unit)
    unit.isDestroyed = true
    const corpses = unit.owner?.corpses
    const index = corpses?.indexOf(unit) ?? -1
    if (index >= 0) {
      corpses?.splice(index, 1)
    }
    if (map) {
      getEntityCell(unit, map)?.corpses.delete(unit)
      ;(unit as ParentDisplay).parent?.removeChild(unit)
    }
    unit.destroy?.({
      children: true,
      texture: false,
    })
  }
}
