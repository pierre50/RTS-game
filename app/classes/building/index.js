import { AnimatedSprite, Assets, Sprite } from 'pixi.js'
import { Polygon } from 'pixi.js'
import { ACTION_TYPES, BUILDING_TYPES, FAMILY_TYPES, LABEL_TYPES, SOUND_CUES, UNIT_TYPES } from '../../constants'
import {
  getTexture,
  getInstanceZIndex,
  getPlainCellsAroundPoint,
  clearCellTerrainSet,
  drawInstanceBlinkingSelection,
  playerCanSeeInstance,
  getActionCondition,
  getBuildingAsset,
  getBuildingTextureNameWithSize,
  canUpdateMinimap,
  updateInstanceVisibility,
  playSoundCue,
  playSelectionSound,
  bindAnimatedSpriteToTicker,
  getRallyPointFrames,
} from '../../lib'
import { BuildingInterface } from '../../ui/BuildingInterface'
import { BuildingLifecycle } from './BuildingLifecycle'
import { BuildingProduction } from './BuildingProduction'
import { Instance } from '../Instance'
import { BuildingCombat } from './BuildingCombat'
import { getTowerType, isTower } from '../../lib/buildings/towers'

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
    this.rallyPoint = null
    this.rallyPointFlag = null

    Object.assign(this, options)
    Object.assign(this, this.owner.config.buildings[this.type])
    if (isTower(this)) {
      const effectiveType = getTowerType(this.owner)
      if (effectiveType !== this.type) Object.assign(this, this.owner.config.buildings[effectiveType])
    }
    this.populationCapacityApplied = Boolean(options.skipBuiltEffects && this.isBuilt)

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
    if (this.type === BUILDING_TYPES.dock) {
      spriteSheet = '000_356'
    }
    const texture = getTexture(spriteSheet, Assets)
    this.sprite = Sprite.from(texture)
    this.sprite.updateAnchor = true
    this.sprite.label = LABEL_TYPES.sprite
    this.sprite.hitArea = texture.hitArea
      ? new Polygon(texture.hitArea)
      : new Polygon([-32 * this.size, 0, 0, -16 * this.size, 32 * this.size, 0, 0, 16 * this.size])
    const units = context.editor ? [] : (this.units || []).map(key => context.menu.getUnitButton(key))
    const technologies = context.editor
      ? []
      : (this.technologies || []).map(key => context.menu.getTechnologyButton(key))
    this.interface = {
      info: element => {
        const displayType = isTower(this) ? getTowerType(this.owner) : this.type
        const assets = getBuildingAsset(displayType, this.owner, Assets)
        this.buildingInterface.renderInfo(element, assets)
      },
      menu:
        this.owner.isPlayed || map.instantMode
          ? [...units, ...technologies, ...(units.length ? [context.menu.getRallyPointButton()] : [])]
          : [],
    }

    // Set solid zone
    const dist = this.size === 3 ? 1 : 0
    getPlainCellsAroundPoint(this.i, this.j, map.grid, dist, cell => {
      clearCellTerrainSet(cell)
      for (const corpse of cell.corpses) {
        typeof corpse.clear === 'function' && corpse.clear()
      }
      cell.has = this
      cell.solid = true
      const visiblePlayers = this.owner.visiblePlayers ? this.owner.visiblePlayers() : [this.owner]
      for (const viewer of visiblePlayers) {
        viewer.views.addViewer(cell.i, cell.j, this)
        if (viewer.views.setViewed(cell.i, cell.j)) {
          viewer.cellViewed++
        }
      }
      cell.viewBy = new Set(this.context.player.views.getViewers(cell.i, cell.j))
      if (this.context.player.views.hasViewer(cell.i, cell.j, this) && !map.revealEverything) {
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
          context: { controls, player, menu, editor },
        } = this
        if (editor?.handleEntityInteraction(this)) return
        if (controls.rallyPointController?.active && controls.rallyPointController.building === this) {
          controls.mouse.prevent = true
          drawInstanceBlinkingSelection(this)
          controls.rallyPointController.cancel({ clear: true })
          return
        }
        if (controls.rallyPointController?.active) {
          controls.mouse.prevent = true
          controls.rallyPointController.handleMouseUpOnEntity(this)
          return
        }
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
              playSoundCue(SOUND_CUES.unit.militaryCommand)
              return
            } else if (hasSentVillager) {
              const voice = Assets.cache.get('config').units.Villager.sounds.buildCommand
              playSoundCue(voice)
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
              const voice = Assets.cache.get('config').units.Villager.sounds.buildCommand
              playSoundCue(voice)
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
            playSelectionSound(this)
          }
        } else if (playerCanSeeInstance(this, player) || map.revealEverything) {
          player.unselectAll()
          this.select()
          menu.setBottombar(this)
          player.selectedOther = this
          playSelectionSound(this)
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
    if (options.rallyPoint) {
      this.setRallyPoint(map.grid[options.rallyPoint.i]?.[options.rallyPoint.j], options.rallyPoint.direction)
    }
    map.addToInstanceBucket(this)
  }

  attackAction(target) {
    return this.buildingCombat.attackAction(target)
  }

  startInterval(callback, time, name = 'building.interval') {
    this.stopInterval()
    this.intervalId = this.context.scheduler.add(callback, (time * 1000) / 100, name)
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
    this.attackIntervalId = this.context.scheduler.add(callback, time * 1000, 'building.attack')
  }

  stopAttackInterval() {
    if (this.attackIntervalId != null) {
      this.context.scheduler.remove(this.attackIntervalId)
      this.attackIntervalId = null
    }
  }

  startTimeout(cb, time) {
    this.stopTimeout()
    this.timeoutId = this.context.scheduler.addOneShot(cb, time * 1000, 'building.timeout')
  }

  isAttacked(instance) {
    return this.buildingCombat.isAttacked(instance)
  }

  detect(instance) {
    return this.buildingCombat.detect(instance)
  }

  select() {
    if (this.selected) return
    const {
      context: { menu, player },
    } = this
    if (this.owner.isPlayed && this.sounds?.create) playSoundCue(this.sounds.create)
    super.select()
    if (this.rallyPointFlag) this.rallyPointFlag.visible = true
    if (this.loading && this.owner.isPlayed) this.updateInterfaceLoading()
    canUpdateMinimap(this, player) && menu.updatePlayerMiniMapEvt(this.owner)
  }

  unselect() {
    if (!this.selected) return
    super.unselect()
    if (this.rallyPointFlag) this.rallyPointFlag.visible = false
    const {
      context: { menu, player },
    } = this
    canUpdateMinimap(this, player) && menu.updatePlayerMiniMapEvt(this.owner)
  }

  setRallyPoint(cell, direction = this.context.map.randomRange(0, 1)) {
    if (!cell) return false
    this.clearRallyPoint()
    this.rallyPoint = { i: cell.i, j: cell.j, direction }
    const sheet = Assets.cache.get('459')
    const flag = new AnimatedSprite(getRallyPointFrames(sheet.textures, direction))
    bindAnimatedSpriteToTicker(flag, this.context.app)
    flag.animationSpeed = sheet.data.animationSpeed ?? 0.2
    flag.anchor.set(flag.texture.defaultAnchor.x, flag.texture.defaultAnchor.y)
    flag.x = cell.x
    flag.y = cell.y
    flag.zIndex = getInstanceZIndex({ x: cell.x, y: cell.y, z: cell.z })
    flag.visible = this.selected
    flag.eventMode = 'none'
    flag.roundPixels = true
    flag.play()
    this.context.map.addChild(flag)
    this.rallyPointFlag = flag
    return true
  }

  clearRallyPoint() {
    this.rallyPointFlag?.destroy()
    this.rallyPointFlag = null
    this.rallyPoint = null
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
  placeUnit(type, extra) {
    return this.buildingProduction.placeUnit(type, extra)
  }

  buyUnit(type, alreadyPaid = false, force = false, extra) {
    return this.buildingProduction.buyUnit(type, alreadyPaid, force, extra)
  }

  cancelUnits(type) {
    return this.buildingProduction.cancelUnits(type)
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
