import { CORPSE_TIME, FADE_DURATION_MS, MENU_INFO_IDS, POPULATION_MAX, SHEET_TYPES } from '../../constants'
import { canUpdateMinimap, playAudibleSoundCue, updateInstanceVisibility } from '../../lib'
import { runAfterDeathFlash } from '../../lib/entities/deathFlash'
import { clearEntityVisualFeedback } from '../../lib/entities/entityVisualFeedback'
import { fadeOutThenClear } from '../../lib/entities/entityFade'
import { getEntityHitPointsText } from '../../lib/entities/entityHealthDisplay'
import { playSpriteAnimationFromStart } from '../../lib/entities/spriteAnimation'
import type { AnimatedSprite } from 'pixi.js'
import type { UnitEntity } from '../../types/entities'

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
    unit.setTextures?.(SHEET_TYPES.corpse)
    sprite.loop = false
    unit.syncShadow?.()
    unit.syncAppearanceLayers?.(SHEET_TYPES.corpse)
    sprite.animationSpeed = sprite.textures.length / (CORPSE_TIME * 60)
    sprite.onComplete = () => fadeOutThenClear(unit, FADE_DURATION_MS)
    if (map) {
      const cell = map.grid[unit.i][unit.j]
      if (cell.has === unit) {
        cell.has = null
        cell.corpses.add(unit)
        cell.solid = false
      }
    }
  }

  death() {
    const unit = this.unit
    clearEntityVisualFeedback(unit)
    // dying/corpse are exempt from setUnitTexture's onFrameChange reset (kept for mid-attack direction changes), so a stale attack/gather callback must be cleared here or it hijacks the death animation back to standing.
    const sprite = unit.sprite as AnimatedSprite
    unit.setTextures?.(SHEET_TYPES.dying)
    unit.zIndex = (unit.zIndex ?? 0) - 1
    unit.syncShadow?.()
    playSpriteAnimationFromStart(sprite, {
      clearFrameChange: true,
      loop: false,
    })
    sprite.onComplete = runAfterDeathFlash(sprite, () => {
      updateInstanceVisibility(unit)
      const corpses = unit.owner?.corpses
      const index = corpses?.indexOf(unit) ?? -1
      if (index < 0) {
        corpses?.push(unit)
      }
      this.decompose()
    })
    unit.syncAppearanceLayers?.(SHEET_TYPES.dying)
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
      map.grid[unit.i][unit.j].corpses.delete(unit)
      map.removeChild(unit)
    }
    unit.destroy?.({
      children: true,
      texture: false,
    })
  }
}
