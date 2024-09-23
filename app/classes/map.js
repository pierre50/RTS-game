import { Container, Assets, Sprite } from 'pixi.js'
import { Resource } from './resource'
import { Human, AI, Gaia } from './players'
import {
  randomRange,
  getZoneInGridWithCondition,
  randomItem,
  getPlainCellsAroundPoint,
  getCellsAroundPoint,
  colors,
  renderCellOnInstanceSight,
} from '../lib'
import { cellDepth } from '../constants'
import { Cell } from './cell'

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

    this.ready = false
    this.grid = []
    this.sortableChildren = true

    this.allTechnologies = false
    this.noAI = false

    this.devMode = false
    this.revealEverything = true || this.devMode || false
    this.revealTerrain = this.devMode || false

    this.x = 0
    this.y = 0
    this.startingUnits = 3

    this.playersPos = []
    this.positionsCount = 2
    this.gaia = null
    this.resources = []

    this.eventMode = 'auto'
    this.allowMove = false
    this.allowClick = false
    this.totalCells
  }

  setCoordinate(x, y) {
    this.x = x
    this.y = y
  }

  generateFromJSON({ map, players, camera, resources, animals }) {
    const classMap = {
      Human,
      AI,
    }
    const { menu, controls } = this.context
    this.removeChildren()
    this.size = map.length - 1

    this.gaia = new Gaia(this.context)

    for (let i = 0; i <= this.size; i++) {
      const line = map[i]
      for (let j = 0; j <= this.size; j++) {
        if (!this.grid[i]) {
          this.grid[i] = []
        }
        const cell = line[j]
        this.grid[i][j] = new Cell({ i, j, z: cell.z, type: cell.type, fogSprites: cell.fogSprites }, this.context)
        if (!this.revealEverything) {
          this.grid[i][j].setFog()
        }
      }
    }
    for (let i = 0; i <= this.size; i++) {
      for (let j = 0; j <= this.size; j++) {
        this.grid[i][j].fillWaterCellsAroundCell()
      }
    }
    this.resources = resources.map(resource => new Resource(resource, this.context))

    this.formatCellsRelief()
    this.formatCellsWaterBorder()
    this.formatCellsDesert()

    this.context.players = players.map(player => {
      const p = new classMap[player.type](
        {
          ...player,
          corpses: [],
          buildings: [],
          units: [],
        },
        this.context
      )
      if (player.isPlayed) {
        this.context.player = p
      }
      return p
    })
    controls.setCamera(camera.x, camera.y, true)
    menu.init()
    menu.updateResourcesMiniMap()

    this.context.players.forEach((player, index) => {
      const { buildings, units, corpses } = players[index]
      player.buildings = buildings.map(building => player.createBuilding(building))
      player.units = units.map(unit => player.createUnit(unit))
      player.corpses = corpses.map(unit => player.createUnit(unit))
    })
    animals.forEach(animal => this.gaia.createAnimal(animal))

    function getDest(val, map) {
      if (val) {
        if (Array.isArray(val)) {
          return val[2] ? map.getChildByName(val[2]) : map.grid[val[0]][val[1]]
        } else {
          return map.getChildByName(val)
        }
      }
      return null
    }

    function processUnit(unit, context) {
      if (unit.previousDest) {
        unit.previousDest = getDest(unit.previousDest, context)
      }
      if (unit.dest && !unit.isDead) {
        const dest = getDest(unit.dest, context)
        if (dest) {
          unit.commonSendTo ? unit.commonSendTo(dest, unit.work, unit.action, true) : unit.sendTo(dest, unit.action)
        } else {
          unit.stop()
        }
      }
    }

    this.gaia.units.forEach(animal => processUnit(animal, this))

    this.context.players.forEach(player => {
      for (let i = 0; i <= this.size; i++) {
        const line = player.views[i]
        for (let j = 0; j <= this.size; j++) {
          const cell = line[j]
          if (cell.viewed) {
            cell.onViewed()
          }
          cell.viewBy = cell.viewBy.map(name => getDest(name, this)).filter(Boolean)
          if (player.isPlayed && cell.viewed) {
            if (!cell.viewBy.length) {
              this.grid[i][j].setFog(true)
            } else {
              this.grid[i][j].removeFog()
            }
          }
        }
      }
      player.units.forEach(unit => processUnit(unit, this))
    })

    this.ready = true
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

    this.totalCells = Math.pow(this.size, 2)

    this.playersPos = this.findPlayerPlaces()

    if (this.playersPos.length < this.positionsCount) {
      if (repeat >= 10) {
        alert('Error while generating the map')
      }
      this.generateMap(repeat + 1)
      return
    }

    this.generateResourcesAroundPlayers(this.playersPos)
  }

  stylishMap() {
    const {
      context: { menu, player },
    } = this

    this.gaia = new Gaia(this.context)

    this.generateMapRelief()
    this.formatCellsRelief()
    this.formatCellsWaterBorder()
    this.formatCellsDesert()

    this.generateSets()

    if (!this.revealEverything) {
      for (let i = 0; i <= this.size; i++) {
        for (let j = 0; j <= this.size; j++) {
          this.grid[i][j].setFog()
        }
      }
      for (let i = 0; i < player.buildings.length; i++) {
        const building = player.buildings[i]
        renderCellOnInstanceSight(building)
      }
      for (let i = 0; i < player.units.length; i++) {
        const unit = player.units[i]
        renderCellOnInstanceSight(unit)
      }
    }

    this.ready = true
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
              age: 0,
              civ: 'Greek',
              color,
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
      const towncenter = player.spawnBuilding({ i: player.i, j: player.j, type: 'TownCenter', isBuilt: true })
      for (let i = 0; i < this.startingUnits; i++) {
        towncenter.placeUnit('Villager')
      }
    }
  }

  generateResourcesAroundPlayers(playersPos) {
    for (let i = 0; i < playersPos.length; i++) {
      this.placeResourceGroup(playersPos[i], 'Berrybush', 6, [5, 10])
      this.placeResourceGroup(playersPos[i], 'Stone', 7, [10, 15])
      this.placeResourceGroup(playersPos[i], 'Gold', 7, [10, 15])
      this.placeResourceGroup(playersPos[i], 'Tree', 20, [10, 25])
      this.placeResourceGroup(playersPos[i], 'Tree', 30, [10, 25])
      this.placeResourceGroup(playersPos[i], 'Tree', 20, [10, 25])
      this.placeResourceGroup(playersPos[i], 'Tree', 30, [10, 25])
      this.placeResourceGroup(playersPos[i], 'Tree', 50, [10, 30])
    }
  }

  generateCells() {
    const z = 0
    const lines = Assets.cache.get('0').split('\n').filter(Boolean)
    this.size = lines.length - 1
    for (let i = 0; i <= this.size; i++) {
      const line = lines[i].split('').filter(Boolean)
      for (let j = 0; j <= this.size; j++) {
        if (!this.grid[i]) {
          this.grid[i] = []
        }
        const cell = line[j]
        switch (cell) {
          case '0':
            this.grid[i][j] = new Cell({ i, j, z, type: 'Grass' }, this.context)
            break
          case '1':
            this.grid[i][j] = new Cell({ i, j, z, type: 'Desert' }, this.context)
            break
          case '2':
            this.grid[i][j] = new Cell({ i, j, z, type: 'Grass' }, this.context)
            this.resources.push(new Resource({ i, j, type: 'Tree' }, this.context))
            break
          case '3':
            this.grid[i][j] = new Cell({ i, j, z, type: 'Water' }, this.context)
            break
          case '4':
            this.grid[i][j] = new Cell({ i, j, z, type: 'Desert' }, this.context)
            this.resources.push(new Resource({ i, j, type: 'Tree' }, this.context))
            break
          case '5':
            this.grid[i][j] = new Cell({ i, j, z, type: 'Jungle' }, this.context)
            this.resources.push(new Resource({ i, j, type: 'Tree' }, this.context))
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
        if (getCellsAroundPoint(i, j, this.grid, 1, neighbour => neighbour.solid).length > 0) {
          continue
        }
        if (!cell.has && !cell.solid && !cell.border && !cell.inclined) {
          if (cell.type !== 'Water' && Math.random() < 0.03 && i > 1 && j > 1 && i < this.size && j < this.size) {
            const randomSpritesheet = randomRange(292, 301).toString()
            const spritesheet = Assets.cache.get(randomSpritesheet)
            const texture = spritesheet.textures['000_' + randomSpritesheet + '.png']
            const floor = Sprite.from(texture)
            floor.name = 'floor'
            floor.roundPixels = true
            floor.allowMove = false
            floor.eventMode = 'none'
            floor.allowClick = false
            floor.updateAnchor = true
            cell.addChild(floor)
          }
          if (Math.random() < this.chanceOfSets) {
            if (cell.type !== 'Water') {
              const type = randomItem(['tree', 'rock', 'animal'])
              switch (type) {
                case 'tree':
                  this.resources.push(new Resource({ i, j, type: 'Tree' }, this.context))
                  break
                case 'rock':
                  const randomSpritesheet = randomRange(531, 534).toString()
                  const spritesheet = Assets.cache.get(randomSpritesheet)
                  const texture = spritesheet.textures['000_' + randomSpritesheet + '.png']
                  const rock = Sprite.from(texture)
                  rock.name = 'set'
                  rock.roundPixels = true
                  rock.allowMove = false
                  rock.eventMode = 'none'
                  rock.allowClick = false
                  rock.updateAnchor = true
                  cell.addChild(rock)
                  break
                case 'animal':
                  const animals = Assets.cache.get('config').animals
                  const type = randomItem(Object.keys(animals))
                  this.gaia.createAnimal({ i, j, type })
                  break
              }
            } else {
              this.resources.push(new Resource({ i, j, type: 'Salmon' }, this.context))
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
              if (cell.type === 'Water' || (cell.has && cell.has.family === 'building')) {
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
            getCellsAroundPoint(i, j, this.grid, 1, cell => {
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
        if (cell.type !== 'Water') {
          // Side
          if (
            this.grid[i - 1] &&
            this.grid[i - 1][j].type === 'Water' &&
            (!this.grid[i + 1] || this.grid[i + 1][j].type !== 'Water') &&
            (!this.grid[i][j - 1] || this.grid[i][j - 1].type !== 'Water') &&
            (!this.grid[i][j + 1] || this.grid[i][j + 1].type !== 'Water')
          ) {
            cell.setWaterBorder('20000', '008')
          } else if (
            this.grid[i + 1] &&
            this.grid[i + 1][j].type === 'Water' &&
            (!this.grid[i - 1] || this.grid[i - 1][j].type !== 'Water') &&
            (!this.grid[i][j - 1] || this.grid[i][j - 1].type !== 'Water') &&
            (!this.grid[i][j + 1] || this.grid[i][j + 1].type !== 'Water')
          ) {
            cell.setWaterBorder('20000', '009')
          } else if (
            this.grid[i][j - 1] &&
            this.grid[i][j - 1].type === 'Water' &&
            (!this.grid[i + 1] || this.grid[i + 1][j].type !== 'Water') &&
            (!this.grid[i][j + 1] || this.grid[i][j + 1].type !== 'Water') &&
            (!this.grid[i - 1] || this.grid[i - 1][j].type !== 'Water')
          ) {
            cell.setWaterBorder('20000', '011')
          } else if (
            this.grid[i][j + 1] &&
            this.grid[i][j + 1].type === 'Water' &&
            (!this.grid[i + 1] || this.grid[i + 1][j].type !== 'Water') &&
            (!this.grid[i][j - 1] || this.grid[i][j - 1].type !== 'Water') &&
            (!this.grid[i - 1] || this.grid[i - 1][j].type !== 'Water')
          ) {
            cell.setWaterBorder('20000', '010')
          } // Corner
          else if (
            this.grid[i - 1] &&
            this.grid[i - 1][j - 1] &&
            this.grid[i - 1][j - 1].type === 'Water' &&
            (!this.grid[i][j - 1] || this.grid[i][j - 1].type !== 'Water') &&
            (!this.grid[i - 1] || this.grid[i - 1][j].type !== 'Water')
          ) {
            cell.setWaterBorder('20000', '005')
          } else if (
            this.grid[i + 1] &&
            this.grid[i + 1][j - 1] &&
            this.grid[i + 1][j - 1].type === 'Water' &&
            (!this.grid[i][j - 1] || this.grid[i][j - 1].type !== 'Water') &&
            (!this.grid[i + 1] || this.grid[i + 1][j].type !== 'Water')
          ) {
            cell.setWaterBorder('20000', '007')
          } else if (
            this.grid[i - 1] &&
            this.grid[i - 1][j + 1] &&
            this.grid[i - 1][j + 1].type === 'Water' &&
            (!this.grid[i][j + 1] || this.grid[i][j + 1].type !== 'Water') &&
            (!this.grid[i - 1] || this.grid[i - 1][j].type !== 'Water')
          ) {
            cell.setWaterBorder('20000', '004')
          } else if (
            this.grid[i + 1] &&
            this.grid[i + 1][j + 1] &&
            this.grid[i + 1][j + 1].type === 'Water' &&
            (!this.grid[i][j + 1] || this.grid[i][j + 1].type !== 'Water') &&
            (!this.grid[i + 1] || this.grid[i + 1][j].type !== 'Water')
          ) {
            cell.setWaterBorder('20000', '006')
          }
          // Deep corner
          else if (
            this.grid[i][j - 1] &&
            this.grid[i][j - 1].type === 'Water' &&
            this.grid[i - 1] &&
            this.grid[i - 1][j].type === 'Water'
          ) {
            cell.setWaterBorder('20000', '001')
          } else if (
            this.grid[i][j + 1] &&
            this.grid[i][j + 1].type === 'Water' &&
            this.grid[i + 1] &&
            this.grid[i + 1][j].type === 'Water'
          ) {
            cell.setWaterBorder('20000', '002')
          } else if (
            this.grid[i][j - 1] &&
            this.grid[i][j - 1].type === 'Water' &&
            this.grid[i + 1] &&
            this.grid[i + 1][j].type === 'Water'
          ) {
            cell.setWaterBorder('20000', '003')
          } else if (
            this.grid[i][j + 1] &&
            this.grid[i][j + 1].type === 'Water' &&
            this.grid[i - 1] &&
            this.grid[i - 1][j].type === 'Water'
          ) {
            cell.setWaterBorder('20000', '000')
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

  placeResourceGroup(player, instance, quantity, range) {
    const { context, grid } = this
    function getRandomCells(loop = 0) {
      if (loop > 100) {
        return []
      }
      const randomI = randomRange(range[0], range[1])
      const randomJ = randomRange(range[0], range[1])
      const finalI = player.i + randomItem([-randomI, randomI])
      const finalJ = player.j + randomItem([-randomJ, randomJ])
      let cpt = 0
      if (grid[finalI] && grid[finalI][finalJ]) {
        const dist = Math.round(Math.sqrt(quantity, 2))
        const cells = getPlainCellsAroundPoint(finalI, finalJ, grid, dist, cell => {
          cpt++
          if (!cell.solid && cell.category !== 'Water' && !cell.has && !cell.border && !cell.inclined) {
            return true
          }
        })
        if (cells.length >= cpt) {
          return cells
        } else {
          return getRandomCells(loop + 1)
        }
      } else {
        return getRandomCells(loop + 1)
      }
    }
    const cells = getRandomCells()
    if (!cells.length) {
      return
    }
    for (let i = 0; i < quantity; i++) {
      const item = randomItem(cells)
      cells.splice(cells.indexOf(item), 1)
      this.resources.push(new Resource({ i: item.i, j: item.j, type: instance }, context))
    }
  }

  formatCellsDesert() {
    for (let i = 0; i <= this.size; i++) {
      for (let j = 0; j <= this.size; j++) {
        const cell = this.grid[i][j]
        const typeToFormat = ['Grass', 'Jungle']
        if (cell.type === 'Desert') {
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
