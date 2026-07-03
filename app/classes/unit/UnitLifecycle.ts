import { BOAT_CORPSE_TIME, CORPSE_TIME, MENU_INFO_IDS, POPULATION_MAX, SHEET_TYPES } from '../../constants'
import { canUpdateMinimap, getTransportCargo, isPlayerEliminated, playAudibleSoundCue, updateInstanceVisibility } from '../../lib'

type AnyRecord = Record<string, any>

const BOAT_CATEGORY = 'Boat'

export class UnitLifecycle {
  unit: AnyRecord

  constructor(unit: AnyRecord) {
    this.unit = unit
  }

  decompose() {
    const unit = this.unit
    const {
      context: { map },
    } = unit
    unit.setTextures(SHEET_TYPES.corpse)
    if (unit.sailSprite) unit.sailSprite.visible = false
    unit.sprite.loop = false
    const corpseTime = unit.category === BOAT_CATEGORY ? BOAT_CORPSE_TIME : CORPSE_TIME
    unit.sprite.animationSpeed = unit.sprite.textures.length / (corpseTime * 60)
    unit.sprite.onComplete = () => unit.clear()
    if (map.grid[unit.i][unit.j].has === unit) {
      map.grid[unit.i][unit.j].has = null
      map.grid[unit.i][unit.j].corpses.add(unit)
      map.grid[unit.i][unit.j].solid = false
    }
  }

  death() {
    const unit = this.unit
    if (unit.category === BOAT_CATEGORY) {
      const index = unit.owner.corpses.indexOf(unit)
      if (index < 0) {
        unit.owner.corpses.push(unit)
      }
      this.decompose()
      return
    }

    unit.setTextures(SHEET_TYPES.dying)
    if (unit.sailSprite) unit.sailSprite.visible = false
    unit.zIndex--
    unit.sprite.loop = false
    unit.sprite.onComplete = () => {
      updateInstanceVisibility(unit as any)
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

    playAudibleSoundCue(unit, unit.sounds?.die)

    unit.stopInterval()
    clearTimeout(unit.visibilityTimeout)
    if (unit.selected && unit.owner?.isPlayed) {
      player.unselectUnit(unit)
    }
    if (unit.dest && unit.dest.isUsedBy === unit) {
      unit.dest.isUsedBy = null
    }
    unit.hitPoints = 0
    unit.path = []
    unit.action = null
    if (unit.transportCapacity) {
      for (const cargoUnit of [...getTransportCargo(unit as any)] as any[]) {
        cargoUnit.loadedInTransport = null
        cargoUnit.die()
      }
      unit.transportedUnits = []
    }
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
        if (isPlayerEliminated(unit.owner)) {
          menu.updatePlayerStats()
        }
      }
      if (unit.owner.selectedUnit === unit) {
        menu.updateInfo(MENU_INFO_IDS.hitPoints, unit.hitPoints + '/' + unit.totalHitPoints)
      }
    }
    this.death()
    canUpdateMinimap(unit as any, player) && menu.updatePlayerMiniMapEvt(unit.owner)
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
    unit.destroy({ children: true, texture: false })
  }
}
