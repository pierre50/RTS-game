import { Container, Assets, Sprite, AnimatedSprite, Graphics } from 'pixi.js'
import { accelerator } from '../../constants'
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
} from '../../lib'

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
    if (!map.revealEverything) {
      this.visible = false
    }

    this.life = this.isBuilt ? this.lifeMax : 1

    // Set solid zone
    const dist = this.size === 3 ? 1 : 0
    getPlainCellsAroundPoint(this.i, this.j, map.grid, dist, cell => {
      const set = cell.getChildByName('set')
      if (set) {
        cell.removeChild(set)
      }
      const rubble = cell.getChildByName('rubble')
      cell.zIndex = 0
      if (rubble) {
        cell.removeChild(rubble)
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
      this.sprite.interactive = true
      this.sprite.roundPixels = true

      this.sprite.on('pointertap', () => {
        const {
          context: { controls, player, menu },
        } = this
        if (!player || controls.mouseBuilding || controls.mouseRectangle || !controls.isMouseInApp()) {
          return
        }
        let hasSentVillager = false
        controls.mouse.prevent = true
        if (this.owner.isPlayed) {
          // Send Villager to build the building
          if (!this.isBuilt) {
            for (let i = 0; i < player.selectedUnits.length; i++) {
              const unit = player.selectedUnits[i]
              if (getActionCondition(unit, this, 'build')) {
                hasSentVillager = true
                unit.sendToBuilding(this)
                drawInstanceBlinkingSelection(this)
              }
            }
            if (hasSentVillager) {
              return
            }
          } else if (player.selectedUnits) {
            // Send Villager to give loading of resources
            for (let i = 0; i < player.selectedUnits.length; i++) {
              const unit = player.selectedUnits[i]
              if (unit.type === 'Villager') {
                if (this.life < this.lifeMax) {
                  hasSentVillager = true
                  unit.previousDest = null
                  unit.sendToBuilding(this)
                } else {
                  switch (this.type) {
                    case 'Farm':
                      hasSentVillager = true
                      unit.sendToFarm(this)
                      break
                    case 'StoragePit':
                    case 'Granary':
                    case 'TownCenter':
                      if (
                        unit.loading > 0 &&
                        (this.type === 'TownCenter' || (this.accept && this.accept.includes(unit.work)))
                      ) {
                        hasSentVillager = true
                        unit.previousDest = null
                        unit.sendToDelivery()
                      }
                      break
                  }
                }
              }
            }
            if (hasSentVillager) {
              drawInstanceBlinkingSelection(this)
              return
            }
          }
          player.unselectAll()
          this.select()
          menu.setBottombar(this)
          player.selectedBuilding = this
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

      if (typeof this.onBuilt === 'function') {
        this.onBuilt()
      }
    }
  }

  startInterval(cb, time) {
    if (!this.interval) {
      this.interval = setInterval(() => cb(), (time * 1000) / 100 / accelerator)
    }
  }

  stopInterval() {
    if (this.interval) {
      clearInterval(this.interval)
      this.interval = null
    }
  }

  isAttacked(instance) {
    this.updateLife('attack')
  }

  updateTexture() {
    const {
      context: { menu },
    } = this
    const sprite = this.getChildByName('sprite')
    const percentage = getPercentage(this.life, this.lifeMax)
    const buildSpritesheetId = sprite.texture.textureCacheIds[0].split('_')[1].split('.')[0]
    const buildSpritesheet = Assets.cache.get(buildSpritesheetId)

    if (percentage >= 25 && percentage < 50) {
      const textureName = `001_${buildSpritesheetId}.png`
      sprite.texture = buildSpritesheet.textures[textureName]
    } else if (percentage >= 50 && percentage < 75) {
      const textureName = `002_${buildSpritesheetId}.png`
      sprite.texture = buildSpritesheet.textures[textureName]
    } else if (percentage >= 75 && percentage < 99) {
      const textureName = `003_${buildSpritesheetId}.png`
      sprite.texture = buildSpritesheet.textures[textureName]
    } else if (percentage >= 100) {
      this.finalTexture()
      this.isBuilt = true
      if (!this.owner.hasBuilt.includes(this.type)) {
        this.owner.hasBuilt.push(this.type)
      }
      if (this.owner && this.owner.isPlayed && this.selected) {
        menu.setBottombar(this)
      }
      if (typeof this.onBuilt === 'function') {
        this.onBuilt()
      }
      renderCellOnInstanceSight(this)
    }
  }

  updateLife(action) {
    if (this.life > this.lifeMax) {
      this.life = this.lifeMax
    }
    const percentage = getPercentage(this.life, this.lifeMax)

    if (this.life <= 0) {
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
        newFire.interactive = false
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
          spriteFire.interactive = false
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
    const {
      context: { map, player },
    } = this
    if (this.parent) {
      this.stopInterval()
      if (this.selected && player) {
        player.unselectAll()
      }
      // Remove solid zone
      const dist = this.size === 3 ? 1 : 0
      getPlainCellsAroundPoint(this.i, this.j, map.grid, dist, cell => {
        if (cell.has === this) {
          cell.has = null
          cell.solid = false
        }
      })
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
      const assets = getBuildingAsset(this.type, this.owner, Assets)
      const rubble = Sprite.from(getTexture(assets.images.rubble, Assets))
      rubble.name = 'rubble'
      map.grid[this.i][this.j].addChild(rubble)
      map.grid[this.i][this.j].zIndex++
      map.removeChild(this)
    }
    clearCellOnInstanceSight(this)
    this.isDestroyed = true
    this.destroy({ child: true, texture: true })
  }

  select() {
    const {
      context: { menu },
    } = this

    if (this.selected) {
      return
    }
    this.selected = true
    const selection = new Graphics()
    selection.name = 'selection'
    selection.zIndex = 3
    selection.lineStyle(1, 0xffffff)
    const path = [-32 * this.size, 0, 0, -16 * this.size, 32 * this.size, 0, 0, 16 * this.size]
    selection.drawPolygon(path)
    if (this.loading && this.owner.isPlayed) {
      menu.updateInfo('loading', element => (element.textContent = this.loading + '%'))
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
    const spawnCell = getFreeCellAroundPoint(this.i, this.j, map.grid)
    if (!spawnCell) {
      return
    }
    this.owner.population++
    this.owner.createUnit(spawnCell.i, spawnCell.j, type, map)

    if (this.owner.isPlayed && this.owner.selectedBuilding && this.owner.selectedBuilding.type === 'House') {
      menu.updateInfo(
        'population',
        element => (element.textContent = this.owner.population + '/' + this.owner.populationMax)
      )
    }
  }

  buyUnit(type, alreadyPaid = false) {
    const {
      context: { menu },
    } = this
    const unit = Assets.cache.get('config').units[type]
    if (this.isBuilt && !this.isDead && (canAfford(this.owner, unit.cost) || alreadyPaid)) {
      if (!alreadyPaid) {
        if (this.owner.type === 'AI' && this.loading === null) {
          payCost(this.owner, unit.cost)
        } else {
          payCost(this.owner, unit.cost)
          this.queue.push(type)
          if (this.selected && this.owner.isPlayed) {
            menu.updateButtonContent(type, element => (element.textContent = this.queue.filter(q => q === type).length))
          }
        }
        if (this.owner.isPlayed) {
          menu.updateTopbar()
        }
      }
      if (this.loading === null) {
        let hasShowedMessage = false
        this.loading = 0
        if (this.selected && this.owner.isPlayed) {
          menu.updateInfo('loading', element => (element.textContent = this.loading + '%'))
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
              menu.updateButtonContent(type, element => (element.textContent = still || ''))
              if (still === 0) {
                menu.toggleButtonCancel(type, false)
              }
              menu.updateInfo('loading', element => (element.textContent = ''))
            }
          } else if (this.loading < 100) {
            if (this.owner.population < this.owner.populationMax) {
              this.loading += 1
            } else if (this.owner.isPlayed && !hasShowedMessage) {
              menu.showMessage('You need to build more houses')
              hasShowedMessage = true
            }
            if (this.selected && this.owner.isPlayed) {
              menu.updateInfo('loading', element => (element.textContent = this.loading + '%'))
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
              menu.updateButtonContent(type, element => (element.textContent = still || ''))
              if (still === 0) {
                menu.toggleButtonCancel(type, false)
              }
              menu.updateInfo('loading', element => (element.textContent = ''))
            }
          }
        }, unit.trainingTime)
      }
    }
  }

  cancelTechnology() {
    const {
      context: { player, menu },
    } = this
    this.stopInterval()
    refundCost(player, this.technology.cost)
    this.technology = null
    this.loading = null
    if (this.selected && this.owner.isPlayed) {
      menu.setBottombar(this)
    }
    menu.updateTopbar()
  }

  buyTechnology(technology) {
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
      if (this.selected && this.owner.isPlayed) {
        menu.setBottombar(this)
      }
      this.startInterval(() => {
        if (this.loading < 100) {
          this.loading += 1
          if (this.selected && this.owner.isPlayed) {
            menu.updateInfo('loading', element => (element.textContent = this.loading + '%'))
          }
        } else if (this.loading >= 100) {
          this.stopInterval()
          this.loading = null
          this.technology = null
          if (Array.isArray(player[technology.key])) {
            player[technology.key].push(technology.value)
          } else {
            player[technology.key] = technology.value
          }
          const functionName = `on${capitalizeFirstLetter(technology.key)}Change`
          typeof player[functionName] === 'function' && player[functionName](technology.value)
          if (this.selected && this.owner.isPlayed) {
            menu.setBottombar(this)
          }
          menu.updateTopbar()
        }
      }, technology.loadingTime)
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
      const lifeDiv = document.createElement('div')
      lifeDiv.id = 'life'
      lifeDiv.textContent = Math.max(this.life, 0) + '/' + this.lifeMax
      element.appendChild(lifeDiv)

      const loadingDiv = document.createElement('div')
      loadingDiv.id = 'loading'
      loadingDiv.textContent = this.loading ? this.loading + '%' : ''
      element.appendChild(loadingDiv)

      if (this.type === 'Farm' && this.isBuilt && this.quantity) {
        const quantityDiv = document.createElement('div')
        quantityDiv.id = 'quantity'
        quantityDiv.className = 'resource-quantity'
        const smallIconImg = document.createElement('img')
        smallIconImg.src = menu.icons['food']
        smallIconImg.className = 'resource-quantity-icon'
        const textDiv = document.createElement('div')
        textDiv.id = 'quantity-text'
        textDiv.textContent = Math.max(this.quantity, 0)
        quantityDiv.appendChild(smallIconImg)
        quantityDiv.appendChild(textDiv)
        element.appendChild(quantityDiv)
      }
    }
  }
}