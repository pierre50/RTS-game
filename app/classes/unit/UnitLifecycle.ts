import { BOAT_CORPSE_TIME, CORPSE_TIME, MENU_INFO_IDS, POPULATION_MAX, SHEET_TYPES } from '../../constants'
import {
  canUpdateMinimap,
  getTransportCargo,
  isTransportBoat,
  playAudibleSoundCue,
  updateInstanceVisibility,
} from '../../lib'
import { clearDamageFeedback } from '../../lib/combatFeedback'
import type { AnimatedSprite } from 'pixi.js'
import type { UnitEntity } from '../../types/entities'

const BOAT_CATEGORY = 'Boat'

export class UnitLifecycle {
  unit: UnitEntity

  constructor(unit: UnitEntity) {
    this.unit = unit
  }

  decompose() {
    const unit = this.unit
    const map = unit.context?.map
    clearDamageFeedback(unit)
    unit.setTextures?.(SHEET_TYPES.corpse)
    if (unit.sailSprite) unit.sailSprite.visible = false
    const sprite = unit.sprite as AnimatedSprite
    sprite.loop = false
    unit.syncShadow?.()
    const corpseTime = unit.category === BOAT_CATEGORY ? BOAT_CORPSE_TIME : CORPSE_TIME
    sprite.animationSpeed = sprite.textures.length / (corpseTime * 60)
    sprite.onComplete = () => unit.clear?.()
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
    clearDamageFeedback(unit)
    if (unit.category === BOAT_CATEGORY) {
      const corpses = unit.owner?.corpses
      const index = corpses?.indexOf(unit) ?? -1
      if (index < 0) {
        corpses?.push(unit)
      }
      this.decompose()
      return
    }

    unit.setTextures?.(SHEET_TYPES.dying)
    if (unit.sailSprite) unit.sailSprite.visible = false
    unit.zIndex = (unit.zIndex ?? 0) - 1
    const sprite = unit.sprite as AnimatedSprite
    sprite.loop = false
    unit.syncShadow?.()
    sprite.onComplete = () => {
      updateInstanceVisibility(unit)
      const corpses = unit.owner?.corpses
      const index = corpses?.indexOf(unit) ?? -1
      if (index < 0) {
        corpses?.push(unit)
      }
      this.decompose()
    }
  }

  die() {
    const unit = this.unit
    if (unit.isDead) {
      return
    }
    const player = unit.owner
    const menu = unit.context?.menu

    playAudibleSoundCue(unit, unit.sounds?.die)

    unit.stopInterval?.()
    clearTimeout(unit.visibilityTimeout as number | undefined)
    clearDamageFeedback(unit)
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
    if (isTransportBoat(unit)) {
      const cargo = getTransportCargo(unit)
      for (const cargoUnit of [...cargo]) {
        cargoUnit.loadedInTransport = null
        cargoUnit.die?.()
      }
      unit.transportedUnits = []
    }
    unit.eventMode = 'none'
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
        menu?.updateInfo?.(MENU_INFO_IDS.hitPoints, unit.hitPoints + '/' + unit.totalHitPoints)
      }
    }
    this.death()
    canUpdateMinimap(unit, player) && unit.owner && menu?.updatePlayerMiniMapEvt?.(unit.owner)
    unit.context?.checkVictory?.()
    unit.context?.checkDefeat?.()
  }

  clear() {
    const unit = this.unit
    const map = unit.context?.map
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
