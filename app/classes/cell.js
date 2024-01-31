import { Container, Assets, Sprite } from 'pixi.js'
import {
  randomRange,
  formatNumber,
  cartesianToIsometric,
  getCellsAroundPoint,
  instanceIsInPlayerSight,
  instancesDistance,
  getInstanceZIndex,
} from '../lib'
import { cellDepth, colorWhite } from '../constants'

export class Cell extends Container {
  constructor(options, context) {
    super()

    this.context = context

    const {
      context: { map },
    } = this
    this.setParent(map)
    this.name = 'cell'
    Object.keys(options).forEach(prop => {
      this[prop] = options[prop]
    })
    Object.keys(Assets.cache.get('config').cells[this.type]).forEach(prop => {
      this[prop] = Assets.cache.get('config').cells[this.type][prop]
    })
    const pos = cartesianToIsometric(this.i, this.j)

    this.map = map
    this.x = pos[0]
    this.y = pos[1] - this.z * cellDepth
    this.zIndex = 0
    this.inclined = false
    this.border = false
    this.waterBorder = false
    this.has = null
    this.corpses = []
    this.solid = false
    this.visible = false
    this.viewed = false
    this.viewBy = []

    const textureName = randomItem(this.assets)
    const resourceName = textureName.split('_')[1]
    const textureFile = textureName + '.png'
    const spritesheet = Assets.cache.get(resourceName)
    const texture = spritesheet.textures[textureFile]
    this.sprite = Sprite.from(texture)
    this.sprite.name = 'sprite'
    this.sprite.anchor.set(0.5, 0.5)
    this.sprite.roundPixels = true
    this.sprite.allowMove = false
    this.sprite.eventMode = 'none'
    this.sprite.allowClick = false
    this.addChild(this.sprite)

    this.eventMode = 'none'
    this.allowMove = false
    this.allowClick = false
  }

  updateVisible() {
    const {
      context: { map, player },
    } = this

    function updateChild(instance) {
      if (
        map.revealEverything ||
        !instance.owner ||
        instance.owner.isPlayed ||
        instanceIsInPlayerSight(instance, player) ||
        (instance.name === 'building' &&
          player.views[this.i][this.j].has &&
          player.views[this.i][this.j].has.id === instance.id)
      ) {
        instance.visible = true
      }
    }

    if (!map.revealEverything && !player.views[this.i][this.j].viewed) {
      return
    }
    this.visible = true
    if (this.has) {
      updateChild(this.has)
    }
    if (this.corpses.length) {
      for (let i = 0; i < this.corpses.length; i++) {
        updateChild(this.corpses[i])
      }
    }
  }

  setDesertBorder(direction) {
    const resourceName = '20002'
    const cellSprite = this.getChildByName('sprite')
    const cellSpriteTextureName = cellSprite.texture.textureCacheIds[0]
    const cellSpriteIndex = cellSpriteTextureName.split('_')[0]
    let val = {}
    let index
    let cpt = 0
    for (let i = 0; i < 25; i++) {
      val[i] = []
      if (i < 9) {
        val[i].push(0, 1, 2, 3)
      } else {
        for (let j = cpt; j < cpt + 4; j++) {
          val[i].push(j + 4)
        }
        cpt += 4
      }
    }
    switch (direction) {
      case 'west':
        index = val[cellSpriteIndex * 1][0]
        break
      case 'north':
        index = val[cellSpriteIndex * 1][1]
        break
      case 'south':
        index = val[cellSpriteIndex * 1][2]
        break
      case 'est':
        index = val[cellSpriteIndex * 1][3]
        break
    }
    const spritesheet = Assets.cache.get(resourceName)
    const texture = spritesheet.textures[formatNumber(index) + '_' + resourceName + '.png']
    const sprite = Sprite.from(texture)
    sprite.direction = direction
    sprite.anchor.set(0.5, 0.5)
    sprite.type = 'border'
    this.addChild(sprite)
  }

  setWaterBorder(resourceName, index) {
    const sprite = this.getChildByName('sprite')
    const spritesheet = Assets.cache.get(resourceName)
    const texture = spritesheet.textures[index + '_' + resourceName + '.png']
    this.type = 'Desert'
    this.border = true
    this.waterBorder = true
    if (this.has && typeof this.has.die === 'function') {
      this.has.die(true)
    }
    sprite.texture = texture
  }

  setReliefBorder(index, elevation = 0) {
    const sprite = this.getChildByName('sprite')
    const resourceName = sprite.texture.textureCacheIds[0].split('_')[1].split('.')[0]
    const spritesheet = Assets.cache.get(resourceName)
    const texture = spritesheet.textures[index + '_' + resourceName + '.png']
    if (elevation) {
      this.y -= elevation
    }
    this.inclined = true
    if (this.has) {
      this.has.zIndex = getInstanceZIndex(this.has)
    }
    sprite.name = 'sprite'
    sprite.anchor.set(0.5, 0.5)
    sprite.texture = texture
  }

  fillWaterCellsAroundCell() {
    const grid = this.parent.grid
    getCellsAroundPoint(this.i, this.j, grid, 2, cell => {
      if (cell.type === 'Water' && this.type === 'Water') {
        const dist = instancesDistance(this, cell)
        const velX = Math.round((this.i - cell.i) / dist)
        const velY = Math.round((this.j - cell.j) / dist)
        if (grid[cell.i + velX] && grid[cell.i + velX][cell.j + velY]) {
          const target = grid[cell.i + velX][cell.j + velY]
          const aside = grid[this.i + cell.i - target.i][this.j + cell.j - target.j]
          if (target.type !== this.type && aside.type !== this.type) {
            if (Math.floor(instancesDistance(this, cell)) === 2) {
              const sprite = target.getChildByName('sprite')
              const index = formatNumber(randomRange(0, 3))
              const resourceName = '15002'
              const spritesheet = Assets.cache.get(resourceName)
              sprite.texture = spritesheet.textures[index + '_' + resourceName + '.png']
              target.type = 'Water'
              target.solid = true
            }
          }
        }
      }
    })
  }

  fillReliefCellsAroundCell() {
    const grid = this.parent.grid
    getCellsAroundPoint(this.i, this.j, grid, 2, cell => {
      if (cell.z === this.z) {
        const dist = instancesDistance(this, cell)
        const velX = Math.round((this.i - cell.i) / dist)
        const velY = Math.round((this.j - cell.j) / dist)
        if (grid[cell.i + velX] && grid[cell.i + velX][cell.j + velY]) {
          const target = grid[cell.i + velX][cell.j + velY]
          const aside = grid[this.i + cell.i - target.i][this.j + cell.j - target.j]
          if (target.z <= this.z && target.z !== this.z && aside.z !== this.z) {
            if (Math.floor(instancesDistance(this, cell)) === 2) {
              target.setCellLevel(target.z + 1)
            }
          }
        }
      }
    })
  }

  setCellLevel(level, cpt = 1) {
    if (level === 0) {
      this.y += cellDepth
      this.z = level
      return
    }
    const grid = this.parent.grid
    getCellsAroundPoint(this.i, this.j, grid, level - cpt, cell => {
      if (cell.z < cpt) {
        cell.y -= (cpt - cell.z) * cellDepth
        cell.z = cpt
        cell.fillReliefCellsAroundCell(grid)
      }
    })
    if (cpt + 1 < level) {
      this.setCellLevel(level, cpt + 1)
    }
    if (this.has) {
      this.has.zIndex = getInstanceZIndex(this.has)
    }
  }

  setFog() {
    const color = 0x666666
    function setFogChildren(instance) {
      if ((instance.name === 'unit' || instance.name === 'animal') && !instance.owner.isPlayed) {
        instance.visible = false
      } else {
        for (let i = 0; i < instance.children.length; i++) {
          if (instance.children[i].tint) {
            instance.children[i].tint = color
          }
          instance.children[i].cacheAsBitmap = true
        }
      }
    }
    for (let i = 0; i < this.children.length; i++) {
      if (this.children[i].tint) {
        this.children[i].tint = color
      }
      this.children[i].cacheAsBitmap = true
    }

    if (this.has) {
      setFogChildren(this.has)
    }
    if (this.corpses.length) {
      for (let i = 0; i < this.corpses.length; i++) {
        setFogChildren(this.corpses[i])
      }
    }
  }

  removeFog() {
    const {
      context: { controls },
    } = this
    function setRemoveChildren(instance) {
      if (controls.instanceInCamera(instance)) {
        instance.visible = true
      }
      for (let i = 0; i < instance.children.length; i++) {
        if (instance.children[i].tint) {
          instance.children[i].tint = colorWhite
        }
        instance.children[i].cacheAsBitmap = false
      }
    }
    if (!this.visible) {
      this.visible = true
    }
    for (let i = 0; i < this.children.length; i++) {
      if (this.children[i].tint) {
        this.children[i].tint = colorWhite
      }
      this.children[i].cacheAsBitmap = false
    }
    if (this.has) {
      setRemoveChildren(this.has)
    }
    if (this.corpses.length) {
      for (let i = 0; i < this.corpses.length; i++) {
        setRemoveChildren(this.corpses[i])
      }
    }
  }
}
