import { sound } from '@pixi/sound'
import { Assets, Sprite } from 'pixi.js'
import { Polygon } from 'pixi.js'
import {
  ACTION_TYPES,
  BUILDING_TYPES,
  FAMILY_TYPES,
  LABEL_TYPES,
  UNIT_TYPES,
} from '../../constants'
import {
  getTexture,
  randomItem,
  getInstanceZIndex,
  getPlainCellsAroundPoint,
  drawInstanceBlinkingSelection,
  playerCanSeeInstance,
  getActionCondition,
  getBuildingAsset,
  getBuildingTextureNameWithSize,
  canUpdateMinimap,
  updateInstanceVisibility,
} from '../../lib'
import { BuildingInterface } from '../../ui/BuildingInterface'
import { BuildingLifecycle } from './BuildingLifecycle'
import { BuildingProduction } from './BuildingProduction'
import { Instance } from '../Instance'
import { BuildingCombat } from './BuildingCombat'

export class Building extends Instance {
  constructor(options, context) {
    super(context)

    const { map, controls } = context

    this.family = FAMILY_TYPES.building
    this.buildingInterface = new BuildingInterface(this)
    this.buildingLifecycle = new BuildingLifecycle(this)
    this.buildingProduction = new BuildingProduction(this)
    this.buildingCombat = new BuildingCombat(this)
    this.queue = []
    this.technology = null
    this.loading = null
    this.isUsedBy = null

    Object.assign(this, options)
    Object.assign(this, this.owner.config.buildings[this.type])

    this.intervalId = null
    this.attackIntervalId = null

    if (this.queue.length) {
      this.buyUnit(this.queue[0], true, true)
    } else if (this.technology) {
      this.buyTechnology(this.technology.type, true, true)
    }

    this.quantity = this.quantity ?? this.totalQuantity
    this.hitPoints = this.hitPoints ?? (this.isBuilt ? this.totalHitPoints : 1)

    this.x = map.grid[this.i][this.j].x
    this.y = map.grid[this.i][this.j].y
    this.z = map.grid[this.i][this.j].z
    this.zIndex = getInstanceZIndex(this)
    this.visible = map.revealEverything && controls.instanceInCamera(this)
    let spriteSheet = getBuildingTextureNameWithSize(this.size)
    if (this.type === BUILDING_TYPES.house && this.owner.age === 0) {
      spriteSheet = '000_489'
    } else if (this.type === BUILDING_TYPES.dock) {
      spriteSheet = '000_356'
    }
    const texture = getTexture(spriteSheet, Assets)
    this.sprite = Sprite.from(texture)
    this.sprite.updateAnchor = true
    this.sprite.label = LABEL_TYPES.sprite
    this.sprite.hitArea = texture.hitArea
      ? new Polygon(texture.hitArea)
      : new Polygon([-32 * this.size, 0, 0, -16 * this.size, 32 * this.size, 0, 0, 16 * this.size])
    const units = (this.units || []).map(key => context.menu.getUnitButton(key))
    const technologies = (this.technologies || []).map(key => context.menu.getTechnologyButton(key))
    this.interface = {
      info: element => {
        const assets = getBuildingAsset(this.type, this.owner, Assets)
        this.buildingInterface.renderInfo(element, assets)
      },
      menu: this.owner.isPlayed || map.instantMode ? [...units, ...technologies] : [],
    }

    // Set solid zone
    const dist = this.size === 3 ? 1 : 0
    getPlainCellsAroundPoint(this.i, this.j, map.grid, dist, cell => {
      const set = cell.getChildByLabel(LABEL_TYPES.set)
      if (set) {
        cell.removeChild(set)
      }
      for (const corpse of cell.corpses) {
        typeof corpse.clear === 'function' && corpse.clear()
      }
      cell.has = this
      cell.solid = true
      const visiblePlayers = this.owner.visiblePlayers ? this.owner.visiblePlayers() : [this.owner]
      for (const viewer of visiblePlayers) {
        const viewerCell = viewer.views[cell.i][cell.j]
        viewerCell.viewBy.add(this)
        if (!viewerCell.viewed) {
          viewer.cellViewed++
          viewerCell.onViewed?.()
          viewerCell.viewed = true
        }
      }
      cell.viewBy = new Set([...this.context.player.views[cell.i][cell.j].viewBy])
      if (this.context.player.views[cell.i][cell.j].viewBy.has(this) && !map.revealEverything) {
        cell.removeFog()
      }
    })

    this.allowMove = false
    if (this.sprite) {
      this.sprite.allowMove = false
      this.sprite.eventMode = 'static'
      this.sprite.roundPixels = true

      this.sprite.on('pointertap', evt => {
        const {
          context: { controls, player, menu },
        } = this
        if (controls.mouseBuilding || controls.mouseRectangle || !controls.isMouseInApp(evt)) {
          return
        }
        let hasSentVillager = false
        let hasSentOther = false
        controls.mouse.prevent = true
        if (this.owner.isPlayed) {
          if (!this.isBuilt) {
            for (let i = 0; i < player.selectedUnits.length; i++) {
              const unit = player.selectedUnits[i]
              if (unit.type === UNIT_TYPES.villager) {
                if (getActionCondition(unit, this, ACTION_TYPES.build)) {
                  hasSentVillager = true
                  unit.sendToBuilding(this)
                }
              } else {
                unit.sendTo(this)
                hasSentOther = true
              }
            }
            if (hasSentVillager) {
              drawInstanceBlinkingSelection(this)
            }
            if (hasSentOther) {
              const voice = randomItem(['5075', '5076', '5128', '5164'])
              sound.play(voice)
              return
            } else if (hasSentVillager) {
              const voice = Assets.cache.get('config').units.Villager.sounds.build
              sound.play(voice)
              return
            }
          } else if (player.selectedUnits) {
            for (let i = 0; i < player.selectedUnits.length; i++) {
              const unit = player.selectedUnits[i]
              const accept =
                unit.category === 'Boat'
                  ? this.type === BUILDING_TYPES.dock
                  : this.type === BUILDING_TYPES.townCenter || (this.accept && this.accept.includes(unit.loadingType))
              if (unit.type === UNIT_TYPES.villager && getActionCondition(unit, this, ACTION_TYPES.build)) {
                hasSentVillager = true
                unit.previousDest = null
                unit.sendToBuilding(this)
              } else if (unit.type === UNIT_TYPES.villager && getActionCondition(unit, this, ACTION_TYPES.farm)) {
                hasSentVillager = true
                unit.sendToFarm(this)
              } else if (
                accept &&
                getActionCondition(unit, this, ACTION_TYPES.delivery, { buildingTypes: [this.type] })
              ) {
                hasSentVillager = true
                unit.previousDest = null
                unit.sendTo(this, ACTION_TYPES.delivery)
              }
            }
            if (hasSentVillager) {
              drawInstanceBlinkingSelection(this)
              const voice = Assets.cache.get('config').units.Villager.sounds.build
              sound.play(voice)
              return
            }
          }
          if (this.owner.selectedBuilding !== this) {
            this.owner.unselectAll()
            this.select()
            menu.setBottombar(this)
            this.owner.selectedBuilding = this
          }
        } else if (player.selectedUnits.length) {
          let hasSentAttacker = false
          for (let i = 0; i < player.selectedUnits.length; i++) {
            const playerUnit = player.selectedUnits[i]
            if (!getActionCondition(playerUnit, this, ACTION_TYPES.attack)) continue
            hasSentAttacker = true
            if (playerUnit.type === UNIT_TYPES.villager) {
              playerUnit.sendToAttack(this)
            } else {
              playerUnit.sendTo(this, ACTION_TYPES.attack)
            }
          }
          if (hasSentAttacker) {
            drawInstanceBlinkingSelection(this)
          } else if (playerCanSeeInstance(this, player) || map.revealEverything) {
            player.unselectAll()
            this.select()
            menu.setBottombar(this)
            player.selectedOther = this
          }
        } else if (playerCanSeeInstance(this, player) || map.revealEverything) {
          player.unselectAll()
          this.select()
          menu.setBottombar(this)
          player.selectedOther = this
        }
      })

      this.addChild(this.sprite)
    }

    if (this.isBuilt) {
      this.visibilityTimeout = setTimeout(() => {
        updateInstanceVisibility(this)
      })
      this.finalTexture()
      this.onBuilt()
    }
    map.addToInstanceBucket(this)
  }

  attackAction(target) {
    return this.buildingCombat.attackAction(target)
  }

  startInterval(callback, time) {
    this.stopInterval()
    this.intervalId = this.context.scheduler.add(callback, (time * 1000) / 100)
  }

  stopInterval() {
    if (this.intervalId != null) {
      this.context.scheduler.remove(this.intervalId)
      this.intervalId = null
    }
  }

  startAttackInterval(callback, time) {
    this.stopAttackInterval()
    callback()
    this.attackIntervalId = this.context.scheduler.add(callback, time * 1000)
  }

  stopAttackInterval() {
    if (this.attackIntervalId != null) {
      this.context.scheduler.remove(this.attackIntervalId)
      this.attackIntervalId = null
    }
  }

  startTimeout(cb, time) {
    this.stopTimeout()
    this.timeoutId = this.context.scheduler.addOneShot(cb, time * 1000)
  }

  isAttacked(instance) {
    return this.buildingCombat.isAttacked(instance)
  }

  detect(instance) {
    return this.buildingCombat.detect(instance)
  }

  select() {
    if (this.selected) return
    const { context: { menu, player } } = this
    if (this.owner.isPlayed && this.sounds?.create) sound.play(this.sounds.create)
    super.select()
    if (this.loading && this.owner.isPlayed) this.updateInterfaceLoading()
    canUpdateMinimap(this, player) && menu.updatePlayerMiniMapEvt(this.owner)
  }

  unselect() {
    if (!this.selected) return
    super.unselect()
    const { context: { menu, player } } = this
    canUpdateMinimap(this, player) && menu.updatePlayerMiniMapEvt(this.owner)
  }

  // BuildingLifecycle
  updateTexture() {
    return this.buildingLifecycle.updateTexture()
  }

  finalTexture() {
    return this.buildingLifecycle.finalTexture()
  }

  generateFire(spriteId) {
    return this.buildingLifecycle.generateFire(spriteId)
  }

  onBuilt() {
    return this.buildingLifecycle.onBuilt()
  }

  updateHitPoints(action) {
    return this.buildingLifecycle.updateHitPoints(action)
  }

  pause() {
    return this.buildingLifecycle.pause()
  }

  resume() {
    return this.buildingLifecycle.resume()
  }

  die() {
    return this.buildingLifecycle.die()
  }

  clear() {
    return this.buildingLifecycle.clear()
  }

  // BuildingProduction
  placeUnit(type) {
    return this.buildingProduction.placeUnit(type)
  }

  buyUnit(type, alreadyPaid = false, force = false, extra) {
    return this.buildingProduction.buyUnit(type, alreadyPaid, force, extra)
  }

  cancelTechnology() {
    return this.buildingProduction.cancelTechnology()
  }

  upgrade(type) {
    return this.buildingProduction.upgrade(type)
  }

  buyTechnology(type, alreadyPaid, force) {
    return this.buildingProduction.buyTechnology(type, alreadyPaid, force)
  }

  // BuildingInterface
  updateInterfaceLoading() {
    this.buildingInterface.updateLoading()
  }

  getLoadingElement() {
    return this.buildingInterface.getLoadingElement()
  }

  setDefaultInterface(element, data) {
    this.buildingInterface.setDefaultInterface(element, data)
  }
}
