import { Container, Assets, Sprite, RenderTexture, Matrix, Graphics, TilingSprite } from 'pixi.js'
import { Resource } from './resource'
import { Human, AI, Gaia } from './players'
import {
  randomRange,
  getZoneInGridWithCondition,
  randomItem,
  getPlainCellsAroundPoint,
  getCellsAroundPoint,
  colors,
  updateInstanceVisibility,
  cartesianToIsometric,
} from '../lib'
import { BUCKET_SIZE, BUILDING_TYPES, CELL_DEPTH, CELL_WIDTH, CELL_HEIGHT, FAMILY_TYPES, LABEL_TYPES, RESOURCE_TYPES, UNIT_TYPES } from '../constants'
import { Cell } from './cell'
import { _DW, _DH, getFogPatternTexture } from './cell/CellFog'

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
    this.difficulty = 'medium'
    this.startingResources = { wood: 200, food: 200, stone: 150, gold: 0 }
    this.revealEverything = false
    this.revealTerrain = false

    this.x = 0
    this.y = 0
    this.startingUnits = 3

    this.playersPos = []
    this.positionsCount = 2
    this.gaia = null
    this.resources = new Set()
    this.instanceBuckets = null

    this.eventMode = 'auto'
    this.allowMove = false
    this.allowClick = false
    this.totalCells
  }

  setCoordinate(x, y) {
    this.x = x
    this.y = y
  }

  _ensureBuckets() {
    if (this.instanceBuckets) return
    const bw = Math.ceil(this.grid.length / BUCKET_SIZE)
    const bh = Math.ceil(this.grid[0].length / BUCKET_SIZE)
    this.instanceBuckets = Array.from({ length: bw }, () => Array.from({ length: bh }, () => new Set()))
  }

  addToInstanceBucket(instance) {
    this._ensureBuckets()
    const bi = Math.floor(instance.i / BUCKET_SIZE)
    const bj = Math.floor(instance.j / BUCKET_SIZE)
    this.instanceBuckets[bi]?.[bj]?.add(instance)
  }

  removeFromInstanceBucket(instance) {
    if (!this.instanceBuckets) return
    const bi = Math.floor(instance.i / BUCKET_SIZE)
    const bj = Math.floor(instance.j / BUCKET_SIZE)
    this.instanceBuckets[bi]?.[bj]?.delete(instance)
  }

  updateInstanceBucket(instance, oldI, oldJ) {
    if (!this.instanceBuckets) return
    const oldBi = Math.floor(oldI / BUCKET_SIZE), oldBj = Math.floor(oldJ / BUCKET_SIZE)
    const newBi = Math.floor(instance.i / BUCKET_SIZE), newBj = Math.floor(instance.j / BUCKET_SIZE)
    if (oldBi !== newBi || oldBj !== newBj) {
      this.instanceBuckets[oldBi]?.[oldBj]?.delete(instance)
      this.instanceBuckets[newBi]?.[newBj]?.add(instance)
    }
  }

  generateFromJSON({ map, players, camera, resources, animals }) {
    const classMap = {
      Human,
      AI,
    }
    const { menu, controls } = this.context
    this.removeChildren()
    this.size = map.length - 1

    this._initFogChunks()

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
      }
    }
    for (let i = 0; i <= this.size; i++) {
      for (let j = 0; j <= this.size; j++) {
        this.grid[i][j].fillWaterCellsAroundCell()
      }
    }
    this.resources = new Set(resources.map(resource => this.addChild(new Resource(resource, this.context))))

    this.formatCellsWaterBorder()
    this.clampReliefAroundWater()
    this.formatCellsRelief()
    this.formatCellsDesert()

    if (!this.revealEverything) {
      for (let i = 0; i <= this.size; i++) {
        for (let j = 0; j <= this.size; j++) {
          this.grid[i][j].setFog()
        }
      }
    }

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
          cell.viewBy = new Set([...cell.viewBy].map(name => getDest(name, this)).filter(Boolean))
          if (player.isPlayed && cell.viewed) {
            if (!cell.viewBy.size) {
              this.grid[i][j].setFog(true)
            } else {
              this.grid[i][j].removeFog()
            }
          }
        }
      }
      player.units.forEach(unit => processUnit(unit, this))
    })

    this._fogInitComplete = true
    this._flushFogQueue()
    this.bakeTerrainToChunks()
    this.ready = true
  }

  generateMap(positionsCountOverride = null, repeat = 0) {
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
        this.positionsCount = 6
        break
      case 220:
        this.positionsCount = 8
        break
      default:
        this.positionsCount = 2
    }

    if (positionsCountOverride !== null) {
      this.positionsCount = positionsCountOverride
    }

    this.totalCells = (this.size + 1) ** 2

    this.playersPos = this.findPlayerPlaces()

    if (this.playersPos.length < this.positionsCount) {
      if (repeat >= 10) {
        alert('Error while generating the map')
        return
      }
      this.generateMap(positionsCountOverride, repeat + 1)
      return
    }

    this.generateResourcesAroundPlayers(this.playersPos)
  }

  stylishMap() {
    const {
      context: { menu, player },
    } = this

    this.gaia = new Gaia(this.context)

    this.generateAnimalsAroundPlayers(this.playersPos)

    this.generateMapRelief()
    this.formatCellsRelief()

    this.generateSets()

    this._initFogChunks()

    if (!this.revealEverything) {
      for (let i = 0; i <= this.size; i++) {
        for (let j = 0; j <= this.size; j++) {
          this.grid[i][j].setFog()
        }
      }
      for (let i = 0; i < player.buildings.length; i++) {
        const building = player.buildings[i]
        updateInstanceVisibility(building)
      }
      for (let i = 0; i < player.units.length; i++) {
        const unit = player.units[i]
        updateInstanceVisibility(unit)
      }
    }

    this._fogInitComplete = true
    this._flushFogQueue()
    this.bakeTerrainToChunks()
    this.ready = true
    menu.updateResourcesMiniMap()
  }

  generatePlayers(playersConfig = null) {
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
        const color = playersConfig?.[i]?.color ?? colors[i]
        const civ = playersConfig?.[i]?.civ ?? 'Greek'
        if (!i) {
          players.push(
            new Human(
              { i: posI, j: posJ, age: 0, civ, color, isPlayed: true },
              context
            )
          )
        } else if (!this.noAI) {
          players.push(new AI({ i: posI, j: posJ, age: 0, civ, color, difficulty: this.difficulty }, context))
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
      const towncenter = player.spawnBuilding({
        i: player.i,
        j: player.j,
        type: BUILDING_TYPES.townCenter,
        isBuilt: true,
      })
      for (let i = 0; i < this.startingUnits; i++) {
        towncenter.placeUnit(UNIT_TYPES.villager)
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
    let forestCells = []
    const pathCells = new Set()

    // Larger range for lac so forests cover the sides between players around the lake
    const rangeFactor = this.mapType === 'lac' ? 0.55 : 0.40
    const forestRange = Math.max(30, Math.floor(this.size * rangeFactor))

    // Squared distance — avoids Math.sqrt in hot loops; compare against safeDistance**2
    function distSq(x1, y1, x2, y2) {
      return (x1 - x2) ** 2 + (y1 - y2) ** 2
    }
    const safeDistanceSq = safeDistance ** 2

    // Function to create a circle of points within a grid, checking boundaries
    function createCircle(centerI, centerJ, radius, density = 0.7, edgeNoise = 0) {
      const circleCells = []
      for (let x = -radius; x <= radius; x++) {
        for (let y = -radius; y <= radius; y++) {
          const noise = Math.random() * edgeNoise - edgeNoise / 2 // Random edge noise
          const effectiveRadius = radius - noise
          if (effectiveRadius > 0 && x * x + y * y <= effectiveRadius * effectiveRadius) {
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
        clusterCenterI = playerI + Math.floor(Math.random() * forestRange * 2 - forestRange)
        clusterCenterJ = playerJ + Math.floor(Math.random() * forestRange * 2 - forestRange)
        tries++
        if (tries > 100) break // Safety exit
      } while (
        distSq(clusterCenterI, clusterCenterJ, playerI, playerJ) < safeDistanceSq ||
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
        soloI = playerI + Math.floor(Math.random() * forestRange * 2 - forestRange)
        soloJ = playerJ + Math.floor(Math.random() * forestRange * 2 - forestRange)
        tries++
        if (tries > 50) break // Safety exit to avoid infinite loop
      } while (
        distSq(soloI, soloJ, playerI, playerJ) < safeDistanceSq ||
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
          clearingCenterI = playerI + Math.floor(Math.random() * forestRange * 2 - forestRange)
          clearingCenterJ = playerJ + Math.floor(Math.random() * forestRange * 2 - forestRange)
          tries++
          if (tries > 100) break
        } while (
          distSq(clearingCenterI, clearingCenterJ, playerI, playerJ) < safeDistanceSq ||
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
          const clearingSet = new Set(clearingCells.map(c => `${c.i},${c.j}`))
          forestCells = forestCells.filter(c => !clearingSet.has(`${c.i},${c.j}`))
        }
      }
    }

    // Generate diagonal paths
    const pathLength = 20
    const pathDirection = Math.random() > 0.5 ? 1 : -1 // Random path direction

    for (let step = 0; step < pathLength; step++) {
      const offsetX = step * pathDirection
      const offsetY = step
      const ni = playerI + offsetX
      const nj = playerJ + offsetY
      if (
        ni >= 0 && ni < gridWidth &&
        nj >= 0 && nj < gridHeight &&
        distSq(ni, nj, playerI, playerJ) >= safeDistanceSq
      ) {
        const randOffsetX = Math.random() > 0.5 ? 1 : -1
        const randOffsetY = Math.random() > 0.5 ? 1 : -1
        pathCells.add(`${ni + randOffsetX},${nj + randOffsetY}`)
      }
    }

    // Remove path cells from forestCells
    for (let idx = forestCells.length - 1; idx >= 0; idx--) {
      if (pathCells.has(`${forestCells[idx].i},${forestCells[idx].j}`)) {
        forestCells.splice(idx, 1)
      }
    }

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
          if ([RESOURCE_TYPES.berrybush, RESOURCE_TYPES.gold, RESOURCE_TYPES.stone].includes(cell.has?.type)) {
            isFree = false
          }
        })
        isFree &&
          this.resources.add(
            this.addChild(new Resource({ i: cell.i, j: cell.j, type: RESOURCE_TYPES.tree }, this.context))
          )
      }
    }
  }

  placeAnimalHerd(player, quantity, range) {
    const { grid } = this
    const randomDistance = randomRange(range[0], range[1])
    const centerI = player.i + randomItem([-randomDistance, randomDistance])
    const centerJ = player.j + randomItem([-randomDistance, randomDistance])

    const validCells = []
    for (let dx = -3; dx <= 3; dx++) {
      for (let dy = -3; dy <= 3; dy++) {
        const newI = centerI + dx
        const newJ = centerJ + dy
        if (grid[newI]?.[newJ]) {
          const cell = grid[newI][newJ]
          if (!cell.solid && cell.category !== 'Water' && !cell.has && !cell.border && !cell.inclined) {
            validCells.push({ i: newI, j: newJ })
          }
        }
      }
    }

    const toPlace = Math.min(quantity, validCells.length)
    for (let i = 0; i < toPlace; i++) {
      const idx = Math.floor(Math.random() * validCells.length)
      const cell = validCells.splice(idx, 1)[0]
      this.gaia.createAnimal({ i: cell.i, j: cell.j, type: 'Gazelle' })
    }
  }

  generateAnimalsAroundPlayers(playersPos) {
    for (let i = 0; i < playersPos.length; i++) {
      this.placeAnimalHerd(playersPos[i], 5, [8, 14])
      this.placeAnimalHerd(playersPos[i], 4, [16, 24])
    }
  }

  generateResourcesAroundPlayers(playersPos) {
    for (let i = 0; i < playersPos.length; i++) {
      this.placeResourceGroup(playersPos[i], RESOURCE_TYPES.berrybush, 8, [7, 14])
      this.placeResourceGroup(playersPos[i], RESOURCE_TYPES.berrybush, 8, [14, 22])
      this.placeResourceGroup(playersPos[i], RESOURCE_TYPES.berrybush, 8, [22, 29])
      this.placeResourceGroup(playersPos[i], RESOURCE_TYPES.stone, 7, [7, 14])
      this.placeResourceGroup(playersPos[i], RESOURCE_TYPES.stone, 7, [14, 22])
      this.placeResourceGroup(playersPos[i], RESOURCE_TYPES.stone, 7, [22, 29])
      this.placeResourceGroup(playersPos[i], RESOURCE_TYPES.gold, 7, [7, 14])
      this.placeResourceGroup(playersPos[i], RESOURCE_TYPES.gold, 7, [14, 22])
      this.placeResourceGroup(playersPos[i], RESOURCE_TYPES.gold, 7, [22, 29])
      this.generateForestAroundPlayer(playersPos[i], this.size * 4)
    }
  }

  generateTerrain(gridSize = 120, mapType = 'plain') {
    // Seeded 2D value noise — each map generation gets a unique seed
    const seed = Math.random() * 9999

    function hash(x, y) {
      const n = Math.sin(x * 127.1 + y * 311.7 + seed * 3.7) * 43758.5453
      return n - Math.floor(n)
    }

    function noise(x, y) {
      const xi = Math.floor(x), yi = Math.floor(y)
      const xf = x - xi, yf = y - yi
      const smooth = t => t * t * (3 - 2 * t)
      const u = smooth(xf), v = smooth(yf)
      const a = hash(xi, yi), b = hash(xi + 1, yi)
      const c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1)
      return a + (b - a) * u + (c - a) * v + (d + a - b - c) * u * v
    }

    // Fractional Brownian Motion — sum of N octaves for natural-looking terrain
    function fbm(x, y, octaves = 5) {
      let val = 0, amp = 0.5, freq = 1, sum = 0
      for (let o = 0; o < octaves; o++) {
        val += noise(x * freq, y * freq) * amp
        sum += amp
        amp *= 0.5
        freq *= 2
      }
      return val / sum
    }

    const scale = 4 / gridSize
    const half = gridSize / 2

    // Smooth radial falloff: 1.0 at center, 0.0 at edge
    function radialFalloff(i, j) {
      const dx = (i - half) / half
      const dy = (j - half) / half
      const dist = Math.sqrt(dx * dx + dy * dy)
      const t = Math.min(1, dist)
      return 1 - t * t * (3 - 2 * t)
    }

    // Pre-compute heightmap and biome map
    const height = new Float32Array(gridSize * gridSize)
    const biome  = new Float32Array(gridSize * gridSize)
    for (let i = 0; i < gridSize; i++) {
      for (let j = 0; j < gridSize; j++) {
        height[i * gridSize + j] = fbm(i * scale, j * scale)
        // Lower frequency (×0.6) → larger biome patches for AoE1-style biome regions
        biome[i * gridSize + j]  = fbm(i * scale * 0.6 + 50, j * scale * 0.6 + 70, 4)
      }
    }

    // Water threshold per map type
    const thresholds = { plain: 0.30, continent: 0.40, lac: 0.42, ilot: 0.52 }
    const waterThreshold = thresholds[mapType] ?? 0.30

    const terrainMap = []
    for (let i = 0; i < gridSize; i++) {
      terrainMap[i] = []
      for (let j = 0; j < gridSize; j++) {
        let h = height[i * gridSize + j]
        const fo = radialFalloff(i, j)

        if (mapType === 'continent') {
          // Stronger boost so the continent is large and water stays at the edges
          h += (fo - 0.5) * 0.75
        } else if (mapType === 'lac') {
          // Depress center (→ lake), raise edges (→ land)
          h -= (fo - 0.3) * 0.50
        } else if (mapType === 'ilot') {
          // Mild edge depression + higher threshold → scattered islands
          h += (fo - 0.5) * 0.20
        }

        terrainMap[i][j] = h < waterThreshold ? 2 : 0
      }
    }

    // Smooth coastlines with 2 passes of cellular automaton.
    // Removes isolated water/land pixels so water-border transition sprites apply correctly.
    for (let pass = 0; pass < 2; pass++) {
      for (let i = 1; i < gridSize - 1; i++) {
        for (let j = 1; j < gridSize - 1; j++) {
          const wn =
            (terrainMap[i - 1][j] === 2 ? 1 : 0) +
            (terrainMap[i + 1][j] === 2 ? 1 : 0) +
            (terrainMap[i][j - 1] === 2 ? 1 : 0) +
            (terrainMap[i][j + 1] === 2 ? 1 : 0)
          if (terrainMap[i][j] !== 2 && wn >= 3) terrainMap[i][j] = 2  // isolated land → water
          if (terrainMap[i][j] === 2 && wn <= 1) terrainMap[i][j] = 0  // isolated water → land
        }
      }
    }

    // Biome pass on land cells — per-type thresholds and larger-patch noise frequency
    // for more cohesive desert/jungle zones (AoE1 style)
    const biomeThresholds = {
      plain:     { lo: 0.38, hi: 0.65 },  // warmer, drier → more desert
      continent: { lo: 0.33, hi: 0.67 },  // balanced
      lac:       { lo: 0.32, hi: 0.68 },  // balanced
      ilot:      { lo: 0.27, hi: 0.60 },  // tropical → more jungle
    }
    const bt = biomeThresholds[mapType] ?? biomeThresholds.plain

    for (let i = 0; i < gridSize; i++) {
      for (let j = 0; j < gridSize; j++) {
        if (terrainMap[i][j] === 2) continue
        const b = biome[i * gridSize + j]
        if (b < bt.lo)      terrainMap[i][j] = 1  // desert
        else if (b > bt.hi) terrainMap[i][j] = 3  // jungle
      }
    }

    return terrainMap
  }

  generateCells() {
    const z = 0
    this.grid = []
    const terrain = this.generateTerrain(this.size ? this.size + 1 : 121, this.mapType || 'plain')
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
            floor.label = LABEL_TYPES.floor
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
                case 'rock': {
                  const randomSpritesheet = randomRange(531, 534).toString()
                  const spritesheet = Assets.cache.get(randomSpritesheet)
                  const texture = spritesheet.textures['000_' + randomSpritesheet + '.png']
                  const rock = Sprite.from(texture)
                  rock.label = LABEL_TYPES.set
                  rock.roundPixels = true
                  rock.allowMove = false
                  rock.eventMode = 'none'
                  rock.allowClick = false
                  rock.updateAnchor = true
                  cell.addChild(rock)
                  break
                }
                case 'animal': {
                  const animals = Assets.cache.get('config').animals
                  const animalType = randomItem(Object.keys(animals))
                  this.gaia.createAnimal({ i, j, type: animalType })
                  break
                }
              }
            } else {
              this.resources.add(this.addChild(new Resource({ i, j, type: RESOURCE_TYPES.salmon }, this.context)))
            }
          }
        }
      }
    }
  }

  generateMapRelief() {
    // Coherent fBm heightmap for natural ridges and hill ranges.
    // Different seed and coarser scale than terrain noise → large, varied features.
    const seed = Math.random() * 9999

    function hash(x, y) {
      const n = Math.sin(x * 83.7 + y * 214.3 + seed * 5.1) * 43758.5453
      return n - Math.floor(n)
    }
    function noise(x, y) {
      const xi = Math.floor(x), yi = Math.floor(y)
      const xf = x - xi, yf = y - yi
      const s = t => t * t * (3 - 2 * t)
      const u = s(xf), v = s(yf)
      const a = hash(xi, yi), b = hash(xi + 1, yi)
      const c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1)
      return a + (b - a) * u + (c - a) * v + (d + a - b - c) * u * v
    }
    function fbm(x, y) {
      let val = 0, amp = 0.5, freq = 1, sum = 0
      for (let o = 0; o < 4; o++) {
        val += noise(x * freq, y * freq) * amp
        sum += amp; amp *= 0.5; freq *= 2
      }
      return val / sum
    }

    const scale = 3 / this.size
    const n = this.size + 1

    const dist = this.getReliefCoastDistances()

    // Precompute fBm heightmap
    const reliefH = new Float32Array(n * n)
    for (let i = 0; i <= this.size; i++) {
      for (let j = 0; j <= this.size; j++) {
        reliefH[i * n + j] = fbm(i * scale, j * scale)
      }
    }

    // Apply relief from highest level to lowest.
    // maxAllowed keeps beach cells and a few inland rings flat before slopes start.
    const levelThresholds = [0, 0.66, 0.78, 0.86]
    for (let targetLevel = 3; targetLevel >= 1; targetLevel--) {
      const threshold = levelThresholds[targetLevel]
      for (let i = 0; i <= this.size; i++) {
        for (let j = 0; j <= this.size; j++) {
          const cell = this.grid[i][j]
          if (cell.category === 'Water' || cell.has || cell.waterBorder) continue
          const maxAllowed = this.getMaxReliefLevelFromCoastDistance(dist[i * n + j])
          const actual = Math.min(targetLevel, maxAllowed)
          if (reliefH[i * n + j] > threshold && actual > cell.z) {
            cell.setCellLevel(actual)
          }
        }
      }
    }

    this.clampReliefAroundWater(dist)

    // Remove isolated z=1 bumps (direct reset, no propagation)
    for (let i = 0; i <= this.size; i++) {
      for (let j = 0; j <= this.size; j++) {
        const cell = this.grid[i][j]
        if (cell.z === 1) {
          let cpt = 0
          getCellsAroundPoint(i, j, this.grid, 1, c => { if (c.z > 0) cpt++ })
          if (cpt < 3) this.setCellReliefLevelDirect(cell, 0)
        }
      }
    }

    // Fill gaps between close elevated cells
    for (let i = 0; i <= this.size; i++) {
      for (let j = 0; j <= this.size; j++) {
        this.grid[i][j].fillReliefCellsAroundCell()
      }
    }
    this.clampReliefAroundWater(dist)
  }

  getReliefCoastDistances() {
    const n = this.size + 1
    const dist = new Int16Array(n * n).fill(9999)
    const queue = []

    for (let i = 0; i <= this.size; i++) {
      for (let j = 0; j <= this.size; j++) {
        const cell = this.grid[i][j]
        if (cell.category === 'Water' || cell.waterBorder) {
          dist[i * n + j] = 0
          queue.push(i * n + j)
        }
      }
    }

    for (let qi = 0; qi < queue.length; qi++) {
      const idx = queue[qi]
      const ci = Math.floor(idx / n), cj = idx % n
      const d = dist[idx]
      for (const [di, dj] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
        const ni = ci + di, nj = cj + dj
        if (ni < 0 || ni > this.size || nj < 0 || nj > this.size) continue
        const nidx = ni * n + nj
        if (dist[nidx] > d + 1) {
          dist[nidx] = d + 1
          queue.push(nidx)
        }
      }
    }

    return dist
  }

  getMaxReliefLevelFromCoastDistance(distance) {
    return Math.max(0, distance - 3)
  }

  setCellReliefLevelDirect(cell, level) {
    const delta = level - cell.z
    if (delta === 0) return
    cell.y -= delta * CELL_DEPTH
    cell.z = level
  }

  clampReliefAroundWater(dist = this.getReliefCoastDistances()) {
    const n = this.size + 1
    for (let i = 0; i <= this.size; i++) {
      for (let j = 0; j <= this.size; j++) {
        const cell = this.grid[i][j]
        const maxAllowed = this.getMaxReliefLevelFromCoastDistance(dist[i * n + j])
        if (cell.z > maxAllowed) this.setCellReliefLevelDirect(cell, maxAllowed)
      }
    }
  }

  formatCellsRelief() {
    for (let i = 0; i <= this.size; i++) {
      for (let j = 0; j <= this.size; j++) {
        const cell = this.grid[i][j]
        if (cell.category === 'Water' || cell.waterBorder) continue
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
    // Apply 20000 beach tiles to every land cell adjacent to water.
    // Bitmask priority: deep corners (2 adjacent orthogonal water) first,
    // then single sides, then diagonal-only outer corners.
    // No exclusive "other sides NOT water" conditions — handles any coastline shape.
    for (let i = 0; i <= this.size; i++) {
      for (let j = 0; j <= this.size; j++) {
        const cell = this.grid[i][j]
        if (cell.type === 'Water') continue

        const n  = this.grid[i - 1]?.[j]?.type === 'Water'
        const s  = this.grid[i + 1]?.[j]?.type === 'Water'
        const w  = this.grid[i]?.[j - 1]?.type === 'Water'
        const e  = this.grid[i]?.[j + 1]?.type === 'Water'
        const nw = this.grid[i - 1]?.[j - 1]?.type === 'Water'
        const sw = this.grid[i + 1]?.[j - 1]?.type === 'Water'
        const ne = this.grid[i - 1]?.[j + 1]?.type === 'Water'
        const se = this.grid[i + 1]?.[j + 1]?.type === 'Water'

        if      (w && n) cell.setWaterBorder('20000', '001')
        else if (e && s) cell.setWaterBorder('20000', '002')
        else if (w && s) cell.setWaterBorder('20000', '003')
        else if (e && n) cell.setWaterBorder('20000', '000')
        else if (n)      cell.setWaterBorder('20000', '008')
        else if (s)      cell.setWaterBorder('20000', '009')
        else if (w)      cell.setWaterBorder('20000', '011')
        else if (e)      cell.setWaterBorder('20000', '010')
        else if (nw)     cell.setWaterBorder('20000', '005')
        else if (sw)     cell.setWaterBorder('20000', '007')
        else if (ne)     cell.setWaterBorder('20000', '004')
        else if (se)     cell.setWaterBorder('20000', '006')
      }
    }

    // Apply 20002 overlay on cells adjacent to waterBorder cells —
    // same approach as formatCellsDesert: the beach tile acts as the "source"
    // and its grass/jungle/desert neighbours get a sandy gradient on top.
    for (let i = 0; i <= this.size; i++) {
      for (let j = 0; j <= this.size; j++) {
        const cell = this.grid[i][j]
        if (!cell.waterBorder) continue

        const overlay = (neighbor, direction) => {
          if (neighbor && !neighbor.waterBorder && neighbor.type !== 'Water' && neighbor.type !== 'Desert') {
            neighbor.setDesertBorder(direction)
          }
        }

        overlay(this.grid[i - 1]?.[j], 'east')
        overlay(this.grid[i + 1]?.[j], 'west')
        overlay(this.grid[i]?.[j - 1], 'south')
        overlay(this.grid[i]?.[j + 1], 'north')
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
            this.grid[i - 1][j].setDesertBorder('east')
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
    const N = this.positionsCount
    const center = this.size / 2
    // Randomise start angle so map layout varies each game
    const startAngle = Math.random() * 2 * Math.PI
    // Search window radius around each angular candidate
    const searchHalf = Math.max(8, Math.floor(this.size * 0.07))
    const border = 12
    // Ordered list of candidate radii (outer → inner) to try per slot
    const radiiFactors = [0.38, 0.30, 0.44, 0.22, 0.46, 0.15]

    for (let i = 0; i < N; i++) {
      const angle = startAngle + (2 * Math.PI / N) * i
      let found = null

      for (const frac of radiiFactors) {
        if (found) break
        const r = Math.floor(this.size * frac)
        const ci = Math.round(center + Math.cos(angle) * r)
        const cj = Math.round(center + Math.sin(angle) * r)

        found = getZoneInGridWithCondition(
          {
            minX: Math.max(border, ci - searchHalf),
            maxX: Math.min(this.size - border, ci + searchHalf),
            minY: Math.max(border, cj - searchHalf),
            maxY: Math.min(this.size - border, cj + searchHalf),
          },
          this.grid,
          5,
          cell => !cell.border && !cell.solid && !cell.inclined && cell.category !== 'Water'
        )
      }

      if (found) results.push(found)
    }

    return results
  }

  placeResourceGroup(player, instance, quantity, range) {
    const { context, grid } = this

    function getValidCells(ci, cj, radius) {
      const cells = []
      for (let dx = -radius; dx <= radius; dx++) {
        for (let dy = -radius; dy <= radius; dy++) {
          const newI = ci + dx
          const newJ = cj + dy
          if (!grid[newI]?.[newJ]) continue
          const cell = grid[newI][newJ]
          let isFree = true
          getPlainCellsAroundPoint(cell.i, cell.j, grid, 3, c => {
            if ([RESOURCE_TYPES.berrybush, RESOURCE_TYPES.gold, RESOURCE_TYPES.stone].includes(c.has?.type)) {
              isFree = false
            }
          })
          if (isFree && !cell.solid && cell.category !== 'Water' && !cell.has && !cell.border && !cell.inclined) {
            cells.push({ i: newI, j: newJ })
          }
        }
      }
      return cells
    }

    // Radial placement: random angle + random distance in [range[0], range[1]]
    const angle = Math.random() * 2 * Math.PI
    const dist = range[0] + Math.random() * (range[1] - range[0])
    const centerI = Math.round(player.i + Math.cos(angle) * dist)
    const centerJ = Math.round(player.j + Math.sin(angle) * dist)

    // Radius 2 → 5×5 tight cluster (AoE1 style), fallback to 3 if not enough cells
    let validCells = getValidCells(centerI, centerJ, 2)
    if (validCells.length < quantity) validCells = getValidCells(centerI, centerJ, 3)
    if (validCells.length < quantity) return

    const cellsToPlace = []
    for (let i = 0; i < quantity; i++) {
      if (!validCells.length) break
      const idx = Math.floor(Math.random() * validCells.length)
      cellsToPlace.push(validCells.splice(idx, 1)[0])
    }

    for (const cell of cellsToPlace) {
      this.resources.add(this.addChild(new Resource({ i: cell.i, j: cell.j, type: instance }, context)))
    }
  }

  // Bake all terrain cells into RenderTexture chunks and remove them from the live scene graph.
  // Reduces updateTransformAndChildren from ~14k nodes to ~1 sprite per chunk.
  bakeTerrainToChunks() {
    const renderer = this.context.app?.renderer
    if (!renderer) return

    // Full isometric pixel bounds of the map (with margin for sprite overflow)
    const { minX, minY, maxX, maxY, totalW, totalH } = this._getFogMapBounds()

    // Cap chunk size at 4096 for broad GPU compatibility
    const gl = renderer.gl
    const maxTex = gl ? Math.min(gl.getParameter(gl.MAX_TEXTURE_SIZE), 4096) : 4096
    const chunksX = Math.ceil(totalW / maxTex)
    const chunksY = Math.ceil(totalH / maxTex)
    const chunkW = totalW / chunksX
    const chunkH = totalH / chunksY

    // All cells must be visible during the bake (fog overlay is separate in fogLayer)
    for (let i = 0; i <= this.size; i++) {
      for (let j = 0; j <= this.size; j++) {
        this.grid[i][j].visible = true
      }
    }

    // Move cells out of the live scene graph into an off-screen container.
    // Cells remain accessible via this.grid for all game logic.
    const terrainContainer = new Container()
    for (let i = 0; i <= this.size; i++) {
      for (let j = 0; j <= this.size; j++) {
        terrainContainer.addChild(this.grid[i][j])
      }
    }

    for (let cx = 0; cx < chunksX; cx++) {
      for (let cy = 0; cy < chunksY; cy++) {
        const cMinX = minX + cx * chunkW
        const cMinY = minY + cy * chunkH
        const cW = Math.ceil(cx === chunksX - 1 ? totalW - cx * chunkW : chunkW)
        const cH = Math.ceil(cy === chunksY - 1 ? totalH - cy * chunkH : chunkH)

        const rt = RenderTexture.create({ width: cW, height: cH })
        const transform = new Matrix().translate(-cMinX, -cMinY)
        renderer.render({ container: terrainContainer, target: rt, transform, clear: true })

        const sprite = new Sprite(rt)
        sprite.x = cMinX
        sprite.y = cMinY
        sprite.zIndex = -1
        sprite.eventMode = 'none'
        sprite.label = 'terrainChunk'
        this.addChild(sprite)
      }
    }

    // Re-initialize entity visibility: cells were moved out of the scene graph so their
    // updateVisible() was never triggered by the normal render pipeline.
    // Walk all viewed cells and show their resources/corpses explicitly.
    const { player } = this.context
    for (let i = 0; i <= this.size; i++) {
      for (let j = 0; j <= this.size; j++) {
        const cell = this.grid[i][j]
        if (player.views[i]?.[j]?.viewed) {
          cell.updateVisible()
        }
      }
    }
  }

  _initFogChunks() {
    this._fogQueue = new globalThis.Map()
    this._fogInitComplete = false
    this._fogChunks = []

    const renderer = this.context.app?.renderer
    if (!renderer) return

    const margin = CELL_WIDTH
    const minX = -this.size * (CELL_WIDTH / 2) - margin
    const minY = -margin
    const maxX = this.size * (CELL_WIDTH / 2) + margin
    const maxY = this.size * CELL_HEIGHT + margin
    const totalW = maxX - minX
    const totalH = maxY - minY

    const gl = renderer.gl
    const maxTex = gl ? Math.min(gl.getParameter(gl.MAX_TEXTURE_SIZE), 4096) : 4096
    const chunksX = Math.ceil(totalW / maxTex)
    const chunksY = Math.ceil(totalH / maxTex)
    const chunkW = totalW / chunksX
    const chunkH = totalH / chunksY

    this._fogBounds = { minX, minY, chunksX, chunksY, chunkW, chunkH, totalW, totalH }

    this.fogLayer = new Container()
    this.fogLayer.eventMode = 'none'
    this.fogLayer.zIndex = 1e9
    this.fogLayer.sortableChildren = true
    this.addChild(this.fogLayer)

    // revealEverything = no fog chunks at all, fogLayer stays empty
    if (this.revealEverything) return

    for (let cx = 0; cx < chunksX; cx++) {
      for (let cy = 0; cy < chunksY; cy++) {
        const cMinX = minX + cx * chunkW
        const cMinY = minY + cy * chunkH
        const cW = Math.ceil(cx === chunksX - 1 ? totalW - cx * chunkW : chunkW)
        const cH = Math.ceil(cy === chunksY - 1 ? totalH - cy * chunkH : chunkH)

        const darknessRt = RenderTexture.create({ width: cW, height: cH })
        const fogRt = RenderTexture.create({ width: cW, height: cH })
        const edgeRt = RenderTexture.create({ width: cW, height: cH })
        const emptyC = new Container()
        renderer.render({ container: emptyC, target: darknessRt, clear: true })
        renderer.render({ container: emptyC, target: fogRt, clear: true })
        renderer.render({ container: emptyC, target: edgeRt, clear: true })
        emptyC.destroy()

        const pattern = this._createFogPatternSprite(cMinX, cMinY, cW, cH)
        renderer.render({ container: pattern, target: fogRt, clear: false })
        pattern.destroy()

        if (!this.revealTerrain) {
          const blackG = new Graphics()
          blackG.rect(cMinX, cMinY, cW, cH).fill({ color: 0x000000 })
          renderer.render({ container: blackG, target: darknessRt, transform: new Matrix().translate(-cMinX, -cMinY), clear: false })
          blackG.destroy()
        }

        const darknessSprite = new Sprite(darknessRt)
        darknessSprite.x = cMinX
        darknessSprite.y = cMinY
        darknessSprite.zIndex = 1
        darknessSprite.eventMode = 'none'
        this.fogLayer.addChild(darknessSprite)

        const fogSprite = new Sprite(fogRt)
        fogSprite.x = cMinX
        fogSprite.y = cMinY
        fogSprite.zIndex = 2
        fogSprite.eventMode = 'none'
        this.fogLayer.addChild(fogSprite)

        const edgeSprite = new Sprite(edgeRt)
        edgeSprite.x = cMinX
        edgeSprite.y = cMinY
        edgeSprite.zIndex = 3
        edgeSprite.eventMode = 'none'
        this.fogLayer.addChild(edgeSprite)

        this._fogChunks.push({
          darknessRt,
          fogRt,
          edgeRt,
          minX: cMinX,
          minY: cMinY,
          w: cW,
          h: cH,
        })
      }
    }

    this._fogTickerCb = () => {
      // Self-remove if this map is no longer active
      if (this.context.map !== this) {
        this.context.app.ticker.remove(this._fogTickerCb)
        return
      }
      this._flushFogQueue()
    }
    this.context.app.ticker.add(this._fogTickerCb)
  }

  _createFogPatternSprite(x, y, width, height) {
    const pattern = new TilingSprite({
      texture: getFogPatternTexture(),
      width: Math.ceil(width),
      height: Math.ceil(height),
    })
    pattern.x = 0
    pattern.y = 0
    pattern.tilePosition.set(-Math.floor(x), -Math.floor(y))
    pattern.eventMode = 'none'
    return pattern
  }

  _getFogMapBounds() {
    if (!this.grid.length) {
      const margin = CELL_WIDTH + CELL_DEPTH * 4
      const minX = -this.size * (CELL_WIDTH / 2) - margin
      const minY = -margin
      const maxX = this.size * (CELL_WIDTH / 2) + margin
      const maxY = this.size * CELL_HEIGHT + margin
      return { minX, minY, maxX, maxY, totalW: maxX - minX, totalH: maxY - minY }
    }

    let minX = Infinity
    let minY = Infinity
    let maxX = -Infinity
    let maxY = -Infinity
    for (let i = 0; i <= this.size; i++) {
      for (let j = 0; j <= this.size; j++) {
        const cell = this.grid[i]?.[j]
        if (!cell) continue
        const bounds = this._getFogCellBounds(cell)
        minX = Math.min(minX, bounds.minX)
        minY = Math.min(minY, bounds.minY)
        maxX = Math.max(maxX, bounds.maxX)
        maxY = Math.max(maxY, bounds.maxY)
      }
    }

    const margin = CELL_DEPTH
    minX -= margin
    minY -= margin
    maxX += margin
    maxY += margin
    return { minX, minY, maxX, maxY, totalW: maxX - minX, totalH: maxY - minY }
  }

  _getFogCellBounds(cell) {
    const hw = _DW / 2
    const hh = _DH / 2
    const [cx, cy] = this._getFogCellCenter(cell)
    return {
      minX: cx - hw,
      minY: cy - hh,
      maxX: cx + hw,
      maxY: cy + hh,
    }
  }

  _getFogChunksForCell(cell) {
    const bounds = this._getFogCellBounds(cell)
    return this._fogChunks.filter(chunk =>
      bounds.maxX >= chunk.minX &&
      bounds.minX <= chunk.minX + chunk.w &&
      bounds.maxY >= chunk.minY &&
      bounds.minY <= chunk.minY + chunk.h
    )
  }

  _drawFogCellShape(graphics, cell) {
    const [top, right, bottom, left] = this._getFogCellPoints(cell)
    graphics.poly([top.x, top.y, right.x, right.y, bottom.x, bottom.y, left.x, left.y])
  }

  _getFogCellOpenSides(cell) {
    const { grid } = this
    const [top, right, bottom, left] = this._getFogCellPoints(cell)
    const sides = []
    const addSide = (neighbor, from, to) => {
      if (neighbor && !neighbor._hasFog) return
      sides.push({ from, to })
    }

    addSide(grid[cell.i - 1]?.[cell.j], left, top)
    addSide(grid[cell.i]?.[cell.j - 1], top, right)
    addSide(grid[cell.i + 1]?.[cell.j], right, bottom)
    addSide(grid[cell.i]?.[cell.j + 1], bottom, left)
    return sides
  }

  _signedDistanceToFogSide(point, from, to, cell) {
    const edgeX = to.x - from.x
    const edgeY = to.y - from.y
    const len = Math.hypot(edgeX, edgeY)
    if (len === 0) return 0
    const [cx, cy] = this._getFogCellCenter(cell)
    const pointCross = edgeX * (point.y - from.y) - edgeY * (point.x - from.x)
    const cellCross = edgeX * (cy - from.y) - edgeY * (cx - from.x)
    return pointCross * Math.sign(cellCross || 1) / len
  }

  _clipFogErasePolygonBySide(points, from, to, cell, inset) {
    const clipped = []
    const isInside = point => this._signedDistanceToFogSide(point, from, to, cell) >= inset
    const intersection = (a, b) => {
      const da = this._signedDistanceToFogSide(a, from, to, cell) - inset
      const db = this._signedDistanceToFogSide(b, from, to, cell) - inset
      const t = da / (da - db)
      return {
        x: a.x + (b.x - a.x) * t,
        y: a.y + (b.y - a.y) * t,
      }
    }

    for (let i = 0; i < points.length; i++) {
      const current = points[i]
      const previous = points[(i + points.length - 1) % points.length]
      const currentInside = isInside(current)
      const previousInside = isInside(previous)

      if (currentInside) {
        if (!previousInside) clipped.push(intersection(previous, current))
        clipped.push(current)
      } else if (previousInside) {
        clipped.push(intersection(previous, current))
      }
    }

    return clipped
  }

  _drawFogEraseCellShape(graphics, cell, inset = 5) {
    let points = this._getFogCellPoints(cell)
    for (const { from, to } of this._getFogCellOpenSides(cell)) {
      points = this._clipFogErasePolygonBySide(points, from, to, cell, inset)
      if (points.length < 3) return
    }
    graphics.poly(points.flatMap(point => [point.x, point.y]))
  }

  _getFogEraseRefreshCells(cell) {
    const { grid } = this
    return [
      cell,
      grid[cell.i - 1]?.[cell.j],
      grid[cell.i]?.[cell.j - 1],
      grid[cell.i + 1]?.[cell.j],
      grid[cell.i]?.[cell.j + 1],
    ].filter(refreshCell => refreshCell && !refreshCell._hasFog)
  }

  _getFogCellCenter(cell) {
    return cartesianToIsometric(cell.i, cell.j)
  }

  _getFogCellPoints(cell) {
    const hw = _DW / 2
    const hh = _DH / 2
    const [cx, cy] = this._getFogCellCenter(cell)
    return [
      { x: cx, y: cy - hh },
      { x: cx + hw, y: cy },
      { x: cx, y: cy + hh },
      { x: cx - hw, y: cy },
    ]
  }

  _redrawFogEdgesInChunk(renderer, chunk) {
    const emptyC = new Container()
    renderer.render({ container: emptyC, target: chunk.edgeRt, clear: true })
    emptyC.destroy()
  }

  _drawVisibleCellsInChunk(graphics, chunk) {
    const maxX = chunk.minX + chunk.w
    const maxY = chunk.minY + chunk.h
    for (let i = 0; i <= this.size; i++) {
      for (let j = 0; j <= this.size; j++) {
        const cell = this.grid[i][j]
        if (cell._hasFog) continue
        const bounds = this._getFogCellBounds(cell)
        if (
          bounds.maxX >= chunk.minX &&
          bounds.minX <= maxX &&
          bounds.maxY >= chunk.minY &&
          bounds.minY <= maxY
        ) {
          this._drawFogEraseCellShape(graphics, cell)
        }
      }
    }
  }

  _flushFogQueue() {
    if (!this._fogQueue || this._fogQueue.size === 0) return
    const renderer = this.context.app?.renderer
    if (!renderer) return

    const chunkUpdates = new globalThis.Map()
    const addChunkUpdate = (cell, state) => {
      const chunks = this._getFogChunksForCell(cell)
      for (const chunk of chunks) {
        if (!chunkUpdates.has(chunk)) chunkUpdates.set(chunk, [])
        chunkUpdates.get(chunk).push({ cell, state })
      }
    }

    for (const [cell, state] of this._fogQueue) {
      addChunkUpdate(cell, state)
      if (state === 'clear') {
        for (const refreshCell of this._getFogEraseRefreshCells(cell)) {
          if (refreshCell === cell) continue
          addChunkUpdate(refreshCell, 'refreshFogErase')
        }
      }
    }
    this._fogQueue.clear()

    for (const [chunk, updates] of chunkUpdates) {
      const transform = new Matrix().translate(-chunk.minX, -chunk.minY)
      const darknessDraw = new Graphics()
      const darknessErase = new Graphics()
      const fogErase = new Graphics()
      let hasDarknessDraw = false
      let hasDarknessErase = false
      let hasFogErase = false
      let needsFogRestore = false

      for (const { cell, state } of updates) {
        if (state === 'clear') {
          this._drawFogCellShape(darknessErase, cell)
          this._drawFogEraseCellShape(fogErase, cell)
          hasDarknessErase = true
          hasFogErase = true
        } else if (state === 'refreshFogErase') {
          this._drawFogEraseCellShape(fogErase, cell)
          hasFogErase = true
        } else if (state === 'fogViewed') {
          this._drawFogCellShape(darknessErase, cell)
          hasDarknessErase = true
          needsFogRestore = true
        } else {
          this._drawFogCellShape(darknessDraw, cell)
          hasDarknessDraw = true
        }
      }

      if (hasDarknessDraw) {
        darknessDraw.fill({ color: 0x000000 })
        renderer.render({ container: darknessDraw, target: chunk.darknessRt, transform, clear: false })
      }
      if (hasDarknessErase) {
        darknessErase.blendMode = 'erase'
        darknessErase.fill({ color: 0xffffff })
        const eraseContainer = new Container()
        eraseContainer.addChild(darknessErase)
        renderer.render({ container: eraseContainer, target: chunk.darknessRt, transform, clear: false })
        eraseContainer.removeChildren()
        eraseContainer.destroy()
      }
      if (needsFogRestore) {
        const pattern = this._createFogPatternSprite(chunk.minX, chunk.minY, chunk.w, chunk.h)
        renderer.render({ container: pattern, target: chunk.fogRt, clear: false })
        pattern.destroy()
        this._drawVisibleCellsInChunk(fogErase, chunk)
        hasFogErase = true
      }
      if (hasFogErase) {
        fogErase.blendMode = 'erase'
        fogErase.fill({ color: 0xffffff })
        const eraseContainer = new Container()
        eraseContainer.addChild(fogErase)
        renderer.render({ container: eraseContainer, target: chunk.fogRt, transform, clear: false })
        eraseContainer.removeChildren()
        eraseContainer.destroy()
      }
      darknessDraw.destroy()
      darknessErase.destroy()
      fogErase.destroy()
    }

    for (const chunk of this._fogChunks) {
      this._redrawFogEdgesInChunk(renderer, chunk)
    }
  }
}
