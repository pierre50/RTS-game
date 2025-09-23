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
import { CELL_DEPTH } from '../constants'
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
    this.noAI = true

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
    //this.position.set(-x, -y);
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
        const newCell = new Cell({ i, j, z: cell.z, type: cell.type, fogSprites: cell.fogSprites }, this.context)
        this.addChild(newCell)
        this.grid[i][j] = newCell
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
    this.resources = resources.map(resource => this.addChild(new Resource(resource, this.context)))

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
          return val[2] ? map.getChildByLabel(val[2]) : map.grid[val[0]][val[1]]
        } else {
          return map.getChildByLabel(val)
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
        return
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

    //this.generateMapRelief()
    //this.formatCellsRelief()

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
      const posI = this.playersPos[poses[i]]?.i
      const posJ = this.playersPos[poses[i]]?.j
      if (posI && posJ) {
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

  generateForestAroundPlayer(
    player,
    treeCount,
    clusterCount = 12,
    minClusterRadius = 5,
    maxClusterRadius = 10,
    safeDistance = 20,
    clearingProbability = 0.6
  ) {
    const { grid } = this
    const { i: playerI, j: playerJ } = player
    const gridWidth = grid.length
    const gridHeight = grid[0].length
    const forestCells = []
    const pathCells = new Set()

    // Function to calculate the distance between two points
    function distance(x1, y1, x2, y2) {
      return Math.sqrt((x1 - x2) ** 2 + (y1 - y2) ** 2)
    }

    // Function to create a circle of points within a grid, checking boundaries
    function createCircle(centerI, centerJ, radius, density = 0.7, edgeNoise = 0) {
      const circleCells = []
      for (let x = -radius; x <= radius; x++) {
        for (let y = -radius; y <= radius; y++) {
          const distFromCenter = Math.sqrt(x * x + y * y)
          const noise = Math.random() * edgeNoise - edgeNoise / 2 // Random edge noise
          if (distFromCenter + noise <= radius) {
            // If within noisy circle
            const cellI = centerI + x
            const cellJ = centerJ + y
            if (
              cellI >= 0 &&
              cellI < gridWidth && // Ensure cell is within grid bounds
              cellJ >= 0 &&
              cellJ < gridHeight &&
              !grid[cellI][cellJ].solid && // Ensure the cell is not solid
              grid[cellI][cellJ].category !== 'Water' && // Ensure not water
              grid[cellI][cellJ].type !== 'Border' && // Ensure not border
              !grid[cellI][cellJ].inclined && // Ensure not inclined
              Math.random() < density // Tree density control
            ) {
              circleCells.push({ i: cellI, j: cellJ })
            }
          }
        }
      }
      return circleCells
    }

    // Create forest clusters
    for (let cluster = 0; cluster < clusterCount; cluster++) {
      let clusterCenterI, clusterCenterJ
      let tries = 0
      const clusterRadius = Math.floor(Math.random() * (maxClusterRadius - minClusterRadius + 1)) + minClusterRadius // Random radius
      const clusterDensity = Math.random() * 0.5 + 0.5 // Density between 0.5 and 1
      const edgeNoise = Math.random() * 2 // Noise for organic shapes

      // Ensure the cluster is far from the player and within bounds
      do {
        clusterCenterI = playerI + Math.floor(Math.random() * 60 - 30) // Random offset
        clusterCenterJ = playerJ + Math.floor(Math.random() * 60 - 30)
        tries++
        if (tries > 100) break // Safety exit
      } while (
        distance(clusterCenterI, clusterCenterJ, playerI, playerJ) < safeDistance ||
        clusterCenterI < 0 ||
        clusterCenterI >= gridWidth ||
        clusterCenterJ < 0 ||
        clusterCenterJ >= gridHeight || // Stay within grid bounds
        grid[clusterCenterI][clusterCenterJ].category === 'Water' || // Avoid water cells
        grid[clusterCenterI][clusterCenterJ].solid || // Avoid solid cells
        grid[clusterCenterI][clusterCenterJ].inclined // Avoid inclined cells
      )

      if (tries <= 100) {
        const treeCluster = createCircle(clusterCenterI, clusterCenterJ, clusterRadius, clusterDensity, edgeNoise)
        treeCluster.forEach(cell => forestCells.push(cell))
      }
    }

    // Scattered solo trees (20% of total trees)
    const scatteredTreeCount = Math.floor(treeCount * 0.2)
    for (let i = 0; i < scatteredTreeCount; i++) {
      let soloI, soloJ
      let tries = 0

      do {
        soloI = playerI + Math.floor(Math.random() * 60 - 30) // Random offset within [-30, 30]
        soloJ = playerJ + Math.floor(Math.random() * 60 - 30)
        tries++
        if (tries > 50) break // Safety exit to avoid infinite loop
      } while (
        distance(soloI, soloJ, playerI, playerJ) < safeDistance ||
        soloI < 0 ||
        soloI >= gridWidth ||
        soloJ < 0 ||
        soloJ >= gridHeight || // Stay within grid bounds
        grid[soloI][soloJ].category === 'Water' || // Avoid water cells
        grid[soloI][soloJ].solid || // Avoid solid cells
        grid[soloI][soloJ].inclined // Avoid inclined cells
      )

      if (tries <= 50) {
        forestCells.push({ i: soloI, j: soloJ })
      }
    }

    // Generate random clearings based on clearingProbability
    for (let clearing = 0; clearing < clusterCount; clearing++) {
      if (Math.random() < clearingProbability) {
        let clearingCenterI, clearingCenterJ
        let tries = 0
        const clearingRadius = Math.floor(Math.random() * 8) + 5 // Random clearing radius between 5 and 13
        const edgeNoise = Math.random() * 1.5

        do {
          clearingCenterI = playerI + Math.floor(Math.random() * 60 - 30) // Random offset
          clearingCenterJ = playerJ + Math.floor(Math.random() * 60 - 30)
          tries++
          if (tries > 100) break
        } while (
          distance(clearingCenterI, clearingCenterJ, playerI, playerJ) < safeDistance ||
          clearingCenterI < 0 ||
          clearingCenterI >= gridWidth ||
          clearingCenterJ < 0 ||
          clearingCenterJ >= gridHeight || // Stay within grid bounds
          grid[clearingCenterI][clearingCenterJ].category === 'Water' || // Avoid water cells
          grid[clearingCenterI][clearingCenterJ].solid || // Avoid solid cells
          grid[clearingCenterI][clearingCenterJ].inclined // Avoid inclined cells
        )

        if (tries <= 100) {
          const clearingCells = createCircle(clearingCenterI, clearingCenterJ, clearingRadius, 0, edgeNoise)
          clearingCells.forEach(clearedCell => {
            const index = forestCells.findIndex(cell => cell.i === clearedCell.i && cell.j === clearedCell.j)
            if (index > -1) {
              forestCells.splice(index, 1) // Remove tree from clearing
            }
          })
        }
      }
    }

    // Generate diagonal paths
    const pathLength = 20
    const pathDirection = Math.random() > 0.5 ? 1 : -1 // Random path direction

    for (let step = 0; step < pathLength; step++) {
      let offsetX, offsetY
      let tries = 0

      do {
        offsetX = step * pathDirection
        offsetY = step
        tries++
        if (tries > 50) break
      } while (
        distance(playerI + offsetX, playerJ + offsetY, playerI, playerJ) < safeDistance ||
        playerI + offsetX < 0 ||
        playerI + offsetX >= gridWidth ||
        playerJ + offsetY < 0 ||
        playerJ + offsetY >= gridHeight
      )

      if (tries <= 50) {
        const randOffsetX = Math.random() > 0.5 ? 1 : -1
        const randOffsetY = Math.random() > 0.5 ? 1 : -1
        pathCells.add(`${playerI + offsetX + randOffsetX},${playerJ + offsetY + randOffsetY}`)
      }
    }

    // Remove path cells from forestCells
    forestCells.forEach(cell => {
      if (pathCells.has(`${cell.i},${cell.j}`)) {
        forestCells.splice(forestCells.indexOf(cell), 1)
      }
    })

    // Select and place trees in the forest cells
    const cellsToPlace = []
    for (let i = 0; i < treeCount; i++) {
      if (forestCells.length === 0) break
      const itemIndex = Math.floor(Math.random() * forestCells.length)
      const cell = forestCells[itemIndex]
      cellsToPlace.push(cell)
      forestCells.splice(itemIndex, 1)
    }

    // Place the trees in the selected cells
    for (const cell of cellsToPlace) {
      // Ensure again that we're not placing trees on Water, Border, or Solid cells
      if (
        grid[cell.i][cell.j].category !== 'Water' &&
        !grid[cell.i][cell.j].waterBorder &&
        !grid[cell.i][cell.j].solid &&
        !grid[cell.i][cell.j].inclined
      ) {
        let isFree = true
        getPlainCellsAroundPoint(cell.i, cell.j, grid, 3, cell => {
          if (['Berrybush', 'Gold', 'Stone'].includes(cell.has?.type)) {
            isFree = false
          }
        })
        isFree && this.resources.push(this.addChild(new Resource({ i: cell.i, j: cell.j, type: 'Tree' }, this.context)))
      }
    }
  }

  generateResourcesAroundPlayers(playersPos) {
    for (let i = 0; i < playersPos.length; i++) {
      this.placeResourceGroup(playersPos[i], 'Berrybush', 8, [7, 14])
      this.placeResourceGroup(playersPos[i], 'Berrybush', 8, [14, 22])
      this.placeResourceGroup(playersPos[i], 'Berrybush', 8, [22, 29])
      this.placeResourceGroup(playersPos[i], 'Stone', 7, [7, 14])
      this.placeResourceGroup(playersPos[i], 'Stone', 7, [14, 22])
      this.placeResourceGroup(playersPos[i], 'Stone', 7, [22, 29])
      this.placeResourceGroup(playersPos[i], 'Gold', 7, [7, 14])
      this.placeResourceGroup(playersPos[i], 'Gold', 7, [14, 22])
      this.placeResourceGroup(playersPos[i], 'Gold', 7, [22, 29])
      this.generateForestAroundPlayer(playersPos[i], this.size * 4)
    }
  }

  generateTerrain(gridSize = 120, mapModel = 'plain') {
    const terrainMap = []

    // Initialize the map with default grass (0)
    for (let i = 0; i < gridSize; i++) {
      terrainMap[i] = []
      for (let j = 0; j < gridSize; j++) {
        terrainMap[i][j] = 0 // Default to grass
      }
    }

    // Helper function to generate terrain clusters around a point
    function generateTerrainCluster(x, y, radius, type) {
      for (let i = -radius; i <= radius; i++) {
        for (let j = -radius; j <= radius; j++) {
          const nx = x + i
          const ny = y + j
          if (nx >= 0 && nx < gridSize && ny >= 0 && ny < gridSize && i * i + j * j <= radius * radius) {
            terrainMap[nx][ny] = type
          }
        }
      }
    }

    // Generate water with a smoother, randomized approach
    function generateWater() {
      if (mapModel === 'continent') {
        const edgeSize = 10 // Base edge size for water
        const roundFactor = 0.15 // Controls the "smoothness" of the water edge

        // Loop through the map and set water in a rounded pattern with random noise
        for (let i = 0; i < gridSize; i++) {
          for (let j = 0; j < gridSize; j++) {
            const distFromCenter = Math.abs(i - gridSize / 2) + Math.abs(j - gridSize / 2) // Distance from center

            // Add smooth water around the edges with randomized borders
            const edgeDist = Math.min(i, j, gridSize - i, gridSize - j)
            const randomOffset = Math.random() * 5 - 2.5 // Randomize water edge for more natural look

            if (edgeDist < edgeSize + Math.sin(distFromCenter * roundFactor) * 5 + randomOffset) {
              terrainMap[i][j] = 2 // Water
            }
          }
        }
      } else if (mapModel === 'lac') {
        const centerX = Math.floor(gridSize / 2)
        const centerY = Math.floor(gridSize / 2)
        const baseRadius = Math.floor(gridSize / 4) // Base radius for the lake
        const roundFactor = 0.6 // Adjust this for more/less rounding

        // Create a lake with a smoother, randomized border
        for (let i = -baseRadius; i <= baseRadius; i++) {
          for (let j = -baseRadius; j <= baseRadius; j++) {
            const nx = centerX + i
            const ny = centerY + j
            const distanceFromCenter = Math.sqrt(i * i + j * j)
            const noise = Math.sin(distanceFromCenter * roundFactor) * 2 // Create smooth noise
            const randomOffset = Math.random() * 3 - 1.5 // Add randomness to the lake shape

            if (
              nx >= 0 &&
              nx < gridSize &&
              ny >= 0 &&
              ny < gridSize &&
              distanceFromCenter < baseRadius + noise + randomOffset
            ) {
              terrainMap[nx][ny] = 2 // Water
            }
          }
        }
      }
      // 'plain' model: no water, so do nothing
    }

    // Generate clusters of desert (1) and jungle (3)
    function generateLandTerrain() {
      // Generate desert areas (1)
      generateClusters(1, 8, 5, 10)

      // Generate jungle areas (3)
      generateClusters(3, 10, 4, 8)
    }

    // Generic function to generate clustered terrain types
    function generateClusters(type, clusterCount, clusterSizeMin, clusterSizeMax) {
      for (let i = 0; i < clusterCount; i++) {
        const clusterX = Math.floor(Math.random() * gridSize)
        const clusterY = Math.floor(Math.random() * gridSize)
        const radius = Math.floor(Math.random() * (clusterSizeMax - clusterSizeMin)) + clusterSizeMin

        // Ensure we avoid water if generating jungle/desert in the 'lac' or 'continent' models
        if (type !== 2 && terrainMap[clusterX][clusterY] === 2) {
          continue // Skip if this area is water
        }

        generateTerrainCluster(clusterX, clusterY, radius, type)
      }
    }

    // Generate water based on the map model
    generateWater()

    // Generate desert and jungle clusters
    generateLandTerrain()

    return terrainMap
  }

  generateCells() {
    const z = 0
    const terrain = this.generateTerrain(121)
    this.size = terrain.length - 1

    // Map terrain numbers to cell types
    const terrainMap = {
      0: 'Grass',
      1: 'Desert',
      2: 'Water',
      3: 'Jungle',
    }

    for (let i = 0; i <= this.size; i++) {
      if (!this.grid[i]) this.grid[i] = []
      for (let j = 0; j <= this.size; j++) {
        const type = terrainMap[terrain[i][j]]
        const cell = new Cell({ i, j, z, type }, this.context)
        this.addChild(cell) // ensures cell.parent is set
        this.grid[i][j] = cell
      }
    }

    // Post-processing
    for (let i = 0; i <= this.size; i++) {
      for (let j = 0; j <= this.size; j++) {
        this.grid[i][j].fillWaterCellsAroundCell()
      }
    }

    this.formatCellsWaterBorder()
    this.formatCellsDesert()
  }

  generateSets() {
    for (let i = 0; i <= this.size; i++) {
      for (let j = 0; j <= this.size; j++) {
        const cell = this.grid[i][j]
        if (getCellsAroundPoint(i, j, this.grid, 1, neighbour => neighbour.solid).length > 0) {
          continue
        }
        if (!cell.has && !cell.solid && !cell.border && !cell.inclined) {
          if (cell.category !== 'Water' && Math.random() < 0.03 && i > 1 && j > 1 && i < this.size && j < this.size) {
            const randomSpritesheet = randomRange(292, 301).toString()
            const spritesheet = Assets.cache.get(randomSpritesheet)
            const texture = spritesheet.textures['000_' + randomSpritesheet + '.png']
            const floor = Sprite.from(texture)
            floor.label = 'floor'
            floor.roundPixels = true
            floor.allowMove = false
            floor.eventMode = 'none'
            floor.allowClick = false
            floor.updateAnchor = true
            cell.addChild(floor)
          }
          if (Math.random() < this.chanceOfSets) {
            if (cell.category !== 'Water') {
              const type = randomItem(['tree', 'rock', 'animal'])
              switch (type) {
                case 'rock':
                  const randomSpritesheet = randomRange(531, 534).toString()
                  const spritesheet = Assets.cache.get(randomSpritesheet)
                  const texture = spritesheet.textures['000_' + randomSpritesheet + '.png']
                  const rock = Sprite.from(texture)
                  rock.label = 'set'
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
              this.resources.push(this.addChild(new Resource({ i, j, type: 'Salmon' }, this.context)))
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
              if (cell.category === 'Water' || (cell.has && cell.has.family === 'building')) {
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
          cell.setReliefBorder('014', CELL_DEPTH / 2)
        } else if (
          this.grid[i + 1] &&
          this.grid[i + 1][j].z - cell.z === 1 &&
          (!this.grid[i - 1] || this.grid[i - 1][j].z <= cell.z) &&
          (!this.grid[i][j - 1] || this.grid[i][j - 1].z <= cell.z) &&
          (!this.grid[i][j + 1] || this.grid[i][j + 1].z <= cell.z)
        ) {
          cell.setReliefBorder('015', CELL_DEPTH / 2)
        } else if (
          this.grid[i][j - 1] &&
          this.grid[i][j - 1].z - cell.z === 1 &&
          (!this.grid[i + 1] || this.grid[i + 1][j].z <= cell.z) &&
          (!this.grid[i][j + 1] || this.grid[i][j + 1].z <= cell.z) &&
          (!this.grid[i - 1] || this.grid[i - 1][j].z <= cell.z)
        ) {
          cell.setReliefBorder('016', CELL_DEPTH / 2)
        } else if (
          this.grid[i][j + 1] &&
          this.grid[i][j + 1].z - cell.z === 1 &&
          (!this.grid[i + 1] || this.grid[i + 1][j].z <= cell.z) &&
          (!this.grid[i][j - 1] || this.grid[i][j - 1].z <= cell.z) &&
          (!this.grid[i - 1] || this.grid[i - 1][j].z <= cell.z)
        ) {
          cell.setReliefBorder('013', CELL_DEPTH / 2)
        } // Corner
        else if (
          this.grid[i - 1] &&
          this.grid[i - 1][j - 1] &&
          this.grid[i - 1][j - 1].z - cell.z === 1 &&
          (!this.grid[i][j - 1] || this.grid[i][j - 1].z <= cell.z) &&
          (!this.grid[i - 1] || this.grid[i - 1][j].z <= cell.z)
        ) {
          cell.setReliefBorder('010', CELL_DEPTH / 2)
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
          cell.setReliefBorder('009', CELL_DEPTH / 2)
        }
        // Deep corner
        else if (
          this.grid[i][j - 1] &&
          this.grid[i][j - 1].z - cell.z === 1 &&
          this.grid[i - 1] &&
          this.grid[i - 1][j].z - cell.z === 1
        ) {
          cell.setReliefBorder('022', CELL_DEPTH / 2)
        } else if (
          this.grid[i][j + 1] &&
          this.grid[i][j + 1].z - cell.z === 1 &&
          this.grid[i + 1] &&
          this.grid[i + 1][j].z - cell.z === 1
        ) {
          cell.setReliefBorder('021', CELL_DEPTH / 2)
        } else if (
          this.grid[i][j - 1] &&
          this.grid[i][j - 1].z - cell.z === 1 &&
          this.grid[i + 1] &&
          this.grid[i + 1][j].z - cell.z === 1
        ) {
          cell.setReliefBorder('023', CELL_DEPTH)
        } else if (
          this.grid[i][j + 1] &&
          this.grid[i][j + 1].z - cell.z === 1 &&
          this.grid[i - 1] &&
          this.grid[i - 1][j].z - cell.z === 1
        ) {
          cell.setReliefBorder('024', CELL_DEPTH)
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
        }
      }
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

    // Function to get valid cells around a center point within a specific distance
    function getValidCells(centerI, centerJ, dist) {
      const cells = []
      // Check surrounding cells within the specified distance
      for (let dx = -dist; dx <= dist; dx++) {
        for (let dy = -dist; dy <= dist; dy++) {
          const newI = centerI + dx
          const newJ = centerJ + dy

          // Ensure the new coordinates are within the grid bounds
          if (grid[newI] && grid[newI][newJ]) {
            const cell = grid[newI][newJ]
            let isFree = true
            getPlainCellsAroundPoint(cell.i, cell.j, grid, 3, cell => {
              if (['Berrybush', 'Gold', 'Stone'].includes(cell.has?.type)) {
                isFree = false
              }
            })
            // Check if the cell is valid
            if (isFree && !cell.solid && cell.category !== 'Water' && !cell.has && !cell.border && !cell.inclined) {
              cells.push({ i: newI, j: newJ })
            }
          }
        }
      }
      return cells
    }

    // Get a random center point around the player's position within the specified range
    const randomDistance = randomRange(range[0], range[1])
    const centerI = player.i + randomItem([-randomDistance, randomDistance])
    const centerJ = player.j + randomItem([-randomDistance, randomDistance])

    // Gather valid cells around the center point
    const validCells = getValidCells(centerI, centerJ, 2) // Adjust distance to suit clustering

    // Check if we have enough valid cells to place the required quantity of resources
    if (validCells.length < quantity) {
      console.warn('Not enough valid cells found for resource placement.')
      return // Exit if not enough valid cells found
    }

    // Randomly select the required number of cells from the valid cells
    const cellsToPlace = []
    for (let i = 0; i < quantity; i++) {
      const itemIndex = Math.floor(Math.random() * validCells.length)
      const cell = validCells[itemIndex]
      cellsToPlace.push(cell) // Store the selected cell for placement
      validCells.splice(itemIndex, 1) // Remove it from valid cells to avoid duplicates
    }

    // Place resources in the selected cells
    for (const cell of cellsToPlace) {
      this.resources.push(this.addChild(new Resource({ i: cell.i, j: cell.j, type: instance }, context)))
    }
  }
}
