import { Container, Assets, Sprite, AnimatedSprite, Graphics, Polygon } from 'pixi.js'
import {
  getTexture,
  getInstanceZIndex,
  getPlainCellsAroundPoint,
  getPercentage,
  changeSpriteColor,
  renderCellOnInstanceSight,
  getFreeCellAroundPoint,
  getIconPath,
  canAfford,
  drawInstanceBlinkingSelection,
  payCost,
  instanceIsInPlayerSight,
} from '../lib'

class Building extends Container {
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
    this.loading = null
    if (!map.revealEverything) {
      this.visible = false
    }

    this.life = this.isBuilt ? this.lifeMax : 1

    //Set solid zone
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

    if (this.sprite) {
      this.sprite.interactive = true

      this.sprite.on('pointertap', () => {
        const {
          context: { controls, player, menu },
        } = this
        if (controls.mouseBuilding || controls.mouseRectangle || !controls.isMouseInApp()) {
          return
        }
        if (this.owner.isPlayed) {
          //Send Villager to build the building
          if (!this.isBuilt) {
            let hasVillager = false
            for (let i = 0; i < player.selectedUnits.length; i++) {
              const unit = player.selectedUnits[i]
              if (unit.type === 'Villager') {
                hasVillager = true
                drawInstanceBlinkingSelection(this)
                unit.sendToBuilding(this)
              }
            }
            if (hasVillager) {
              return
            }
          } else if (player.selectedUnits) {
            //Send Villager to give loading of resources
            let hasVillagerLoaded = false
            for (let i = 0; i < player.selectedUnits.length; i++) {
              const unit = player.selectedUnits[i]
              if (unit.type === 'Villager' && unit.loading > 0) {
                hasVillagerLoaded = true
                drawInstanceBlinkingSelection(this)
                unit.previousDest = null
                switch (unit.work) {
                  case 'woodcutter':
                    unit.sendTo(this, 'deliverywood')
                    break
                  case 'gatherer':
                    unit.sendTo(this, 'deliveryberry')
                    break
                  case 'stoneminer':
                    unit.sendTo(this, 'deliverystone')
                    break
                  case 'goldminer':
                    unit.sendTo(this, 'deliverygold')
                    break
                }
              }
            }
            if (hasVillagerLoaded) {
              return
            }
          }
          player.unselectAll()
          this.select()
          menu.setBottombar(this)
          player.selectedBuilding = this
        } else {
          if (player.selectedUnits.length) {
            drawInstanceBlinkingSelection(this)
            for (let i = 0; i < player.selectedUnits.length; i++) {
              const playerUnit = player.selectedUnits[i]
              if (playerUnit.type === 'Villager') {
                playerUnit.sendToAttack(this)
              } else {
                playerUnit.sendTo(this, 'attack')
              }
            }
            return
          }
          if (instanceIsInPlayerSight(this, player) || map.revealEverything) {
            player.unselectAll()
            this.select()
            menu.setBottombar(this)
            player.selectedOther = this
          }
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
        generateFire(this, 450)
      }
      if (percentage >= 25 && percentage < 50) {
        generateFire(this, 452)
      }
      if (percentage >= 50 && percentage < 75) {
        generateFire(this, 347)
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
          spriteFire.x = poses[i][0]
          spriteFire.y = poses[i][1]
          spriteFire.play()
          spriteFire.animationSpeed = 0.2
          newFire.addChild(spriteFire)
        }
        building.addChild(newFire)
      }
    }
  }
  die() {
    const {
      context: { map },
    } = this
    if (this.parent) {
      const data = Assets.cache.get('config').buildings[this.owner.civ][this.owner.age][this.type]
      if (this.selected && player) {
        player.unselectAll()
      }
      //Remove solid zone
      const dist = this.size === 3 ? 1 : 0
      getPlainCellsAroundPoint(this.i, this.j, map.grid, dist, cell => {
        cell.has = this
        cell.solid = true
      })
      //Remove from player buildings
      const index = this.owner.buildings.indexOf(this)
      if (index >= 0) {
        this.owner.buildings.splice(index, 1)
      }
      //Remove from view of others players
      for (let i = 0; i < map.players.length; i++) {
        if (map.players[i].type === 'AI') {
          const list = map.players[i].foundedEnemyBuildings
          list.splice(list.indexOf(this), 1)
        }
      }
      const rubble = Sprite.from(getTexture(data.images.rubble, Assets))
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
  }
  unselect() {
    this.selected = false
    const selection = this.getChildByName('selection')
    if (selection) {
      this.removeChild(selection)
    }
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
    if (this.isBuilt && (canAfford(this.owner, unit.cost) || alreadyPaid)) {
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
        let timesRun = 0
        let hasShowedMessage = false
        this.loading = 0
        if (this.selected && this.owner.isPlayed) {
          menu.updateInfo('loading', element => (element.textContent = this.loading + '%'))
        }
        let interval = setInterval(() => {
          //Building is dead while buying unit
          if (!this.parent) {
            clearInterval(interval)
            return
          }
          if (this.queue[0] !== type) {
            this.loading = null
            if (this.queue.length) {
              this.buyUnit(this.queue[0], true)
            }
            clearInterval(interval)
            interval = null
            hasShowedMessage = false
            if (this.selected && this.owner.isPlayed) {
              const still = this.queue.filter(q => q === type).length
              menu.updateButtonContent(type, element => (element.textContent = still || ''))
              if (still === 0) {
                menu.toggleButtonCancel(type, false)
              }
              menu.updateInfo('loading', element => (element.textContent = ''))
            }
            return
          }
          if (timesRun < 100) {
            if (this.owner.population < this.owner.populationMax) {
              timesRun += 1
              this.loading = timesRun
            } else if (this.owner.isPlayed && !hasShowedMessage) {
              menu.showMessage('You need to build more houses')
              hasShowedMessage = true
            }
            if (this.selected && this.owner.isPlayed) {
              menu.updateInfo('loading', element => (element.textContent = this.loading + '%'))
            }
          } else if (timesRun === 100) {
            this.placeUnit(type)
            this.loading = null
            this.queue.shift()
            if (this.queue.length) {
              this.buyUnit(this.queue[0], true)
            }
            clearInterval(interval)
            interval = null
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
        }, (unit.trainingTime * 1000) / 100)
      }
    }
  }
  setDefaultInterface(element, data) {
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

    if (this.owner && this.owner.isPlayed){
      const lifeDiv = document.createElement('div')
      lifeDiv.id = 'life'
      lifeDiv.textContent = this.life + '/' + this.lifeMax
      element.appendChild(lifeDiv)
    }

    if (this.owner.isPlayed) {
      const loadingDiv = document.createElement('div')
      loadingDiv.id = 'loading'
      loadingDiv.textContent = this.loading ? this.loading + '%' : ''
      element.appendChild(loadingDiv)
    }
  }
}

export class TownCenter extends Building {
  constructor({ i, j, owner, isBuilt = false }, context) {
    const type = 'TownCenter'
    const data = Assets.cache.get('config').buildings[owner.civ][owner.age][type]

    //Define sprite
    const texture = getTexture(data.images.build, Assets)
    const sprite = Sprite.from(texture)
    sprite.updateAnchor = true
    sprite.name = 'sprite'
    sprite.hitArea = new Polygon(texture.hitArea)

    super(
      {
        i,
        j,
        owner,
        type,
        sprite,
        size: data.size,
        sight: data.sight,
        isBuilt,
        lifeMax: data.lifeMax,
        interface: {
          info: element => {
            this.setDefaultInterface(element, data)
          },
          menu: owner.isPlayed ? [context.menu.getUnitButton('Villager')] : [],
        },
      },
      context
    )
  }
  finalTexture() {
    const { owner, type } = this
    const data = Assets.cache.get('config').buildings[owner.civ][owner.age][type]

    const sprite = this.getChildByName('sprite')
    sprite.texture = getTexture(data.images.final, Assets)
    sprite.anchor.set(sprite.texture.defaultAnchor.x, sprite.texture.defaultAnchor.y)

    const spriteColor = Sprite.from(getTexture(data.images.color, Assets))
    spriteColor.name = 'color'

    changeSpriteColor(spriteColor, owner.color)

    this.addChildAt(spriteColor, 0)
  }
}

export class Barracks extends Building {
  constructor({ i, j, owner, isBuilt = false }, context) {
    const type = 'Barracks'
    const data = Assets.cache.get('config').buildings[owner.civ][owner.age][type]

    //Define sprite
    const texture = getTexture(data.images.build, Assets)
    const sprite = Sprite.from(texture)
    sprite.updateAnchor = true
    sprite.name = 'sprite'
    sprite.hitArea = new Polygon(texture.hitArea)

    super(
      {
        i,
        j,
        owner,
        type,
        sprite,
        size: data.size,
        sight: data.sight,
        isBuilt,
        lifeMax: data.lifeMax,
        interface: {
          info: element => {
            this.setDefaultInterface(element, data)
          },
          menu: owner.isPlayed ? [context.menu.getUnitButton('Clubman')] : [],
        },
      },
      context
    )
  }
  finalTexture() {
    const { owner, type } = this

    const data = Assets.cache.get('config').buildings[owner.civ][owner.age][type]

    const spriteColor = this.getChildByName('sprite')
    spriteColor.texture = getTexture(data.images.final, Assets)
    changeSpriteColor(spriteColor, owner.color)
    spriteColor.anchor.set(spriteColor.texture.defaultAnchor.x, spriteColor.texture.defaultAnchor.y)
  }
}

export class House extends Building {
  constructor({ i, j, owner, isBuilt = false }, context) {
    const type = 'House'
    const data = Assets.cache.get('config').buildings[owner.civ][owner.age][type]

    //Define sprite
    const texture = getTexture(data.images.build, Assets)
    const sprite = Sprite.from(texture)
    sprite.updateAnchor = true
    sprite.name = 'sprite'
    sprite.hitArea = new Polygon(texture.hitArea)

    super(
      {
        i,
        j,
        owner,
        type,
        sprite,
        size: data.size,
        sight: data.sight,
        isBuilt,
        lifeMax: data.lifeMax,
        interface: {
          info: element => {
            this.setDefaultInterface(element, data)

            if (this.owner.isPlayed && this.isBuilt) {
              const populationDiv = document.createElement('div')
              populationDiv.id = 'population'
              populationDiv.textContent = this.owner.population + '/' + this.owner.populationMax
              element.appendChild(populationDiv)
            }
          },
        },
      },
      context
    )
  }
  finalTexture() {
    const { owner, type } = this

    const data = Assets.cache.get('config').buildings[owner.civ][owner.age][type]

    const sprite = this.getChildByName('sprite')
    sprite.texture = getTexture(data.images.final, Assets)
    sprite.anchor.set(sprite.texture.defaultAnchor.x, sprite.texture.defaultAnchor.y)

    const spriteColor = Sprite.from(getTexture(data.images.color, Assets))
    spriteColor.name = 'color'
    changeSpriteColor(spriteColor, owner.color)
    this.addChildAt(spriteColor, 0)

    const spritesheetFire = Assets.cache.get('347')
    const spriteFire = new AnimatedSprite(spritesheetFire.animations['fire'])
    spriteFire.name = 'deco'
    spriteFire.x = 10
    spriteFire.y = 5
    spriteFire.play()
    spriteFire.animationSpeed = 0.2

    this.addChild(spriteFire)
  }
  onBuilt() {
    const {
      context: { menu },
    } = this
    //Increase player population and continue all unit creation that was paused
    this.owner.populationMax += 4
    //Update bottombar with populationmax if house selected
    if (this.selected && this.owner.isPlayed) {
      menu.updateInfo(
        'population',
        element => (element.textContent = this.owner.population + '/' + this.owner.populationMax)
      )
    }
  }
}

export class Granary extends Building {
  constructor({ i, j, owner, isBuilt = false }, context) {
    const type = 'Granary'
    const data = Assets.cache.get('config').buildings[owner.civ][owner.age][type]

    //Define sprite
    const texture = getTexture(data.images.build, Assets)
    const sprite = Sprite.from(texture)
    sprite.updateAnchor = true
    sprite.name = 'sprite'
    sprite.hitArea = new Polygon(texture.hitArea)

    super(
      {
        i,
        j,
        owner,
        type,
        sprite,
        size: data.size,
        sight: data.sight,
        isBuilt,
        lifeMax: data.lifeMax,
        interface: {
          info: element => {
            this.setDefaultInterface(element, data)
          },
        },
      },
      context
    )
  }
  finalTexture() {
    const data = Assets.cache.get('config').buildings[this.owner.civ][this.owner.age][this.type]

    const sprite = this.getChildByName('sprite')
    sprite.texture = getTexture(data.images.final, Assets)
    sprite.anchor.set(sprite.texture.defaultAnchor.x, sprite.texture.defaultAnchor.y)

    const spriteColor = Sprite.from(getTexture(data.images.color, Assets))
    spriteColor.name = 'color'
    changeSpriteColor(spriteColor, this.owner.color)
    this.addChildAt(spriteColor, 0)
  }
}

export class StoragePit extends Building {
  constructor({ i, j, owner, isBuilt = false }, context) {
    const type = 'StoragePit'
    const data = Assets.cache.get('config').buildings[owner.civ][owner.age][type]

    //Define sprite
    const texture = getTexture(data.images.build, Assets)
    const sprite = Sprite.from(texture)
    sprite.updateAnchor = true
    sprite.name = 'sprite'
    sprite.hitArea = new Polygon(texture.hitArea)

    super(
      {
        i,
        j,
        owner,
        type,
        sprite,
        size: data.size,
        sight: data.sight,
        isBuilt,
        lifeMax: data.lifeMax,
        interface: {
          info: element => {
            this.setDefaultInterface(element, data)
          },
        },
      },
      context
    )
  }
  finalTexture() {
    const data = Assets.cache.get('config').buildings[this.owner.civ][this.owner.age][this.type]

    const sprite = this.getChildByName('sprite')
    sprite.texture = getTexture(data.images.final, Assets)
    sprite.anchor.set(sprite.texture.defaultAnchor.x, sprite.texture.defaultAnchor.y)

    const spriteColor = Sprite.from(getTexture(data.images.color, Assets))
    spriteColor.name = 'color'
    changeSpriteColor(spriteColor, this.owner.color)
    this.addChild(spriteColor)
  }
}

export default {
  Barracks,
  TownCenter,
  House,
  StoragePit,
  Granary,
}
