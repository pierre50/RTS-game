import { Assets, Sprite } from 'pixi.js'
import { Resource } from '../resource'
import { Human, AI, Gaia } from '../players'
import {
  randomItem,
  randomRange,
  colors,
  getCellsAroundPoint,
  getZoneInGridWithCondition,
  updateInstanceVisibility,
} from '../../lib'
import { BUILDING_TYPES, LABEL_TYPES, RESOURCE_TYPES, UNIT_TYPES } from '../../constants'
import { Cell } from '../cell'

export class MapGeneration {
  constructor(map) {
    this.map = map
  }

  isFarEnoughFromCoast(i, j, minDistance = 6) {
    const coastCells = getCellsAroundPoint(i, j, this.map.grid, minDistance, cell => cell.category !== 'Water')
    return coastCells.length === 0
  }

  isInPlayerStartSafeZone(i, j, radius = 20) {
    const safeDistanceSq = radius ** 2
    return this.map.playersPos.some(pos => (pos.i - i) ** 2 + (pos.j - j) ** 2 < safeDistanceSq)
  }

  pickAmbientAnimalType(i, j) {
    const animals = Assets.cache.get('config').animals
    const dangerousAnimalTypes = new Set(['Lion', 'Crocodile', 'Alligator'])
    const safeZoneRadius = 20
    const availableTypes = Object.keys(animals).filter(type => {
      return !dangerousAnimalTypes.has(type) || !this.isInPlayerStartSafeZone(i, j, safeZoneRadius)
    })

    return randomItem(availableTypes.length ? availableTypes : Object.keys(animals))
  }

  pickFishResourceType(i, j) {
    const resources = Assets.cache.get('config').resources
    const fishTypes = Object.entries(resources)
      .filter(([, definition]) => definition.category === 'Fish')
      .map(([type]) => type)
    const whaleSafeDistance = 6
    const availableTypes = this.isFarEnoughFromCoast(i, j, whaleSafeDistance)
      ? fishTypes
      : fishTypes.filter(type => type !== 'Whale')

    return randomItem(availableTypes.length ? availableTypes : [RESOURCE_TYPES.salmon])
  }

  generateFromJSON({ map, players, camera, resources, animals }) {
    const classMap = { Human, AI }
    const { menu, controls } = this.map.context
    this.map.removeChildren()
    this.map.size = map.length - 1

    this.map.context.players = players.map(player => {
      const p = new classMap[player.type]({ ...player, corpses: [], buildings: [], units: [] }, this.map.context)
      if (player.isPlayed) {
        this.map.context.player = p
      }
      return p
    })

    this.map._initFogChunks()
    this.map.gaia = new Gaia(this.map.context)

    for (let i = 0; i <= this.map.size; i++) {
      const line = map[i]
      for (let j = 0; j <= this.map.size; j++) {
        if (!this.map.grid[i]) {
          this.map.grid[i] = []
        }
        const cell = line[j]
        const newCell = new Cell(
          { i, j, z: cell.z ?? 0, type: cell.type, fogSprites: cell.fogSprites ?? [] },
          this.map.context
        )
        this.map.addChild(newCell)
        this.map.grid[i][j] = newCell
      }
    }
    this.map._indexFogChunkCells()

    for (let i = 0; i <= this.map.size; i++) {
      for (let j = 0; j <= this.map.size; j++) {
        this.map.grid[i][j].fillWaterCellsAroundCell()
      }
    }
    this.map.resources = new Set(resources.map(resource => this.map.addChild(new Resource(resource, this.map.context))))

    this.map.formatCellsWaterBorder()
    this.map.clampReliefAroundWater()
    this.map.enforceReliefStepContinuity()
    this.map.formatCellsRelief()
    this.map.formatCellsDesert()

    if (!this.map.revealEverything) {
      for (let i = 0; i <= this.map.size; i++) {
        for (let j = 0; j <= this.map.size; j++) {
          this.map.grid[i][j].setFog()
        }
      }
    }

    controls.setCamera(camera.x, camera.y, true)
    menu.init()
    menu.updateResourcesMiniMap()

    this.map.context.players.forEach((player, index) => {
      const { buildings, units, corpses } = players[index]
      player.buildings = buildings.map(building => player.createBuilding(building))
      player.units = units.map(unit => player.createUnit(unit))
      player.corpses = corpses.map(unit => player.createUnit(unit))
    })
    animals.forEach(animal => this.map.gaia.createAnimal(animal))

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

    this.map.gaia.units.forEach(animal => processUnit(animal, this.map))

    this.map.context.players.forEach(player => {
      for (let i = 0; i <= this.map.size; i++) {
        const line = player.views[i]
        for (let j = 0; j <= this.map.size; j++) {
          const cell = line[j]
          if (cell.viewed) {
            cell.onViewed()
          }
          cell.viewBy = new Set([...cell.viewBy].map(name => getDest(name, this.map)).filter(Boolean))
          if (player.isPlayed && cell.viewed) {
            if (!cell.viewBy.size) {
              this.map.grid[i][j].setFog(true)
            } else {
              this.map.grid[i][j].removeFog()
            }
          }
        }
      }
      player.units.forEach(unit => processUnit(unit, this.map))
    })

    this.map._fogInitComplete = true
    this.map._flushFogQueue()
    this.map.bakeTerrainToChunks()
    this.map.ready = true
  }

  generateMap(positionsCountOverride = null, repeat = 0) {
    this.map.removeChildren()
    this.map.generateCells()

    switch (this.map.size) {
      case 120:
        this.map.positionsCount = 2
        break
      case 144:
        this.map.positionsCount = 3
        break
      case 168:
        this.map.positionsCount = 4
        break
      case 200:
        this.map.positionsCount = 5
        break
      case 220:
        this.map.positionsCount = 5
        break
      case 384:
        this.map.positionsCount = 5
        break
      case 512:
        this.map.positionsCount = 5
        break
      default:
        this.map.positionsCount = 2
    }

    if (positionsCountOverride !== null) {
      this.map.positionsCount = positionsCountOverride
    }

    this.map.totalCells = (this.map.size + 1) ** 2
    this.map.playersPos = this.map.findPlayerPlaces()

    if (this.map.playersPos.length < this.map.positionsCount) {
      if (repeat >= 10) {
        alert('Error while generating the map')
        return
      }
      this.map.generateMap(positionsCountOverride, repeat + 1)
      return
    }
  }

  stylishMap() {
    const {
      context: { menu, player },
    } = this.map

    this.map.gaia = new Gaia(this.map.context)
    this.map.generateMapRelief()
    this.map.formatCellsRelief()
    this.map.placePlayers()
    this.map.generateResourcesAroundPlayers(this.map.playersPos)
    this.map.generateNeutralResourceGroups(this.map.playersPos)
    this.map.generateAnimalsAroundPlayers(this.map.playersPos)
    this.map.generateSets()
    this.map._initFogChunks()

    if (!this.map.revealEverything) {
      for (let i = 0; i <= this.map.size; i++) {
        for (let j = 0; j <= this.map.size; j++) {
          this.map.grid[i][j].setFog()
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

    this.map._fogInitComplete = true
    this.map._flushFogQueue()
    this.map.bakeTerrainToChunks()
    this.map.ready = true
    menu.updateResourcesMiniMap()
  }

  generatePlayers(playersConfig = null) {
    const { context } = this.map

    const players = []
    const poses = []
    const randoms = Array.from(Array(this.map.playersPos.length).keys())

    for (let i = 0; i < this.map.playersPos.length; i++) {
      const pos = randomItem(randoms)
      poses.push(pos)
      randoms.splice(randoms.indexOf(pos), 1)
    }

    for (let i = 0; i < this.map.positionsCount; i++) {
      const posI = this.map.playersPos[poses[i]]?.i
      const posJ = this.map.playersPos[poses[i]]?.j
      if (posI != null && posJ != null) {
        const color = playersConfig?.[i]?.color ?? colors[i]
        const civ = playersConfig?.[i]?.civ ?? 'Greek'
        const team = playersConfig?.[i]?.team ?? null
        if (!i) {
          players.push(new Human({ i: posI, j: posJ, age: 0, civ, color, team, isPlayed: true }, context))
        } else if (!this.map.noAI) {
          players.push(new AI({ i: posI, j: posJ, age: 0, civ, color, team, difficulty: this.map.difficulty }, context))
        }
      }
    }
    return players
  }

  placePlayers() {
    const {
      context: { players },
    } = this.map

    for (let i = 0; i < players.length; i++) {
      const player = players[i]
      const towncenter = player.spawnBuilding({
        i: player.i,
        j: player.j,
        type: BUILDING_TYPES.townCenter,
        isBuilt: true,
      })
      for (let i = 0; i < this.map.startingUnits; i++) {
        towncenter.placeUnit(UNIT_TYPES.villager)
      }
    }
  }

  generateCells() {
    const z = 0
    this.map.grid = []
    const terrain = this.map.generateTerrain(this.map.size ? this.map.size + 1 : 121, this.map.mapType || 'plain')
    this.map.size = terrain.length - 1

    const terrainMap = {
      0: 'Grass',
      1: 'Desert',
      2: 'Water',
      3: 'Jungle',
    }

    for (let i = 0; i <= this.map.size; i++) {
      if (!this.map.grid[i]) this.map.grid[i] = []
      for (let j = 0; j <= this.map.size; j++) {
        const type = terrainMap[terrain[i][j]]
        const cell = new Cell({ i, j, z, type }, this.map.context)
        this.map.addChild(cell)
        this.map.grid[i][j] = cell
      }
    }

    for (let i = 0; i <= this.map.size; i++) {
      for (let j = 0; j <= this.map.size; j++) {
        this.map.grid[i][j].fillWaterCellsAroundCell()
      }
    }

    this.map.formatCellsWaterBorder()
    this.map.formatCellsDesert()
  }

  generateTerrain(gridSize = 120, mapType = 'plain') {
    const seed = Math.random() * 9999

    function hash(x, y) {
      const n = Math.sin(x * 127.1 + y * 311.7 + seed * 3.7) * 43758.5453
      return n - Math.floor(n)
    }

    function noise(x, y) {
      const xi = Math.floor(x),
        yi = Math.floor(y)
      const xf = x - xi,
        yf = y - yi
      const smooth = t => t * t * (3 - 2 * t)
      const u = smooth(xf),
        v = smooth(yf)
      const a = hash(xi, yi),
        b = hash(xi + 1, yi)
      const c = hash(xi, yi + 1),
        d = hash(xi + 1, yi + 1)
      return a + (b - a) * u + (c - a) * v + (d + a - b - c) * u * v
    }

    function fbm(x, y, octaves = 5) {
      let val = 0,
        amp = 0.5,
        freq = 1,
        sum = 0
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

    function radialFalloff(i, j) {
      const dx = (i - half) / half
      const dy = (j - half) / half
      const dist = Math.sqrt(dx * dx + dy * dy)
      const t = Math.min(1, dist)
      return 1 - t * t * (3 - 2 * t)
    }

    const height = new Float32Array(gridSize * gridSize)
    const biome = new Float32Array(gridSize * gridSize)
    for (let i = 0; i < gridSize; i++) {
      for (let j = 0; j < gridSize; j++) {
        height[i * gridSize + j] = fbm(i * scale, j * scale)
        biome[i * gridSize + j] = fbm(i * scale * 0.6 + 50, j * scale * 0.6 + 70, 4)
      }
    }

    const thresholds = { plain: 0.3, continent: 0.4, lac: 0.42, ilot: 0.52 }
    const waterThreshold = thresholds[mapType] ?? 0.3

    const terrainMap = []
    for (let i = 0; i < gridSize; i++) {
      terrainMap[i] = []
      for (let j = 0; j < gridSize; j++) {
        let h = height[i * gridSize + j]
        const fo = radialFalloff(i, j)

        if (mapType === 'continent') {
          h += (fo - 0.5) * 0.75
        } else if (mapType === 'lac') {
          h -= (fo - 0.3) * 0.5
        } else if (mapType === 'ilot') {
          h += (fo - 0.5) * 0.2
        }

        terrainMap[i][j] = h < waterThreshold ? 2 : 0
      }
    }

    for (let pass = 0; pass < 2; pass++) {
      for (let i = 1; i < gridSize - 1; i++) {
        for (let j = 1; j < gridSize - 1; j++) {
          const wn =
            (terrainMap[i - 1][j] === 2 ? 1 : 0) +
            (terrainMap[i + 1][j] === 2 ? 1 : 0) +
            (terrainMap[i][j - 1] === 2 ? 1 : 0) +
            (terrainMap[i][j + 1] === 2 ? 1 : 0)
          if (terrainMap[i][j] !== 2 && wn >= 3) terrainMap[i][j] = 2
          if (terrainMap[i][j] === 2 && wn <= 1) terrainMap[i][j] = 0
        }
      }
    }

    const biomeThresholds = {
      plain: { lo: 0.38, hi: 0.65 },
      continent: { lo: 0.33, hi: 0.67 },
      lac: { lo: 0.32, hi: 0.68 },
      ilot: { lo: 0.27, hi: 0.6 },
    }
    const bt = biomeThresholds[mapType] ?? biomeThresholds.plain

    for (let i = 0; i < gridSize; i++) {
      for (let j = 0; j < gridSize; j++) {
        if (terrainMap[i][j] === 2) continue
        const b = biome[i * gridSize + j]
        if (b < bt.lo) terrainMap[i][j] = 1
        else if (b > bt.hi) terrainMap[i][j] = 3
      }
    }

    return terrainMap
  }

  generateSets() {
    for (let i = 0; i <= this.map.size; i++) {
      for (let j = 0; j <= this.map.size; j++) {
        const cell = this.map.grid[i][j]
        if (getCellsAroundPoint(i, j, this.map.grid, 1, neighbour => neighbour.solid).length > 0) {
          continue
        }
        if (!cell.has && !cell.solid && !cell.border && !cell.inclined) {
          const hasWaterNeighbour =
            getCellsAroundPoint(
              i,
              j,
              this.map.grid,
              2,
              neighbour => neighbour.category === 'Water' || neighbour.waterBorder
            ).length > 0
          if (
            cell.category !== 'Water' &&
            !hasWaterNeighbour &&
            Math.random() < 0.03 &&
            i > 1 &&
            j > 1 &&
            i < this.map.size &&
            j < this.map.size
          ) {
            let floorSpritesheets = []
            switch (cell.type) {
              case 'Desert':
                floorSpritesheets = ['275', '276', '277', '278', '303', '304', '305', '306', '307']
                break
              case 'Jungle':
                floorSpritesheets = [
                  '275',
                  '276',
                  '277',
                  '278',
                  '292',
                  '293',
                  '294',
                  '295',
                  '296',
                  '297',
                  '298',
                  '299',
                  '300',
                  '301',
                ]
                break
              default:
                floorSpritesheets = ['292', '293', '294', '295', '296', '297', '298', '299', '300', '301']
                break
            }
            const randomSpritesheet = randomItem(floorSpritesheets)
            const spritesheet = Assets.cache.get(randomSpritesheet)
            if (!spritesheet) {
              continue
            }
            const texture = spritesheet.textures['000_' + randomSpritesheet + '.png']
            if (!texture) {
              continue
            }
            const floor = Sprite.from(texture)
            floor.label = LABEL_TYPES.floor
            floor.roundPixels = true
            floor.allowMove = false
            floor.eventMode = 'none'
            floor.allowClick = false
            floor.updateAnchor = true
            cell.addChild(floor)
          }
          if (!hasWaterNeighbour && Math.random() < this.map.chanceOfSets) {
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
                  const animalType = this.pickAmbientAnimalType(i, j)
                  this.map.gaia.createAnimal({ i, j, type: animalType })
                  break
                }
              }
            }
          }
          if (cell.category === 'Water' && Math.random() < this.map.chanceOfSets) {
            const fishType = this.pickFishResourceType(i, j)
            this.map.resources.add(this.map.addChild(new Resource({ i, j, type: fishType }, this.map.context)))
          }
        }
      }
    }
  }

  findPlayerPlaces() {
    const results = []
    const N = this.map.positionsCount
    const center = this.map.size / 2
    const startAngle = Math.random() * 2 * Math.PI
    const searchHalf = Math.max(8, Math.floor(this.map.size * 0.07))
    const border = 12
    const radiiFactors = [0.38, 0.3, 0.44, 0.22, 0.46, 0.15]

    for (let i = 0; i < N; i++) {
      const angle = startAngle + ((2 * Math.PI) / N) * i
      let found = null

      for (const frac of radiiFactors) {
        if (found) break
        const r = Math.floor(this.map.size * frac)
        const ci = Math.round(center + Math.cos(angle) * r)
        const cj = Math.round(center + Math.sin(angle) * r)

        found = getZoneInGridWithCondition(
          {
            minX: Math.max(border, ci - searchHalf),
            maxX: Math.min(this.map.size - border, ci + searchHalf),
            minY: Math.max(border, cj - searchHalf),
            maxY: Math.min(this.map.size - border, cj + searchHalf),
          },
          this.map.grid,
          5,
          cell => !cell.border && !cell.solid && !cell.inclined && cell.category !== 'Water'
        )
      }

      if (found) results.push(found)
    }

    return results
  }
}
