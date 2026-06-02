import { sound } from '@pixi/sound'
import { ACCELERATOR, CORPSE_TIME, MENU_INFO_IDS, POPULATION_MAX, SHEET_TYPES } from '../../constants'
import { canUpdateMinimap, randomItem, updateInstanceVisibility } from '../../lib'

export class UnitLifecycle {
  constructor(unit) {
    this.unit = unit
  }

  decompose() {
    const unit = this.unit
    const {
      context: { map },
    } = unit
    unit.setTextures(SHEET_TYPES.corpse)
    unit.sprite.animationSpeed = (1 / (CORPSE_TIME * 1000)) * ACCELERATOR
    if (map.grid[unit.i][unit.j].has === unit) {
      map.grid[unit.i][unit.j].has = null
      map.grid[unit.i][unit.j].corpses.add(unit)
      map.grid[unit.i][unit.j].solid = false
    }
  }

  death() {
    const unit = this.unit
    unit.setTextures(SHEET_TYPES.dying)
    unit.zIndex--
    unit.sprite.loop = false
    unit.sprite.onComplete = () => {
      updateInstanceVisibility(unit)
      const index = unit.owner.corpses.indexOf(unit)
      if (index < 0) {
        unit.owner.corpses.push(unit)
      }
      this.decompose()
    }
  }

  die() {
    const unit = this.unit
    if (unit.isDead) {
      return
    }
    const {
      context: { player, menu },
    } = unit

    unit.sounds &&
      unit.sounds.die &&
      unit.context.controls.instanceIsAudible(unit) &&
      sound.play(Array.isArray(unit.sounds.die) ? randomItem(unit.sounds.die) : unit.sounds.die)

    unit.stopInterval()
    clearTimeout(unit.visibilityTimeout)
    if (unit.selected && player.selectedOther === unit) {
      player.unselectUnit(unit)
    }
    if (unit.dest && unit.dest.isUsedBy === unit) {
      unit.dest.isUsedBy = null
    }
    unit.hitPoints = 0
    unit.path = []
    unit.action = null
    unit.eventMode = 'none'
    unit.isDead = true
    unit.context.map.removeFromInstanceBucket(unit)
    unit.unselect()
    if (unit.owner) {
      unit.owner.population--
      if (unit.owner.isPlayed && unit.owner.selectedBuilding && unit.owner.selectedBuilding.displayPopulation) {
        menu.updateInfo(
          MENU_INFO_IDS.populationText,
          unit.owner.population + '/' + Math.min(POPULATION_MAX, unit.owner.population_max)
        )
      }
      const index = unit.owner.units.indexOf(unit)
      if (index >= 0) {
        unit.owner.units.splice(index, 1)
        if (unit.owner.units.length === 0 && unit.owner.buildings.length === 0) {
          menu.updatePlayerStats()
        }
      }
      if (unit.owner.selectedUnit === unit) {
        menu.updateInfo(MENU_INFO_IDS.hitPoints, unit.hitPoints + '/' + unit.totalHitPoints)
      }
    }
    this.death()
    canUpdateMinimap(unit, player) && menu.updatePlayerMiniMapEvt(unit.owner)
    unit.context.checkVictory?.()
    unit.context.checkDefeat?.()
  }

  clear() {
    const unit = this.unit
    const {
      context: { map },
    } = unit
    unit.isDestroyed = true
    const index = unit.owner.corpses.indexOf(unit)
    if (index >= 0) {
      unit.owner.corpses.splice(index, 1)
    }
    map.grid[unit.i][unit.j].corpses.delete(unit)
    map.removeChild(unit)
    unit.destroy({ child: true, texture: true })
  }
}
