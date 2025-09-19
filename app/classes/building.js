import { sound } from '@pixi/sound'
import { Container, Assets, Sprite, AnimatedSprite, Graphics } from 'pixi.js'
import { ACCELERATOR, COLOR_WHITE, POPULATION_MAX, RUBBLE_TIME } from '../constants'
import {
  getTexture,
  getInstanceZIndex,
  getPlainCellsAroundPoint,
  getPercentage,
  renderCellOnInstanceSight,
  getFreeCellAroundPoint,
  getIconPath,
  canAfford,
  drawInstanceBlinkingSelection,
  payCost,
  instanceIsInPlayerSight,
  clearCellOnInstanceSight,
  getActionCondition,
  capitalizeFirstLetter,
  refundCost,
  getBuildingAsset,
  getBuildingRubbleTextureNameWithSize,
  instancesDistance,
  getBuildingTextureNameWithSize,
  uuidv4,
  canUpdateMinimap,
  CustomTimeout,
  changeSpriteColorDirectly,
} from '../lib'
import { Projectile } from './projectile'
import { Polygon } from 'pixi.js'

export class Building extends Container {
  constructor(options, context) {
    super()

    this.context = context

    const { map, controls } = context

    this.name = uuidv4()
    this.family = 'building'
    this.selected = false
    this.queue = []
    this.technology = null
    this.loading = null
    this.isDead = false
    this.isDestroyed = false
    this.timeout
    this.isUsedBy = null

    Object.keys(options).forEach(prop => {
      this[prop] = options[prop]
    })
    Object.keys(this.owner.config.buildings[this.type]).forEach(prop => {
      this[prop] = this.owner.config.buildings[this.type][prop]
    })

    this.interval
    this.attackInterval

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
    this.visible = map.revealEverything && controls.instanceInCamera(this) ? true : false
    let spriteSheet = getBuildingTextureNameWithSize(this.size)
    if (this.type === 'House' && this.owner.age === 0) {
      spriteSheet = '000_489'
    } else if (this.type === 'Dock') {
      spriteSheet = '000_356'
    }
    const texture = getTexture(spriteSheet, Assets)
    this.sprite = Sprite.from(texture)
    this.sprite.updateAnchor = true
    this.sprite.name = 'sprite'
    this.sprite.hitArea = texture.hitArea
      ? new Polygon(texture.hitArea)
      : new Polygon([-32 * this.size, 0, 0, -16 * this.size, 32 * this.size, 0, 0, 16 * this.size])
    const units = (this.units || []).map(key => context.menu.getUnitButton(key))
    const technologies = (this.technologies || []).map(key => context.menu.getTechnologyButton(key))
    this.interface = {
      info: element => {
        const assets = getBuildingAsset(this.type, this.owner, Assets)
        this.setDefaultInterface(element, assets)
        if (this.displayPopulation && this.owner.isPlayed && this.isBuilt) {
          const populationDiv = document.createElement('div')
          populationDiv.id = 'population'

          const populationIcon = document.createElement('img')
          const populationSpan = document.createElement('span')
          populationSpan.id = 'population-text'
          populationSpan.textContent = this.owner.population + '/' + Math.min(POPULATION_MAX, this.owner.POPULATION_MAX)

          populationIcon.src = getIconPath('004_50731')
          populationDiv.appendChild(populationIcon)
          populationDiv.appendChild(populationSpan)
          element.appendChild(populationDiv)
        }
        element.appendChild(this.getLoadingElement())
      },
      menu: this.owner.isPlayed || map.devMode ? [...units, ...technologies] : [],
    }

    // Set solid zone
    const dist = this.size === 3 ? 1 : 0
    getPlainCellsAroundPoint(this.i, this.j, map.grid, dist, cell => {
      const set = cell.getChildByName('set')
      if (set) {
        cell.removeChild(set)
      }
      for (let i = 0; i < cell.corpses.length; i++) {
        typeof cell.corpses[i].clear === 'function' && cell.corpses[i].clear()
      }
      cell.has = this
      cell.solid = true
      this.owner.views[cell.i][cell.j].viewBy.push(this)
      if (this.owner.isPlayed && !map.revealEverything) {
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
          // Send Villager to build the building
          if (!this.isBuilt) {
            for (let i = 0; i < player.selectedUnits.length; i++) {
              const unit = player.selectedUnits[i]
              if (unit.type === 'Villager') {
                if (getActionCondition(unit, this, 'build')) {
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
            // Send Villager to give loading of resources
            for (let i = 0; i < player.selectedUnits.length; i++) {
              const unit = player.selectedUnits[i]
              const accept =
                unit.category === 'Boat'
                  ? this.type === 'Dock'
                  : this.type === 'TownCenter' || (this.accept && this.accept.includes(unit.loadingType))
              if (unit.type === 'Villager' && getActionCondition(unit, this, 'build')) {
                hasSentVillager = true
                unit.previousDest = null
                unit.sendToBuilding(this)
              } else if (unit.type === 'Villager' && getActionCondition(unit, this, 'farm')) {
                hasSentVillager = true
                unit.sendToFarm(this)
              } else if (accept && getActionCondition(unit, this, 'delivery', { buildingTypes: [this.type] })) {
                hasSentVillager = true
                unit.previousDest = null
                unit.sendTo(this, 'delivery')
              }
            }
            if (hasSentVillager) {
              drawInstanceBlinkingSelection(this)
            }
            if (hasSentVillager) {
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
          drawInstanceBlinkingSelection(this)
          for (let i = 0; i < player.selectedUnits.length; i++) {
            const playerUnit = player.selectedUnits[i]
            if (playerUnit.type === 'Villager') {
              playerUnit.sendToAttack(this)
            } else {
              playerUnit.sendTo(this, 'attack')
            }
          }
        } else if (instanceIsInPlayerSight(this, player) || map.revealEverything) {
          player.unselectAll()
          this.select()
          menu.setBottombar(this)
          player.selectedOther = this
        }
      })

      this.addChild(this.sprite)
    }

    if (this.isBuilt) {
      renderCellOnInstanceSight(this)
      this.finalTexture()
      this.onBuilt()
    }
  }

  attackAction(target) {
    const {
      context: { map },
    } = this

    this.startAttackInterval(() => {
      if (getActionCondition(this, target, 'attack') && instancesDistance(this, target) <= this.range) {
        if (target.hitPoints <= 0) {
          target.die()
        } else {
          const projectile = new Projectile(
            {
              owner: this,
              type: this.projectile,
              target,
            },
            this.context
          )
          map.addChild(projectile)
        }
      } else {
        this.stopAttackInterval()
      }
    }, this.rateOfFire)
  }

  startInterval(callback, time) {
    const finalCb = () => {
      const { paused } = this.context
      if (paused) {
        return
      }
      callback()
    }
    this.stopInterval()
    this.interval = setInterval(finalCb, (time * 1000) / 100 / ACCELERATOR)
  }

  stopInterval() {
    if (this.interval) {
      clearInterval(this.interval)
      this.interval = null
    }
  }

  startAttackInterval(callback, time) {
    const finalCb = () => {
      const { paused } = this.context
      if (paused) {
        return
      }
      callback()
    }
    this.stopAttackInterval()
    finalCb()
    this.attackInterval = setInterval(finalCb, time * 1000)
  }

  stopAttackInterval() {
    if (this.attackInterval) {
      clearInterval(this.attackInterval)
      this.attackInterval = null
    }
  }

  pause() {
    this.timeout?.pause()
  }

  resume() {
    this.timeout?.resume()
  }

  startTimeout(cb, time) {
    this.stopTimeout()
    this.timeout = new CustomTimeout(() => cb(), (time * 1000) / ACCELERATOR)
  }

  stopTimeout() {
    if (this.timeout) {
      clearInterval(this.timeout)
      this.timeout = null
    }
  }

  isAttacked(instance) {
    if (this.isDead) {
      return
    }
    if (this.range && getActionCondition(this, instance, 'attack') && instancesDistance(this, instance) <= this.range) {
      this.attackAction(instance)
    }
    this.updateHitPoints('attack')
  }

  updateTexture() {
    const {
      context: { menu },
    } = this
    const percentage = getPercentage(this.hitPoints, this.totalHitPoints)
    const buildSpritesheetId = this.sprite.texture.label.split('_')[1].split('.')[0]
    const buildSpritesheet = Assets.cache.get(buildSpritesheetId)

    if (percentage >= 25 && percentage < 50) {
      const textureName = `001_${buildSpritesheetId}.png`
      this.sprite.texture = buildSpritesheet.textures[textureName]
    } else if (percentage >= 50 && percentage < 75) {
      const textureName = `002_${buildSpritesheetId}.png`
      this.sprite.texture = buildSpritesheet.textures[textureName]
    } else if (percentage >= 75 && percentage < 99) {
      const textureName = `003_${buildSpritesheetId}.png`
      this.sprite.texture = buildSpritesheet.textures[textureName]
    } else if (percentage >= 100) {
      this.finalTexture()
      if (!this.isBuilt) {
        if (this.owner.isPlayed && this.sounds && this.sounds.create) {
          sound.play(this.sounds.create)
        }
        this.onBuilt()
      }
      this.isBuilt = true
      if (!this.owner.hasBuilt.includes(this.type)) {
        this.owner.hasBuilt.push(this.type)
      }
      if (this.owner.isPlayed && this.selected) {
        menu.setBottombar(this)
      }
      renderCellOnInstanceSight(this)
    }
  }

  onBuilt() {
    const {
      context: { menu },
    } = this
    if (this.increasePopulation) {
      // Increase player population and continue all unit creation that was paused
      this.owner.POPULATION_MAX += this.increasePopulation
      // Update bottombar with POPULATION_MAX if house selected
      if (this.owner.isPlayed && this.owner.selectedBuilding && this.owner.selectedBuilding.displayPopulation) {
        menu.updateInfo(
          'population-text',
          this.owner.population + '/' + Math.min(POPULATION_MAX, this.owner.POPULATION_MAX)
        )
      }
    }
    if (this.owner.isPlayed && this.selected) {
      menu.setBottombar(this)
    }
  }

  finalTexture() {
    const assets = getBuildingAsset(this.type, this.owner, Assets)

    const texture = getTexture(assets.images.final, Assets)
    this.sprite.texture = texture
    this.sprite.hitArea = texture.hitArea
      ? new Polygon(texture.hitArea)
      : new Polygon([-32 * this.size, 0, 0, -16 * this.size, 32 * this.size, 0, 0, 16 * this.size])
    this.sprite.anchor.set(texture.defaultAnchor.x, texture.defaultAnchor.y)

    const color = this.getChildByName('color')
    if (color) {
      color.destroy()
    }

    if (assets.images.color) {
      const spriteColor = Sprite.from(getTexture(assets.images.color, Assets))
      spriteColor.name = 'color'
      changeSpriteColorDirectly(spriteColor, this.owner.color)
      this.addChild(spriteColor)
    } else {
      changeSpriteColorDirectly(this.sprite, this.owner.color)
    }

    if (this.type === 'House') {
      if (this.owner.age === 0) {
        const spritesheetFire = Assets.cache.get('347')
        const spriteFire = new AnimatedSprite(spritesheetFire.animations['fire'])
        spriteFire.name = 'deco'
        spriteFire.allowMove = false
        spriteFire.allowClick = false
        spriteFire.eventMode = 'none'
        spriteFire.roundPixels = true
        spriteFire.x = 10
        spriteFire.y = 5
        spriteFire.play()
        spriteFire.animationSpeed = 0.2 * ACCELERATOR
        this.addChild(spriteFire)
      } else {
        const fire = this.getChildByName('deco')
        if (fire) {
          fire.destroy()
        }
      }
    }
  }

  detect(instance) {
    if (
      this.range &&
      instance.name !== 'animal' &&
      !this.attackInterval &&
      getActionCondition(this, instance, 'attack') &&
      instancesDistance(this, instance) <= this.range
    ) {
      this.attackAction(instance)
    }
  }

  updateHitPoints(action) {
    if (this.hitPoints > this.totalHitPoints) {
      this.hitPoints = this.totalHitPoints
    }
    const percentage = getPercentage(this.hitPoints, this.totalHitPoints)

    if (this.hitPoints <= 0) {
      this.die()
    }
    if (action === 'build' && !this.isBuilt) {
      this.updateTexture()
    } else if ((action === 'attack' && this.isBuilt) || (action === 'build' && this.isBuilt)) {
      if (percentage > 0 && percentage < 25) {
        generateFire(this, '450')
      }
      if (percentage >= 25 && percentage < 50) {
        generateFire(this, '452')
      }
      if (percentage >= 50 && percentage < 75) {
        generateFire(this, '347')
      }
      if (percentage >= 75) {
        const fire = this.getChildByName('fire')
        if (fire) {
          this.removeChild(fire)
        }
      }
    }
    function generateFire(building, spriteId) {
      const fire = building.getChildByName('fire')
      const spritesheetFire = Assets.cache.get(spriteId)
      if (fire) {
        for (let i = 0; i < fire.children.length; i++) {
          fire.children[i].textures = spritesheetFire.animations['fire']
          fire.children[i].play()
        }
      } else {
        const newFire = new Container()
        newFire.name = 'fire'
        newFire.allowMove = false
        newFire.allowClick = false
        newFire.eventMode = 'none'
        let poses = [[0, 0]]
        if (building.size === 3) {
          poses = [
            [0, -32],
            [-64, 0],
            [0, 32],
            [64, 0],
          ]
        }
        for (let i = 0; i < poses.length; i++) {
          const spriteFire = new AnimatedSprite(spritesheetFire.animations['fire'])
          spriteFire.allowMove = false
          spriteFire.allowClick = false
          spriteFire.eventMode = 'none'
          spriteFire.roundPixels = true
          spriteFire.x = poses[i][0]
          spriteFire.y = poses[i][1]
          spriteFire.play()
          spriteFire.animationSpeed = 0.2 * ACCELERATOR
          newFire.addChild(spriteFire)
        }
        building.addChild(newFire)
      }
    }
  }

  die() {
    if (this.isDead) {
      return
    }
    const {
      context: { map, player, players, menu },
    } = this
    this.stopInterval()
    this.isDead = true
    if (this.selected && player) {
      player.unselectAll()
    }

    // Remove from player buildings
    const index = this.owner.buildings.indexOf(this)
    if (index >= 0) {
      this.owner.buildings.splice(index, 1)
    }
    // Remove from view of others players
    for (let i = 0; i < players.length; i++) {
      if (players[i].type === 'AI') {
        const list = players[i].foundedEnemyBuildings
        list.splice(list.indexOf(this), 1)
      }
    }
    const color = this.getChildByName('color')
    color && color.destroy()
    const deco = this.getChildByName('deco')
    deco && deco.destroy()
    const fire = this.getChildByName('fire')
    fire && fire.destroy()

    let rubbleSheet = getBuildingRubbleTextureNameWithSize(this.size, Assets)
    if (this.type === 'Farm') {
      rubbleSheet = '000_239'
    }
    this.sprite.texture = getTexture(rubbleSheet, Assets)
    this.sprite.allowMove = false
    this.sprite.eventMode = 'none'
    this.sprite.allowClick = false
    this.zIndex--
    if (this.type === 'Farm') {
      changeSpriteColorDirectly(this.sprite, this.owner.color)
    }
    // Remove solid zone
    clearCellOnInstanceSight(this)
    const dist = this.size === 3 ? 1 : 0
    getPlainCellsAroundPoint(this.i, this.j, map.grid, dist, cell => {
      if (cell.has === this) {
        cell.has = null
        cell.solid = false
        cell.corpses.push(this)
      }
    })
    this.startTimeout(() => this.clear(), RUBBLE_TIME)
    canUpdateMinimap(this, player) && menu.updatePlayerMiniMapEvt(this.owner)
  }

  clear() {
    if (this.isDestroyed) {
      return
    }
    const {
      context: { map },
    } = this
    const dist = this.size === 3 ? 1 : 0
    getPlainCellsAroundPoint(this.i, this.j, map.grid, dist, cell => {
      const index = cell.corpses.indexOf(this)
      if (index >= 0) {
        cell.corpses.splice(index, 1)
      }
    })
    this.isDestroyed = true
    this.destroy({ child: true, texture: true })
  }

  select() {
    if (this.selected) {
      return
    }
    const {
      context: { menu, player },
    } = this

    if (this.owner.isPlayed && this.sounds && this.sounds.create) {
      sound.play(this.sounds.create)
    }

    this.selected = true
    const selection = new Graphics()
    selection.name = 'selection'
    selection.zIndex = 3
    const path = [-32 * this.size, 0, 0, -16 * this.size, 32 * this.size, 0, 0, 16 * this.size]
    selection.poly(path);
    selection.stroke(COLOR_WHITE);
    if (this.loading && this.owner.isPlayed) {
      this.updateInterfaceLoading()
    }
    this.addChildAt(selection, 0)
    canUpdateMinimap(this, player) && menu.updatePlayerMiniMapEvt(this.owner)
  }

  unselect() {
    if (!this.selected) {
      return
    }
    const {
      context: { menu, player },
    } = this

    this.selected = false
    const selection = this.getChildByName('selection')
    if (selection) {
      this.removeChild(selection)
    }
    canUpdateMinimap(this, player) && menu.updatePlayerMiniMapEvt(this.owner)
  }

  placeUnit(type) {
    const {
      context: { map, menu },
    } = this
    let spawnCell
    const config = this.owner.config.units[type]
    if (config.category === 'Boat') {
      spawnCell = getFreeCellAroundPoint(
        this.i,
        this.j,
        this.size,
        map.grid,
        cell => cell.category === 'Water' && !cell.solid
      )
    } else {
      spawnCell = getFreeCellAroundPoint(
        this.i,
        this.j,
        this.size,
        map.grid,
        cell => cell.category !== 'Water' && !cell.solid
      )
    }
    if (!spawnCell) {
      return
    }
    this.owner.population++

    const extra = (this.owner.getUnitExtraOptions && this.owner.getUnitExtraOptions(type)) || {}
    this.owner.createUnit({ i: spawnCell.i, j: spawnCell.j, type, ...extra })

    if (this.owner.isPlayed && this.owner.selectedBuilding && this.owner.selectedBuilding.displayPopulation) {
      menu.updateInfo(
        'population-text',
        this.owner.population + '/' + Math.min(POPULATION_MAX, this.owner.POPULATION_MAX)
      )
    }
  }

  buyUnit(type, alreadyPaid = false, force = false, extra) {
    const {
      context: { menu, map },
    } = this
    let success = false
    const unit = this.owner.config.units[type]
    if (this.isBuilt && !this.isDead && (canAfford(this.owner, unit.cost) || alreadyPaid)) {
      if (!alreadyPaid) {
        if (this.owner.type === 'AI') {
          if (!this.queue.length && this.loading === null) {
            payCost(this.owner, unit.cost)
            this.queue.push(type)
            success = true
          }
        } else {
          payCost(this.owner, unit.cost)
          this.queue.push(type)
          if (this.selected && this.owner.isPlayed) {
            menu.updateButtonContent(type, this.queue.filter(q => q === type).length)
          }
          this.owner.isPlayed && menu.updateTopbar()
          success = true
        }
      }
      if ((this.loading === null && this.queue[0]) || force) {
        let hasShowedMessage = false
        this.loading = force ? this.loading : 0
        if (this.selected && this.owner.isPlayed) {
          this.updateInterfaceLoading()
        }
        this.startInterval(() => {
          if (this.queue[0] !== type) {
            this.stopInterval()
            this.loading = null
            if (this.queue.length) {
              this.buyUnit(this.queue[0], true)
            }
            hasShowedMessage = false
            if (this.selected && this.owner.isPlayed) {
              const still = this.queue.filter(q => q === type).length
              menu.updateButtonContent(type, still || '')
              if (still === 0) {
                menu.toggleButtonCancel(type, false)
              }
              this.updateInterfaceLoading()
            }
          } else if (this.loading >= 100 || map.devMode) {
            this.stopInterval()
            this.placeUnit(type, extra)
            this.loading = null
            this.queue.shift()
            if (this.queue.length) {
              this.buyUnit(this.queue[0], true)
            }
            hasShowedMessage = false
            if (this.selected && this.owner.isPlayed) {
              const still = this.queue.filter(q => q === type).length
              menu.updateButtonContent(type, still || '')
              if (still === 0) {
                menu.toggleButtonCancel(type, false)
              }
              this.updateInterfaceLoading()
            }
          } else if (this.loading < 100) {
            if (this.owner.population < Math.min(POPULATION_MAX, this.owner.POPULATION_MAX)) {
              this.loading += 1
            } else if (this.owner.isPlayed && !hasShowedMessage) {
              menu.showMessage('You need to build more houses')
              hasShowedMessage = true
            }
            if (this.selected && this.owner.isPlayed) {
              this.updateInterfaceLoading()
            }
          }
        }, unit.trainingTime)
      }
      return success
    }
  }

  updateInterfaceLoading() {
    const {
      context: { menu },
    } = this
    if (this.owner.isPlayed && this.owner.selectedBuilding === this) {
      if (this.loading === 1) {
        menu.updateInfo('loading', element => (element.innerHTML = this.getLoadingElement().innerHTML))
      } else if (this.loading > 1) {
        menu.updateInfo('loading-text', this.loading + '%')
      } else {
        menu.updateInfo('loading', element => (element.innerHTML = ''))
      }
    }
  }

  getLoadingElement() {
    const loadingDiv = document.createElement('div')
    loadingDiv.className = 'building-loading'
    loadingDiv.id = 'loading'

    if (this.loading && this.owner.isPlayed) {
      const iconImg = document.createElement('img')
      iconImg.className = 'building-loading-icon'
      iconImg.src = getIconPath('009_50731')
      const textDiv = document.createElement('div')
      textDiv.id = 'loading-text'
      textDiv.textContent = this.loading + '%'
      loadingDiv.appendChild(iconImg)
      loadingDiv.appendChild(textDiv)
    }
    return loadingDiv
  }

  cancelTechnology() {
    const {
      context: { player, menu },
    } = this
    this.stopInterval()
    refundCost(player, this.technology.cost)
    this.technology = null
    this.loading = null
    if (this.owner.isPlayed) {
      menu.updateBottombar()
      menu.updateTopbar()
    }
  }

  upgrade(type) {
    const data = this.owner.config.buildings[type]
    this.type = type
    this.hitPoints = data.totalHitPoints - (this.totalHitPoints - this.hitPoints)
    for (const [key, value] of Object.entries(data)) {
      this[key] = value
    }
    const assets = getBuildingAsset(this.type, this.owner, Assets)
    this.sprite.texture = getTexture(assets.images.final, Assets)
    this.sprite.anchor.set(this.sprite.texture.defaultAnchor.x, this.sprite.texture.defaultAnchor.y)
    const color = this.getChildByName('color')
    color?.destroy()
    if (assets.images.color) {
      const spriteColor = Sprite.from(getTexture(assets.images.color, Assets))
      spriteColor.name = 'color'
      changeSpriteColorDirectly(spriteColor, this.owner.color)
      this.addChild(spriteColor)
    } else {
      changeSpriteColorDirectly(this.sprite, this.owner.color)
    }
  }

  buyTechnology(type, alreadyPaid, force) {
    const {
      context: { menu, map },
    } = this
    let success = false
    const config = this.owner.techs[type]
    if (
      !this.queue.length &&
      this.isBuilt &&
      (force || this.loading === null) &&
      !this.isDead &&
      (alreadyPaid || canAfford(this.owner, config.cost))
    ) {
      !alreadyPaid && payCost(this.owner, config.cost)
      success = true
      if (this.owner.isPlayed) {
        menu.updateTopbar()
      }
      this.loading = force ? this.loading : 0

      this.technology = { config, type }
      if (this.selected && this.owner.selectedBuilding === this) {
        menu.setBottombar(this)
      }
      this.startInterval(() => {
        const { config, type } = this.technology
        if (this.loading >= 100 || map.devMode) {
          this.stopInterval()
          this.loading = null
          this.technology = null
          if (Array.isArray(this.owner[config.key])) {
            this.owner[config.key].push(config.value || type)
          } else {
            this.owner[config.key] = config.value || type
          }
          if (config.action) {
            switch (config.action.type) {
              case 'upgradeUnit':
                for (let i = 0; i < this.owner.units.length; i++) {
                  const unit = this.owner.units[i]
                  if (unit.type === config.action.source) {
                    unit.upgrade(config.action.target)
                  }
                }
                break
              case 'upgradeBuilding':
                for (let i = 0; i < this.owner.buildings.length; i++) {
                  const building = this.owner.buildings[i]
                  if (building.type === config.action.source) {
                    building.upgrade(technconfigology.action.target)
                  }
                }
                break
              case 'improve':
                this.owner.updateConfig(config.action.operations)
                break
            }
          }
          const functionName = `on${capitalizeFirstLetter(config.key)}Change`
          typeof this.owner[functionName] === 'function' && this.owner[functionName](config.value)
          if (this.owner.isPlayed) {
            menu.updateBottombar()
            menu.updateTopbar()
          }
        } else if (this.loading < 100) {
          this.loading += 1
          if (this.owner.isPlayed && this.owner.selectedBuilding === this) {
            this.updateInterfaceLoading()
          }
        }
      }, config.researchTime)
    }
    return success
  }

  setDefaultInterface(element, data) {
    const {
      context: { menu },
    } = this

    const civDiv = document.createElement('div')
    civDiv.id = 'civ'
    civDiv.textContent = this.owner.civ
    element.appendChild(civDiv)

    const typeDiv = document.createElement('div')
    typeDiv.id = 'type'
    typeDiv.textContent = this.type
    element.appendChild(typeDiv)

    const iconImg = document.createElement('img')
    iconImg.id = 'icon'
    iconImg.src = getIconPath(data.icon)
    element.appendChild(iconImg)

    if (this.owner && this.owner.isPlayed) {
      const hitPointsDiv = document.createElement('div')
      hitPointsDiv.id = 'hitPoints'
      hitPointsDiv.textContent = this.hitPoints + '/' + this.totalHitPoints
      element.appendChild(hitPointsDiv)

      if (this.isBuilt && this.quantity) {
        const quantityDiv = document.createElement('div')
        quantityDiv.id = 'quantity'
        quantityDiv.className = 'resource-quantity'
        const smallIconImg = document.createElement('img')
        smallIconImg.src = menu.icons['food']
        smallIconImg.className = 'resource-quantity-icon'
        const textDiv = document.createElement('div')
        textDiv.id = 'quantity-text'
        textDiv.textContent = this.quantity
        quantityDiv.appendChild(smallIconImg)
        quantityDiv.appendChild(textDiv)
        element.appendChild(quantityDiv)
      }
    }
  }
}
