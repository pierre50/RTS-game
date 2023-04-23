import { Container, Assets, Sprite } from 'pixi.js'
import { Grass, Water, Desert, Jungle } from './cells/'
import { Tree, Berrybush, Stone, Gold } from './resources/'
import { Human, AI, Gaia } from './players/'
import * as animals from './animals/'

import {
  randomRange,
  getZoneInGridWithCondition,
  randomItem,
  getPlainCellsAroundPoint,
  getPositionInGridAroundInstance,
  getCellsAroundPoint,
  colors,
} from '../lib'
import { cellDepth } from '../constants'

/**
 * 
 *  Map size	      Tiny	      Small	    Medium	    Normal	    Large	
    Player count	  2	          3	        4	          6	          8
    Dimensions	    120×120	    144×144 	168×168	    200×200	    220×220
 */

export default class Map extends Container {
  constructor(context) {
    super()

    this.context = context
    this.size
    this.reliefRange = [
      1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2, 2,
      3,
    ]
    this.chanceOfRelief = 0.06
    this.chanceOfSets = 0.02
    this.revealEverything = false
    this.noAI = true
    this.grid = []
    this.sortableChildren = true

    this.x = 0
    this.y = 0
    this.startingUnits = 5

    this.players = []
    this.gaia = null
    this.resources = []

    this.interactive = false
    this.allowMove = false
    this.allowClick = false
  }

  setCoordinate(x, y) {
    this.x = x
    this.y = y
  }

  generateMap(repeat = 0) {
    this.removeChildren()
    this.generateCells()

    switch (this.size) {
      case 120:
        this.positionsCount = 2
        break
      case 144:
        this.positionsCount = 3
        break
      case 168:
        this.positionsCount = 4
        break
      case 200:
        this.positionsCount = 4
        break
      case 220:
        this.positionsCount = 4
        break
      default:
        this.positionsCount = 2
    }
    this.playersPos = this.findPlayerPlaces()

    if (this.playersPos.length < this.positionsCount) {
      if (repeat >= 10) {
        alert('Error while generating the map')
      }
      this.generateMap(repeat + 1)
      return
    }

    if (!this.revealEverything) {
      for (let i = 0; i <= this.size; i++) {
        for (let j = 0; j <= this.size; j++) {
          this.grid[i][j].setFog()
        }
      }
    }

    this.generateResourcesAroundPlayers(this.playersPos)
  }

  stylishMap() {
    const {
      context: { menu },
    } = this

    this.gaia = new Gaia(this.context)

    this.generateSets()

    this.generateMapRelief()

    this.formatCellsRelief()
    this.formatCellsWaterBorder()
    this.formatCellsDesert()

    menu.updateResourcesMiniMap()
  }

  generatePlayers() {
    const { context } = this

    const players = []
    const poses = []
    const randoms = Array.from(Array(this.playersPos.length).keys())

    for (let i = 0; i < this.playersPos.length; i++) {
      const pos = randomItem(randoms)
      poses.push(pos)
      randoms.splice(randoms.indexOf(pos), 1)
    }

    for (let i = 0; i < this.positionsCount; i++) {
      const posI = this.playersPos[poses[i]].i
      const posJ = this.playersPos[poses[i]].j
      const color = colors[i]
      if (!i) {
        players.push(
          new Human(
            {
              i: posI,
              j: posJ,
              age: 1,
              civ: 'Greek',
              color: 'cyan',
              isPlayed: true,
            },
            context
          )
        )
      } else if (!this.noAI) {
        players.push(new AI({ i: posI, j: posJ, age: 0, civ: 'Greek', color }, context))
      }
    }
    return players
  }

  placePlayers() {
    const {
      context: { players },
    } = this

    // Place a town center
    for (let i = 0; i < players.length; i++) {
      const player = players[i]
      const towncenter = player.spawnBuilding(player.i, player.j, 'TownCenter', true)
      for (let i = 0; i < this.startingUnits; i++) {
        towncenter.placeUnit('Villager')
        towncenter.placeUnit('Bowman')
      }
    }
  }

  generateResourcesAroundPlayers(playersPos) {
    for (let i = 0; i < playersPos.length; i++) {
      this.placeResourceGroup(playersPos[i], 'Berrybush', 5)
      this.placeResourceGroup(playersPos[i], 'Stone', 5)
      this.placeResourceGroup(playersPos[i], 'Gold', 5)
      this.placeResourceGroup(playersPos[i], 'Tree', 20)
    }
  }

  generateCells() {
    const z = 0
    const lines = Assets.cache.get('0').split('\n').filter(Boolean)
    this.size = lines.length - 1
    for (let i = 0; i <= this.size; i++) {
      const cols = lines[i].split('').filter(Boolean)
      for (let j = 0; j <= this.size; j++) {
        if (!this.grid[i]) {
          this.grid[i] = []
        }
        switch (cols[j]) {
          case '0':
            this.grid[i][j] = new Grass({ i, j, z }, this.context)
            break
          case '1':
            this.grid[i][j] = new Desert({ i, j, z }, this.context)
            break
          case '2':
            this.grid[i][j] = new Grass({ i, j, z }, this.context)
            this.resources.push(new Tree({ i, j }, this.context))
            break
          case '3':
            this.grid[i][j] = new Water({ i, j, z }, this.context)
            break
          case '4':
            this.grid[i][j] = new Desert({ i, j, z }, this.context)
            this.resources.push(new Tree({ i, j }, this.context))
            break
          case '5':
            this.grid[i][j] = new Jungle({ i, j, z }, this.context)
            this.resources.push(new Tree({ i, j }, this.context))
            break
        }
      }
    }
    for (let i = 0; i <= this.size; i++) {
      for (let j = 0; j <= this.size; j++) {
        this.grid[i][j].fillWaterCellsAroundCell()
      }
    }
  }

  generateSets() {
    for (let i = 0; i <= this.size; i++) {
      for (let j = 0; j <= this.size; j++) {
        const cell = this.grid[i][j]
        if (cell.type && cell.type !== 'water' && !cell.has && !cell.solid && !cell.border && !cell.inclined) {
          if (Math.random() < 0.03 && i > 1 && j > 1 && i < this.size && j < this.size) {
            const randomSpritesheet = randomRange(292, 301).toString()
            const spritesheet = Assets.cache.get(randomSpritesheet)
            const texture = spritesheet.textures['000_' + randomSpritesheet + '.png']
            const floor = Sprite.from(texture)
            floor.name = 'floor'
            floor.roundPixels = true
            floor.allowMove = false
            floor.interactive = false
            floor.allowClick = false
            floor.updateAnchor = true
            cell.addChild(floor)
          }
          if (Math.random() < this.chanceOfSets) {
            const animal = randomItem(Object.keys(animals))
            new animals[animal]({ i, j, owner: this.gaia }, this.context)
            continue
            const type = randomItem(['tree', 'rock', 'animal'])
            switch (type) {
              case 'tree':
                this.resources.push(new Tree({ i, j }, this.context))
                break
              case 'rock':
                const randomSpritesheet = randomRange(531, 534).toString()
                const spritesheet = Assets.cache.get(randomSpritesheet)
                const texture = spritesheet.textures['000_' + randomSpritesheet + '.png']
                const rock = Sprite.from(texture)
                rock.name = 'set'
                rock.roundPixels = true
                rock.allowMove = false
                rock.interactive = false
                rock.allowClick = false
                rock.updateAnchor = true
                cell.addChild(rock)
                break
              case 'animal':
                const animal = randomItem(Object.keys(animals))
                new animals[animal]({ i, j, owner: this.gaia }, this.context)
                break
            }
          }
        }
      }
    }
  }

  generateMapRelief() {
    for (let i = 0; i <= this.size; i++) {
      for (let j = 0; j <= this.size; j++) {
        const cell = this.grid[i][j]
        if (Math.random() < this.chanceOfRelief) {
          const level = randomItem(this.reliefRange)
          let canGenerate = true
          if (
            getPlainCellsAroundPoint(i, j, this.grid, level * 2, cell => {
              if (cell.type === 'water' || (cell.has && cell.has.name === 'building')) {
                canGenerate = false
              }
            })
          );
          if (canGenerate) {
            cell.setCellLevel(level)
          }
        }
      }
    }
    for (let i = 0; i <= this.size; i++) {
      for (let j = 0; j <= this.size; j++) {
        const cell = this.grid[i][j]
        if (cell.z === 1) {
          let toRemove = true
          let cpt = 0
          if (
            getCellsAroundPoint(i, j, this.grid, 2, cell => {
              if (cell.z > 0) {
                cpt++
              }
              if (cpt >= 3) {
                toRemove = false
              }
            })
          );
          if (toRemove) {
            cell.setCellLevel(0)
          }
        }
      }
    }
    // Format cell's relief
    for (let i = 0; i <= this.size; i++) {
      for (let j = 0; j <= this.size; j++) {
        const cell = this.grid[i][j]
        cell.fillReliefCellsAroundCell()
      }
    }
  }

  formatCellsRelief() {
    for (let i = 0; i <= this.size; i++) {
      for (let j = 0; j <= this.size; j++) {
        const cell = this.grid[i][j]
        // Side
        if (
          this.grid[i - 1] &&
          this.grid[i - 1][j].z - cell.z === 1 &&
          (!this.grid[i + 1] || this.grid[i + 1][j].z <= cell.z) &&
          (!this.grid[i][j - 1] || this.grid[i][j - 1].z <= cell.z) &&
          (!this.grid[i][j + 1] || this.grid[i][j + 1].z <= cell.z)
        ) {
          cell.setReliefBorder('014', cellDepth / 2)
        } else if (
          this.grid[i + 1] &&
          this.grid[i + 1][j].z - cell.z === 1 &&
          (!this.grid[i - 1] || this.grid[i - 1][j].z <= cell.z) &&
          (!this.grid[i][j - 1] || this.grid[i][j - 1].z <= cell.z) &&
          (!this.grid[i][j + 1] || this.grid[i][j + 1].z <= cell.z)
        ) {
          cell.setReliefBorder('015', cellDepth / 2)
        } else if (
          this.grid[i][j - 1] &&
          this.grid[i][j - 1].z - cell.z === 1 &&
          (!this.grid[i + 1] || this.grid[i + 1][j].z <= cell.z) &&
          (!this.grid[i][j + 1] || this.grid[i][j + 1].z <= cell.z) &&
          (!this.grid[i - 1] || this.grid[i - 1][j].z <= cell.z)
        ) {
          cell.setReliefBorder('016', cellDepth / 2)
        } else if (
          this.grid[i][j + 1] &&
          this.grid[i][j + 1].z - cell.z === 1 &&
          (!this.grid[i + 1] || this.grid[i + 1][j].z <= cell.z) &&
          (!this.grid[i][j - 1] || this.grid[i][j - 1].z <= cell.z) &&
          (!this.grid[i - 1] || this.grid[i - 1][j].z <= cell.z)
        ) {
          cell.setReliefBorder('013', cellDepth / 2)
        } // Corner
        else if (
          this.grid[i - 1] &&
          this.grid[i - 1][j - 1] &&
          this.grid[i - 1][j - 1].z - cell.z === 1 &&
          (!this.grid[i][j - 1] || this.grid[i][j - 1].z <= cell.z) &&
          (!this.grid[i - 1] || this.grid[i - 1][j].z <= cell.z)
        ) {
          cell.setReliefBorder('010', cellDepth / 2)
        } else if (
          this.grid[i + 1] &&
          this.grid[i + 1][j - 1] &&
          this.grid[i + 1][j - 1].z - cell.z === 1 &&
          (!this.grid[i][j - 1] || this.grid[i][j - 1].z <= cell.z) &&
          (!this.grid[i + 1] || this.grid[i + 1][j].z <= cell.z)
        ) {
          cell.setReliefBorder('012')
        } else if (
          this.grid[i - 1] &&
          this.grid[i - 1][j + 1] &&
          this.grid[i - 1][j + 1].z - cell.z === 1 &&
          (!this.grid[i][j + 1] || this.grid[i][j + 1].z <= cell.z) &&
          (!this.grid[i - 1] || this.grid[i - 1][j].z <= cell.z)
        ) {
          cell.setReliefBorder('011')
        } else if (
          this.grid[i + 1] &&
          this.grid[i + 1][j + 1] &&
          this.grid[i + 1][j + 1].z - cell.z === 1 &&
          (!this.grid[i][j + 1] || this.grid[i][j + 1].z <= cell.z) &&
          (!this.grid[i + 1] || this.grid[i + 1][j].z <= cell.z)
        ) {
          cell.setReliefBorder('009', cellDepth / 2)
        }
        // Deep corner
        else if (
          this.grid[i][j - 1] &&
          this.grid[i][j - 1].z - cell.z === 1 &&
          this.grid[i - 1] &&
          this.grid[i - 1][j].z - cell.z === 1
        ) {
          cell.setReliefBorder('022', cellDepth / 2)
        } else if (
          this.grid[i][j + 1] &&
          this.grid[i][j + 1].z - cell.z === 1 &&
          this.grid[i + 1] &&
          this.grid[i + 1][j].z - cell.z === 1
        ) {
          cell.setReliefBorder('021', cellDepth / 2)
        } else if (
          this.grid[i][j - 1] &&
          this.grid[i][j - 1].z - cell.z === 1 &&
          this.grid[i + 1] &&
          this.grid[i + 1][j].z - cell.z === 1
        ) {
          cell.setReliefBorder('023', cellDepth)
        } else if (
          this.grid[i][j + 1] &&
          this.grid[i][j + 1].z - cell.z === 1 &&
          this.grid[i - 1] &&
          this.grid[i - 1][j].z - cell.z === 1
        ) {
          cell.setReliefBorder('024', cellDepth)
        }
      }
    }
  }

  formatCellsWaterBorder() {
    for (let i = 0; i <= this.size; i++) {
      for (let j = 0; j <= this.size; j++) {
        const cell = this.grid[i][j]
        if (cell.type !== 'water') {
          // Side
          if (
            this.grid[i - 1] &&
            this.grid[i - 1][j].type === 'water' &&
            (!this.grid[i + 1] || this.grid[i + 1][j].type !== 'water') &&
            (!this.grid[i][j - 1] || this.grid[i][j - 1].type !== 'water') &&
            (!this.grid[i][j + 1] || this.grid[i][j + 1].type !== 'water')
          ) {
            cell.setWaterBorder(cell, '20000', '008')
          } else if (
            this.grid[i + 1] &&
            this.grid[i + 1][j].type === 'water' &&
            (!this.grid[i - 1] || this.grid[i - 1][j].type !== 'water') &&
            (!this.grid[i][j - 1] || this.grid[i][j - 1].type !== 'water') &&
            (!this.grid[i][j + 1] || this.grid[i][j + 1].type !== 'water')
          ) {
            cell.setWaterBorder(cell, '20000', '009')
          } else if (
            this.grid[i][j - 1] &&
            this.grid[i][j - 1].type === 'water' &&
            (!this.grid[i + 1] || this.grid[i + 1][j].type !== 'water') &&
            (!this.grid[i][j + 1] || this.grid[i][j + 1].type !== 'water') &&
            (!this.grid[i - 1] || this.grid[i - 1][j].type !== 'water')
          ) {
            cell.setWaterBorder(cell, '20000', '011')
          } else if (
            this.grid[i][j + 1] &&
            this.grid[i][j + 1].type === 'water' &&
            (!this.grid[i + 1] || this.grid[i + 1][j].type !== 'water') &&
            (!this.grid[i][j - 1] || this.grid[i][j - 1].type !== 'water') &&
            (!this.grid[i - 1] || this.grid[i - 1][j].type !== 'water')
          ) {
            cell.setWaterBorder(cell, '20000', '010')
          } // Corner
          else if (
            this.grid[i - 1] &&
            this.grid[i - 1][j - 1] &&
            this.grid[i - 1][j - 1].type === 'water' &&
            (!this.grid[i][j - 1] || this.grid[i][j - 1].type !== 'water') &&
            (!this.grid[i - 1] || this.grid[i - 1][j].type !== 'water')
          ) {
            cell.setWaterBorder(cell, '20000', '005')
          } else if (
            this.grid[i + 1] &&
            this.grid[i + 1][j - 1] &&
            this.grid[i + 1][j - 1].type === 'water' &&
            (!this.grid[i][j - 1] || this.grid[i][j - 1].type !== 'water') &&
            (!this.grid[i + 1] || this.grid[i + 1][j].type !== 'water')
          ) {
            cell.setWaterBorder(cell, '20000', '007')
          } else if (
            this.grid[i - 1] &&
            this.grid[i - 1][j + 1] &&
            this.grid[i - 1][j + 1].type === 'water' &&
            (!this.grid[i][j + 1] || this.grid[i][j + 1].type !== 'water') &&
            (!this.grid[i - 1] || this.grid[i - 1][j].type !== 'water')
          ) {
            cell.setWaterBorder(cell, '20000', '004')
          } else if (
            this.grid[i + 1] &&
            this.grid[i + 1][j + 1] &&
            this.grid[i + 1][j + 1].type === 'water' &&
            (!this.grid[i][j + 1] || this.grid[i][j + 1].type !== 'water') &&
            (!this.grid[i + 1] || this.grid[i + 1][j].type !== 'water')
          ) {
            cell.setWaterBorder(cell, '20000', '006')
          }
          // Deep corner
          else if (
            this.grid[i][j - 1] &&
            this.grid[i][j - 1].type === 'water' &&
            this.grid[i - 1] &&
            this.grid[i - 1][j].type === 'water'
          ) {
            cell.setWaterBorder(cell, '20000', '001')
          } else if (
            this.grid[i][j + 1] &&
            this.grid[i][j + 1].type === 'water' &&
            this.grid[i + 1] &&
            this.grid[i + 1][j].type === 'water'
          ) {
            cell.setWaterBorder(cell, '20000', '002')
          } else if (
            this.grid[i][j - 1] &&
            this.grid[i][j - 1].type === 'water' &&
            this.grid[i + 1] &&
            this.grid[i + 1][j].type === 'water'
          ) {
            cell.setWaterBorder(cell, '20000', '003')
          } else if (
            this.grid[i][j + 1] &&
            this.grid[i][j + 1].type === 'water' &&
            this.grid[i - 1] &&
            this.grid[i - 1][j].type === 'water'
          ) {
            cell.setWaterBorder(cell, '20000', '000')
          }
        } else {
          if (cell.has) {
            cell.has.destroy()
          }
        }
      }
    }
  }

  findPlayerPlaces() {
    const results = []
    const outBorder = 20
    const inBorder = Math.floor(this.size / 4)
    const zones = [
      {
        minX: outBorder,
        minY: this.size / 2 + inBorder,
        maxX: this.size / 2 - inBorder,
        maxY: this.size - outBorder,
      },
      {
        minX: outBorder,
        minY: outBorder,
        maxX: this.size / 2 - inBorder,
        maxY: this.size / 2 - inBorder,
      },
      {
        minX: this.size / 2 + inBorder,
        minY: outBorder,
        maxX: this.size - outBorder,
        maxY: this.size / 2 - inBorder,
      },
      {
        minX: this.size / 2 + inBorder,
        minY: this.size / 2 + inBorder,
        maxX: this.size - outBorder,
        maxY: this.size - outBorder,
      },
    ]
    for (let i = 0; i < zones.length; i++) {
      const pos = getZoneInGridWithCondition(zones[i], this.grid, 5, cell => {
        return !cell.border && !cell.solid && !cell.inclined
      })
      if (pos) {
        results.push(pos)
      }
    }
    return results
  }

  placeResourceGroup(player, instance, quantity) {
    const { context, grid } = this
    const resources = {
      Tree,
      Berrybush,
      Stone,
      Gold,
    }
    const cartesianDistance = [10, 25]
    const pos = getPositionInGridAroundInstance(player, this.grid, cartesianDistance, 3, false)
    if (pos) {
      let cpt = 0
      const max = quantity
      for (let i = 0; i < quantity * 100; i++) {
        getCellsAroundPoint(pos.i, pos.j, grid, i, cell => {
          if (cpt > max) {
            return
          }
          if (Math.random() < 0.5 && !cell.solid && !cell.border) {
            cpt++
            this.resources.push(new resources[instance]({ i: cell.i, j: cell.j }, context))
          }
        })
        if (cpt > max) {
          return
        }
      }
    }
  }

  formatCellsDesert() {
    for (let i = 0; i <= this.size; i++) {
      for (let j = 0; j <= this.size; j++) {
        const cell = this.grid[i][j]
        const typeToFormat = ['grass', 'jungle']
        if (cell.type === 'desert') {
          if (this.grid[i - 1] && this.grid[i - 1][j] && typeToFormat.includes(this.grid[i - 1][j].type)) {
            this.grid[i - 1][j].setDesertBorder('est')
          }
          if (this.grid[i + 1] && this.grid[i + 1][j] && typeToFormat.includes(this.grid[i + 1][j].type)) {
            this.grid[i + 1][j].setDesertBorder('west')
          }
          if (this.grid[i][j - 1] && typeToFormat.includes(this.grid[i][j - 1].type)) {
            this.grid[i][j - 1].setDesertBorder('south')
          }
          if (this.grid[i][j + 1] && typeToFormat.includes(this.grid[i][j + 1].type)) {
            this.grid[i][j + 1].setDesertBorder('north')
          }
        }
      }
    }
  }
}
