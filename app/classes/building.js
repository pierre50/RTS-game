import { sound } from '@pixi/sound'
import { Container, Assets, Sprite, AnimatedSprite, Graphics } from 'pixi.js'
import { accelerator, populationMax, rubbleTime } from '../constants'
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
  changeSpriteColor,
  getBuildingRubbleTextureNameWithSize,
  instancesDistance,
  getBuildingTextureNameWithSize,
} from '../lib'
import { Projectile } from './projectile'

export class Building extends Container {
  constructor(options, context) {
    super()

    this.context = context

    const { map } = context
    this.setParent(map)
    this.id = map.children.length
    this.name = 'building'

    Object.keys(options).forEach(prop => {
      this[prop] = options[prop]
    })
    Object.keys(this.owner.config.buildings[this.type]).forEach(prop => {
      this[prop] = this.owner.config.buildings[this.type][prop]
    })

    this.x = map.grid[this.i][this.j].x
    this.y = map.grid[this.i][this.j].y
    this.z = map.grid[this.i][this.j].z
    this.zIndex = getInstanceZIndex(this)
    this.selected = false
    this.queue = []
    this.technology = null
    this.loading = null
    this.isDead = false
    this.isDestroyed = false
    this.interval
    this.attackInterval
    this.timeout
    this.isUsedBy = null

    if (!map.revealEverything) {
      this.visible = false
    }
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
          populationSpan.textContent = this.owner.population + '/' + Math.min(populationMax, this.owner.populationMax)

          populationIcon.src = getIconPath('004_50731')
          populationDiv.appendChild(populationIcon)
          populationDiv.appendChild(populationSpan)
          element.appendChild(populationDiv)
        }
        element.appendChild(this.getLoadingElement())
      },
      menu: this.owner.isPlayed ? [...units, ...technologies] : [],
    }

    this.hitPoints = this.isBuilt ? this.totalHitPoints : 1

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

      this.sprite.on('pointertap', () => {
        const {
          context: { controls, player, menu },
        } = this
        if (controls.mouseBuilding || controls.mouseRectangle || !controls.isMouseInApp()) {
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
          }
          if (player.selectedBuilding !== this) {
            player.unselectAll()
            this.select()
            menu.setBottombar(this)
            player.selectedBuilding = this
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
      this.updateTexture()
      renderCellOnInstanceSight(this)
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
    this.stopInterval()
    this.interval = setInterval(callback, (time * 1000) / 100 / accelerator)
  }

  stopInterval() {
    if (this.interval) {
      clearInterval(this.interval)
      this.interval = null
    }
  }

  startAttackInterval(callback, time) {
    this.stopAttackInterval()
    callback()
    this.attackInterval = setInterval(callback, time * 1000)
  }

  stopAttackInterval() {
    if (this.attackInterval) {
      clearInterval(this.attackInterval)
      this.attackInterval = null
    }
  }

  startTimeout(cb, time) {
    this.stopTimeout()
    this.timeout = setTimeout(() => cb(), (time * 1000) / accelerator)
  }

  stopTimeout() {
    if (this.timeout) {
      clearInterval(this.timeout)
      this.timeout = null
    }
  }

  isAttacked(instance) {
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
    const buildSpritesheetId = this.sprite.texture.textureCacheIds[0].split('_')[1].split('.')[0]
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
      this.owner.populationMax += 4
      // Update bottombar with populationmax if house selected
      if (this.owner.isPlayed && this.owner.selectedBuilding && this.owner.selectedBuilding.displayPopulation) {
        menu.updateInfo(
          'population-text',
          this.owner.population + '/' + Math.min(populationMax, this.owner.populationMax)
        )
      }
    }
    if (this.owner.isPlayed && this.selected) {
      menu.setBottombar(this)
    }
  }
  finalTexture() {
    const assets = getBuildingAsset(this.type, this.owner, Assets)

    this.sprite.texture = getTexture(assets.images.final, Assets)
    this.sprite.anchor.set(this.sprite.texture.defaultAnchor.x, this.sprite.texture.defaultAnchor.y)

    const color = this.getChildByName('color')
    if (color) {
      color.destroy()
    }

    if (assets.images.color) {
      const spriteColor = Sprite.from(getTexture(assets.images.color, Assets))
      spriteColor.name = 'color'
      changeSpriteColor(spriteColor, this.owner.color)
      this.addChild(spriteColor)
    } else {
      changeSpriteColor(this.sprite, this.owner.color)
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
        spriteFire.animationSpeed = 0.2 * accelerator
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
          spriteFire.animationSpeed = 0.2 * accelerator
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
      context: { map, player },
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
    for (let i = 0; i < map.players.length; i++) {
      if (map.players[i].type === 'AI') {
        const list = map.players[i].foundedEnemyBuildings
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
      changeSpriteColor(this.sprite, this.owner.color)
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
    this.startTimeout(() => this.clear(), rubbleTime)
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
      context: { menu },
    } = this

    if (this.owner.isPlayed && this.sounds && this.sounds.create) {
      sound.play(this.sounds.create)
    }

    this.selected = true
    const selection = new Graphics()
    selection.name = 'selection'
    selection.zIndex = 3
    selection.lineStyle(1, 0xffffff)
    const path = [-32 * this.size, 0, 0, -16 * this.size, 32 * this.size, 0, 0, 16 * this.size]
    selection.drawPolygon(path)
    if (this.loading && this.owner.isPlayed) {
      this.updateInterfaceLoading()
      //menu.updateInfo('loading', this.loading + '%')
    }
    this.addChildAt(selection, 0)

    menu.updatePlayerMiniMapEvt(this.owner)
  }

  unselect() {
    if (!this.selected) {
      return
    }
    const {
      context: { menu },
    } = this

    this.selected = false
    const selection = this.getChildByName('selection')
    if (selection) {
      this.removeChild(selection)
    }
    menu.updatePlayerMiniMapEvt(this.owner)
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
    this.owner.createUnit(spawnCell.i, spawnCell.j, type, map)

    if (this.owner.isPlayed && this.owner.selectedBuilding && this.owner.selectedBuilding.displayPopulation) {
      menu.updateInfo(
        'population-text',
        this.owner.population + '/' + Math.min(populationMax, this.owner.populationMax)
      )
    }
  }

  buyUnit(type, alreadyPaid = false) {
    const {
      context: { menu },
    } = this
    const unit = this.owner.config.units[type]
    if (this.isBuilt && !this.isDead && (canAfford(this.owner, unit.cost) || alreadyPaid)) {
      if (!alreadyPaid) {
        if (this.owner.type === 'AI' && this.loading === null) {
          payCost(this.owner, unit.cost)
        } else {
          payCost(this.owner, unit.cost)
          this.queue.push(type)
          if (this.selected && this.owner.isPlayed) {
            menu.updateButtonContent(type, this.queue.filter(q => q === type).length)
          }
        }
        this.owner.isPlayed && menu.updateTopbar()
      }
      if (this.loading === null) {
        let hasShowedMessage = false
        this.loading = 0
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
          } else if (this.loading < 100) {
            if (this.owner.population < Math.min(populationMax, this.owner.populationMax)) {
              this.loading += 1
            } else if (this.owner.isPlayed && !hasShowedMessage) {
              menu.showMessage('You need to build more houses')
              hasShowedMessage = true
            }
            if (this.selected && this.owner.isPlayed) {
              this.updateInterfaceLoading()
            }
          } else if (this.loading >= 100) {
            this.stopInterval()
            this.placeUnit(type)
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
          }
        }, unit.trainingTime)
      }
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

    if (this.loading) {
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

  buyTechnology(technology, type) {
    const {
      context: { player, menu },
    } = this
    if (
      !this.queue.length &&
      this.isBuilt &&
      this.loading === null &&
      !this.isDead &&
      canAfford(this.owner, technology.cost)
    ) {
      payCost(this.owner, technology.cost)
      if (this.owner.isPlayed) {
        menu.updateTopbar()
      }
      this.loading = 0

      this.technology = technology
      if (this.selected && this.owner.selectedBuilding === this) {
        menu.setBottombar(this)
      }
      this.startInterval(() => {
        if (this.loading < 100) {
          this.loading += 1
          if (this.owner.isPlayed && this.owner.selectedBuilding === this) {
            this.updateInterfaceLoading()
          }
        } else if (this.loading >= 100) {
          this.stopInterval()
          this.loading = null
          this.technology = null
          if (Array.isArray(player[technology.key])) {
            player[technology.key].push(technology.value || type)
          } else {
            player[technology.key] = technology.value || type
          }
          if (technology.action) {
            switch (technology.action.type) {
              case 'upgrade':
                for (let i = 0; i < player.units.length; i++) {
                  const unit = player.units[i]
                  if (unit.type === technology.action.source) {
                    unit.upgrade(technology.action.target)
                  }
                }
                break
              case 'improve':
                this.owner.updateConfig(technology.action.operations)
                break
            }
          }
          const functionName = `on${capitalizeFirstLetter(technology.key)}Change`
          typeof player[functionName] === 'function' && player[functionName](technology.value)
          if (this.owner.isPlayed) {
            debugger

            menu.updateBottombar()
            menu.updateTopbar()
          }
        }
      }, technology.researchTime)
    }
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
