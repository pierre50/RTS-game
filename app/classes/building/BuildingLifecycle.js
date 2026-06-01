import { Assets } from 'pixi.js'
import { BUILDING_TYPES, LABEL_TYPES, PLAYER_TYPES, RUBBLE_TIME } from '../../constants'
import {
  canUpdateMinimap,
  changeSpriteColorDirectly,
  getBuildingRubbleTextureNameWithSize,
  getPlainCellsAroundPoint,
  getTexture,
  updateInstanceVisibility,
} from '../../lib'

export class BuildingLifecycle {
  constructor(building) {
    this.building = building
  }

  die() {
    const building = this.building
    if (building.isDead) {
      return
    }
    const {
      context: { map, player, players, menu },
    } = building
    clearTimeout(building.visibilityTimeout)
    building.stopInterval()
    building.isDead = true
    map.removeFromInstanceBucket(building)
    if (building.selected && player) {
      player.unselectAll()
    }

    const index = building.owner.buildings.indexOf(building)
    if (index >= 0) {
      building.owner.buildings.splice(index, 1)
    }

    for (let i = 0; i < players.length; i++) {
      if (players[i].type === PLAYER_TYPES.ai) {
        players[i].foundedEnemyBuildings.delete(building)
      }
    }
    const color = building.getChildByLabel(LABEL_TYPES.color)
    color && color.destroy()
    const deco = building.getChildByLabel(LABEL_TYPES.deco)
    deco && deco.destroy()
    const fire = building.getChildByLabel(LABEL_TYPES.fire)
    fire && fire.destroy()

    let rubbleSheet = getBuildingRubbleTextureNameWithSize(building.size, Assets)
    if (building.type === BUILDING_TYPES.farm) {
      rubbleSheet = '000_239'
    }
    building.sprite.texture = getTexture(rubbleSheet, Assets)
    building.sprite.allowMove = false
    building.sprite.eventMode = 'none'
    building.sprite.allowClick = false
    building.zIndex--
    if (building.type === BUILDING_TYPES.farm) {
      changeSpriteColorDirectly(building.sprite, building.owner.color)
    }

    updateInstanceVisibility(building)
    const dist = building.size === 3 ? 1 : 0
    getPlainCellsAroundPoint(building.i, building.j, map.grid, dist, cell => {
      if (cell.has === building) {
        cell.has = null
        cell.solid = false
        cell.corpses.add(building)
      }
    })
    building.startTimeout(() => building.clear(), RUBBLE_TIME)
    canUpdateMinimap(building, player) && menu.updatePlayerMiniMapEvt(building.owner)
  }

  clear() {
    const building = this.building
    if (building.isDestroyed) {
      return
    }
    clearTimeout(building.visibilityTimeout)
    const {
      context: { map },
    } = building
    const dist = building.size === 3 ? 1 : 0
    getPlainCellsAroundPoint(building.i, building.j, map.grid, dist, cell => {
      cell.corpses.delete(building)
    })
    building.isDestroyed = true
    building.destroy({ child: true, texture: false })
  }
}
