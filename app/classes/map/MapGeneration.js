import { Assets, Sprite } from 'pixi.js'
import { Resource } from '../resource'
import { Human, AI, Gaia } from '../players'
import {
  colors,
  getCellsAroundPoint,
  getZoneInGridWithCondition,
  updateInstanceVisibility,
  rehydrateAIKnowledge,
} from '../../lib'
import { BUILDING_TYPES, FAMILY_TYPES, LABEL_TYPES, PLAYER_TYPES, RESOURCE_TYPES, UNIT_TYPES } from '../../constants'
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
    const dangerousAnimalTypes = new Set(['Lion', 'Crocodile', 'Alligator', 'Elephant'])
    const safeZoneRadius = 20
    const availableTypes = Object.keys(animals).filter(type => {
      return !dangerousAnimalTypes.has(type) || !this.isInPlayerStartSafeZone(i, j, safeZoneRadius)
    })

    return this.map.randomItem(availableTypes.length ? availableTypes : Object.keys(animals))
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

    return this.map.randomItem(availableTypes.length ? availableTypes : [RESOURCE_TYPES.salmon])
  }

  generateFromJSON({ map, players, camera, resources, animals, runtime }) {
    const classMap = { Human, AI }
    const { menu, controls } = this.map.context
    this.map.removeChildren()
    this.map.resetRandom()
    this.map.size = map.length - 1
    this.map.invalidateReliefCoastDistances()

    this.map.context.players = players.map(player => {
      const p = new classMap[player.type]({ ...player, corpses: [], buildings: [], units: [] }, this.map.context)
      if (player.isPlayed) {
        this.map.context.player = p
      }
      return p
    })
    if (Number.isFinite(runtime?.elapsedMs) && this.map.context.scheduler) {
      this.map.context.scheduler.elapsedMs = Math.max(0, runtime.elapsedMs)
    }

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

    this.map.fillWaterGaps()
    this.map.normalizeWaterTopology()
    this.map.resources = new Set(resources.map(resource => this.map.addChild(new Resource(resource, this.map.context))))

    this.map.rebuildTerrainAppearance()

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
      player.buildings = buildings.map(building => player.createBuilding({ ...building, skipBuiltEffects: true }))
      player.units = units.map(unit => player.createUnit(unit))
      player.corpses = corpses.map(unit => player.createUnit(unit))
    })
    animals.filter(animal => !animal.isDestroyed).forEach(animal => this.map.gaia.createAnimal(animal))

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

    function restoreBuildingAssignments(player, savedBuildings, context) {
      for (let index = 0; index < player.buildings.length; index++) {
        const building = player.buildings[index]
        const savedBuilding = savedBuildings[index]
        if (!building || !savedBuilding?.isUsedBy) continue
        const user = getDest(savedBuilding.isUsedBy, context)
        if (user && !user.isDead && !user.isDestroyed) {
          building.isUsedBy = user
        }
      }
    }

    function restoreAIState(player, savedPlayer, context) {
      if (player.type !== PLAYER_TYPES.ai || !savedPlayer?.aiState) return

      const state = savedPlayer.aiState
      const now = player.getNow()
      const validPhases = new Set(['economy', 'military_build', 'attack'])
      if (validPhases.has(state.phase)) {
        player.phase = state.phase
      }

      if (Number.isFinite(state.lastAttackWaveAgo)) {
        player.lastAttackWaveAt = now - Math.max(0, state.lastAttackWaveAgo)
      } else if (Number.isFinite(state.lastAttackWaveAt) && Number.isFinite(state.savedAt)) {
        player.lastAttackWaveAt = now - Math.max(0, state.savedAt - state.lastAttackWaveAt)
      }

      const restoreMemories = (savedMemories, memoryMap) => {
        memoryMap.clear()
        for (const savedMemory of savedMemories || []) {
          if (!savedMemory || typeof savedMemory !== 'object') continue
          const instance = getDest(savedMemory.instance, context)
          if (!instance || instance.isDead || instance.isDestroyed || !player.isEnemy(instance.owner)) continue

          player.rememberEnemy(instance)
          const memory = memoryMap.get(instance.label)
          if (!memory) continue
          memory.lastSeenAt = now - Math.max(0, savedMemory.lastSeenAgo || 0)
          memory.visible = player.views.isVisible(instance.i, instance.j)
          if (instance.family === FAMILY_TYPES.building) player.foundedEnemyBuildings.add(instance)
          if (instance.family === FAMILY_TYPES.unit) player.foundedEnemyUnits.add(instance)
        }
      }
      restoreMemories(state.enemyUnits, player.enemyUnitMemory)
      restoreMemories(state.enemyBuildings, player.enemyBuildingMemory)

      player.threatenedTargets.clear()
      for (const threat of state.threatenedTargets || []) {
        if (!threat || typeof threat !== 'object') continue
        const target = getDest(threat.target, context)
        if (!target || target.isDead || target.isDestroyed) continue

        const attacker = getDest(threat.attacker, context)
        const lastSeenAgo = Number.isFinite(threat.lastSeenAgo)
          ? Math.max(0, threat.lastSeenAgo)
          : Number.isFinite(state.savedAt) && Number.isFinite(threat.lastSeenAt)
            ? Math.max(0, state.savedAt - threat.lastSeenAt)
            : 0
        player.threatenedTargets.set(target.label, {
          target,
          attacker: attacker || null,
          attackerFamily: attacker?.family || threat.attackerFamily || null,
          attackerType: attacker?.type || threat.attackerType || null,
          lastSeenAt: now - lastSeenAgo,
          count: Number.isFinite(threat.count) ? threat.count : 0,
        })
      }
    }

    this.map.gaia.units.forEach(animal => processUnit(animal, this.map))

    this.map.context.players.forEach((player, index) => {
      const savedPlayer = players[index]
      player.views.restoreViewers(name => getDest(name, this.map))
      for (let i = 0; i <= this.map.size; i++) {
        for (let j = 0; j <= this.map.size; j++) {
          if (player.views.isViewed(i, j)) {
            player.views.onViewed?.(i, j)
          }
          if (player.isPlayed && player.views.isViewed(i, j)) {
            if (!player.views.isVisible(i, j)) {
              this.map.grid[i][j].setFog(true)
            } else {
              this.map.grid[i][j].removeFog()
            }
          }
        }
      }
      restoreBuildingAssignments(player, savedPlayer?.buildings || [], this.map)
      rehydrateAIKnowledge(player, this.map)
      restoreAIState(player, savedPlayer, this.map)
      player.units.forEach(unit => processUnit(unit, this.map))
    })

    this.map._fogInitComplete = true
    this.map._flushFogQueue()
    this.map.bakeTerrainToChunks()
    this.map.ready = true
  }

  generateMap(positionsCountOverride = null, repeat = 0) {
    this.map.removeChildren()
    if (!Number.isFinite(this.map.seed)) this.map.seed = Math.random() * 9999
    this.map.resetRandom(repeat)

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

    this.map.generateCells()

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

  async stylishMap({ onProgress = async () => {} } = {}) {
    const {
      context: { menu, player },
    } = this.map

    const timings = this.map.generationTimings || {}
    const measure = (name, callback) => {
      const startedAt = performance.now()
      const result = callback()
      timings[name] = performance.now() - startedAt
      return result
    }

    this.map.gaia = new Gaia(this.map.context)
    await onProgress('generatingRelief', 0.28)
    measure('relief', () => this.map.generateMapRelief())
    measure('terrainRendering', () => this.map.rebuildTerrainAppearance())
    await onProgress('generatingPlayers', 0.48)
    measure('playerPlacement', () => this.map.placePlayers())
    await onProgress('generatingResources', 0.58)
    measure('playerResources', () => this.map.generateResourcesAroundPlayers(this.map.playersPos))
    measure('neutralResources', () => this.map.generateNeutralResourceGroups(this.map.playersPos))
    measure('animals', () => this.map.generateAnimalsAroundPlayers(this.map.playersPos))
    await onProgress('generatingDecorations', 0.74)
    measure('decorations', () => this.map.generateSets())
    await onProgress('generatingFog', 0.86)
    measure('fogInit', () => this.map._initFogChunks())

    if (!this.map.revealEverything) {
      const fogCellsStartedAt = performance.now()
      for (let i = 0; i <= this.map.size; i++) {
        for (let j = 0; j <= this.map.size; j++) {
          this.map.grid[i][j].setFog()
        }
      }
      for (let i = 0; i < player.buildings.length; i++) {
        const building = player.buildings[i]
        building.visibleCells = new Set()
        updateInstanceVisibility(building)
      }
      for (let i = 0; i < player.units.length; i++) {
        const unit = player.units[i]
        unit.visibleCells = new Set()
        updateInstanceVisibility(unit)
      }
      timings.fogCells = performance.now() - fogCellsStartedAt
    }

    this.map._fogInitComplete = true
    this.map._flushFogQueue()
    await onProgress('finalizingWorld', 0.93)
    this.map.bakeTerrainToChunks()
    this.map.ready = true
    this.map.generationTimings = timings
    console.table(
      Object.fromEntries(Object.entries(timings).map(([name, duration]) => [name, `${duration.toFixed(1)} ms`]))
    )
    menu.updateResourcesMiniMap()
  }

  applyTechnologyToPlayer(player, type) {
    if (player.technologies.includes(type)) return

    const config = player.techs[type]
    if (!config) return

    if (Array.isArray(player[config.key])) {
      player[config.key].push(config.value || type)
    } else {
      player[config.key] = config.value || type
    }

    if (config.action) {
      switch (config.action.type) {
        case 'upgradeUnit':
          player.units.forEach(unit => {
            if (unit.type === config.action.source) unit.upgrade(config.action.target)
          })
          break
        case 'upgradeBuilding':
          player.buildings.forEach(building => {
            if (building.type === config.action.source) building.upgrade(config.action.target)
          })
          break
        case 'improve':
          player.updateConfig(
            config.action.operations.map(operation => ({
              ...operation,
              value: Number(operation.value),
            }))
          )
          break
      }
    }
  }

  applyStartingBonuses(player) {
    const startingAge = Math.max(0, Math.min(Number(this.map.startingAge) || 0, 3))
    player.age = startingAge

    if (!this.map.allTechnologies) return

    const ageTechs = ['ToolAge', 'BronzeAge', 'IronAge']
    ageTechs.forEach(type => this.applyTechnologyToPlayer(player, type))

    Object.keys(player.techs).forEach(type => {
      if (!ageTechs.includes(type)) {
        this.applyTechnologyToPlayer(player, type)
      }
    })
  }

  generatePlayers(playersConfig = null) {
    const { context } = this.map

    const players = []
    const poses = []
    const randoms = Array.from(Array(this.map.playersPos.length).keys())

    for (let i = 0; i < this.map.playersPos.length; i++) {
      const pos = this.map.randomItem(randoms)
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
        const difficulty = playersConfig?.[i]?.difficulty ?? this.map.difficulty
        if (!i) {
          players.push(new Human({ i: posI, j: posJ, age: 0, civ, color, team, isPlayed: true }, context))
        } else if (!this.map.noAI) {
          players.push(new AI({ i: posI, j: posJ, age: 0, civ, color, team, difficulty }, context))
        }
      }
    }

    players.forEach(player => this.applyStartingBonuses(player))

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
    this.map.invalidateReliefCoastDistances()
    const terrain = this.map.generateTerrain(
      this.map.size ? this.map.size + 1 : 121,
      this.map.mapType || 'plain',
      this.map.seed
    )
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

    this.map.fillWaterGaps()
    this.map.normalizeWaterTopology()
    this.map.formatCellsWaterBorder()
  }

  generateTerrain(gridSize = 120, mapType = 'plain', seed) {
    if (seed == null) seed = Math.random() * 9999
    this.map.seed = seed

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

    if (mapType === 'ilot') {
      const terrainMap = []
      const cornerOffset = Math.max(18, Math.floor(gridSize * 0.16))
      const islandCenters = [
        { i: cornerOffset, j: cornerOffset },
        { i: cornerOffset, j: gridSize - 1 - cornerOffset },
        { i: gridSize - 1 - cornerOffset, j: cornerOffset },
        { i: gridSize - 1 - cornerOffset, j: gridSize - 1 - cornerOffset },
      ]

      if (this.map.positionsCount > 4) {
        islandCenters.push({ i: Math.floor(gridSize / 2), j: Math.floor(gridSize / 2) })
      }

      const islandProfiles = islandCenters.map((center, index) => {
        const stretchX = 0.92 + hash(center.i + 17, center.j + 31) * 0.42
        const stretchY = 0.92 + hash(center.i + 43, center.j + 59) * 0.42
        const angle = hash(center.i + 71, center.j + 89) * Math.PI
        const edgeNoise = 0.12 + hash(center.i + 97, center.j + 113) * 0.18
        const baseRadius =
          index === 4 ? Math.max(22, Math.floor(gridSize * 0.17)) : Math.max(28, Math.floor(gridSize * 0.24))
        const lobeA = 2 + Math.floor(hash(center.i + 131, center.j + 149) * 3)
        const lobeB = 5 + Math.floor(hash(center.i + 167, center.j + 181) * 4)
        const lobeC = 8 + Math.floor(hash(center.i + 197, center.j + 211) * 5)
        const phaseA = hash(center.i + 223, center.j + 227) * Math.PI * 2
        const phaseB = hash(center.i + 229, center.j + 233) * Math.PI * 2
        const phaseC = hash(center.i + 239, center.j + 241) * Math.PI * 2
        const coveDepth = 0.12 + hash(center.i + 251, center.j + 257) * 0.16
        const coveScale = 0.18 + hash(center.i + 263, center.j + 269) * 0.2

        return {
          center,
          stretchX,
          stretchY,
          angle,
          edgeNoise,
          baseRadius,
          lobeA,
          lobeB,
          lobeC,
          phaseA,
          phaseB,
          phaseC,
          coveDepth,
          coveScale,
        }
      })

      for (let i = 0; i < gridSize; i++) {
        terrainMap[i] = []
        for (let j = 0; j < gridSize; j++) {
          let islandInfluence = 0

          for (let c = 0; c < islandProfiles.length; c++) {
            const {
              center,
              stretchX,
              stretchY,
              angle,
              edgeNoise,
              baseRadius,
              lobeA,
              lobeB,
              lobeC,
              phaseA,
              phaseB,
              phaseC,
              coveDepth,
              coveScale,
            } = islandProfiles[c]
            const dx = i - center.i
            const dy = j - center.j
            const rx = dx * Math.cos(angle) - dy * Math.sin(angle)
            const ry = dx * Math.sin(angle) + dy * Math.cos(angle)
            const theta = Math.atan2(ry, rx)
            const radiusNoise =
              Math.sin(theta * lobeA + phaseA) * 0.16 +
              Math.sin(theta * lobeB + phaseB) * 0.1 +
              Math.sin(theta * lobeC + phaseC) * 0.06
            const coveNoise =
              (height[i * gridSize + j] - 0.5) * edgeNoise +
              (biome[i * gridSize + j] - 0.5) * coveScale +
              (noise(i * scale * 2.4 + c * 13.7, j * scale * 2.4 + c * 17.3) - 0.5) * coveDepth
            const radiusFactorX = Math.max(0.82, Math.min(1.24, 1 + radiusNoise))
            const radiusFactorY = Math.max(0.84, Math.min(1.22, 1 + radiusNoise * 0.85))
            const localRadiusX = baseRadius * stretchX * radiusFactorX
            const localRadiusY = baseRadius * stretchY * radiusFactorY
            const nx = rx / localRadiusX
            const ny = ry / localRadiusY
            const shapeDistance = Math.sqrt(nx * nx + ny * ny)
            const shorelineCut = Math.max(0, -coveNoise * 0.9)
            const shorelineBump = Math.max(0, coveNoise * 0.65)
            const normalized = Math.max(0, 1 - shapeDistance - shorelineCut + shorelineBump)
            const shaped = normalized * normalized * (3 - 2 * normalized)
            islandInfluence = Math.max(islandInfluence, shaped)
          }

          const shorelineNoise =
            (height[i * gridSize + j] - 0.5) * 0.18 +
            (biome[i * gridSize + j] - 0.5) * 0.1 +
            (noise(i * scale * 3.1 + 41, j * scale * 3.1 + 67) - 0.5) * 0.12
          const landScore = islandInfluence + shorelineNoise - 0.13
          terrainMap[i][j] = landScore > 0 ? 0 : 2
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
            if (terrainMap[i][j] === 2 && wn <= 1 && islandInfluenceAt(i, j, islandProfiles) > 0.18)
              terrainMap[i][j] = 0
          }
        }
      }

      const bt = { lo: 0.27, hi: 0.6 }
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

    function islandInfluenceAt(i, j, profiles) {
      let influence = 0
      for (let c = 0; c < profiles.length; c++) {
        const {
          center,
          stretchX,
          stretchY,
          angle,
          edgeNoise,
          baseRadius,
          lobeA,
          lobeB,
          lobeC,
          phaseA,
          phaseB,
          phaseC,
          coveDepth,
          coveScale,
        } = profiles[c]
        const dx = i - center.i
        const dy = j - center.j
        const rx = dx * Math.cos(angle) - dy * Math.sin(angle)
        const ry = dx * Math.sin(angle) + dy * Math.cos(angle)
        const theta = Math.atan2(ry, rx)
        const radiusNoise =
          Math.sin(theta * lobeA + phaseA) * 0.16 +
          Math.sin(theta * lobeB + phaseB) * 0.1 +
          Math.sin(theta * lobeC + phaseC) * 0.06
        const coveNoise =
          (height[i * gridSize + j] - 0.5) * edgeNoise +
          (biome[i * gridSize + j] - 0.5) * coveScale +
          (noise(i * scale * 2.4 + c * 13.7, j * scale * 2.4 + c * 17.3) - 0.5) * coveDepth
        const radiusFactorX = Math.max(0.82, Math.min(1.24, 1 + radiusNoise))
        const radiusFactorY = Math.max(0.84, Math.min(1.22, 1 + radiusNoise * 0.85))
        const localRadiusX = baseRadius * stretchX * radiusFactorX
        const localRadiusY = baseRadius * stretchY * radiusFactorY
        const nx = rx / localRadiusX
        const ny = ry / localRadiusY
        const shapeDistance = Math.sqrt(nx * nx + ny * ny)
        const shorelineCut = Math.max(0, -coveNoise * 0.9)
        const shorelineBump = Math.max(0, coveNoise * 0.65)
        const normalized = Math.max(0, 1 - shapeDistance - shorelineCut + shorelineBump)
        const shaped = normalized * normalized * (3 - 2 * normalized)
        influence = Math.max(influence, shaped)
      }
      return influence
    }
  }

  getIlotSpawnAnchors() {
    const size = this.map.size
    const offset = Math.max(18, Math.floor(size * 0.18))
    const anchors = [
      { i: offset, j: offset },
      { i: offset, j: size - offset },
      { i: size - offset, j: offset },
      { i: size - offset, j: size - offset },
    ]

    if (this.map.positionsCount > 4) {
      anchors.push({ i: Math.floor(size / 2), j: Math.floor(size / 2) })
    }

    return anchors
  }

  generateSets() {
    const hasSolidNeighbor = (i, j) => {
      for (let di = -1; di <= 1; di++) {
        for (let dj = -1; dj <= 1; dj++) {
          if (Math.abs(di) + Math.abs(dj) > 1) continue
          if (this.map.grid[i + di]?.[j + dj]?.solid) return true
        }
      }
      return false
    }

    const hasWaterNeighbor = (i, j) => {
      for (let di = -2; di <= 2; di++) {
        const maxDj = 2 - Math.abs(di)
        for (let dj = -maxDj; dj <= maxDj; dj++) {
          const neighbor = this.map.grid[i + di]?.[j + dj]
          if (neighbor?.category === 'Water' || neighbor?.waterBorder) return true
        }
      }
      return false
    }

    for (let i = 0; i <= this.map.size; i++) {
      for (let j = 0; j <= this.map.size; j++) {
        const cell = this.map.grid[i][j]
        if (hasSolidNeighbor(i, j)) continue
        if (!cell.has && !cell.solid && !cell.border && !cell.inclined) {
          const hasWaterNeighbour = hasWaterNeighbor(i, j)
          if (
            cell.category !== 'Water' &&
            !hasWaterNeighbour &&
            this.map.random() < 0.03 &&
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
            const randomSpritesheet = this.map.randomItem(floorSpritesheets)
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
            floor.zIndex = 1
            cell.addChild(floor)
          }
          if (!hasWaterNeighbour && this.map.random() < this.map.chanceOfSets) {
            if (cell.category !== 'Water') {
              const type = this.map.randomItem(['tree', 'rock', 'animal'])
              switch (type) {
                case 'rock': {
                  const randomSpritesheet = this.map.randomRange(531, 534).toString()
                  const spritesheet = Assets.cache.get(randomSpritesheet)
                  const texture = spritesheet.textures['000_' + randomSpritesheet + '.png']
                  const rock = Sprite.from(texture)
                  rock.label = LABEL_TYPES.set
                  rock.roundPixels = true
                  rock.allowMove = false
                  rock.eventMode = 'none'
                  rock.allowClick = false
                  rock.updateAnchor = true
                  rock.zIndex = 2
                  cell.addChild(rock)
                  break
                }
                case 'animal': {
                  if (cell.solid || cell.has || cell.border || cell.waterBorder || cell.inclined) {
                    break
                  }
                  const animalType = this.pickAmbientAnimalType(i, j)
                  this.map.gaia.createAnimal({ i, j, type: animalType })
                  break
                }
              }
            }
          }
          if (cell.category === 'Water' && this.map.random() < this.map.chanceOfSets) {
            const fishType = this.pickFishResourceType(i, j)
            this.map.resources.add(this.map.addChild(new Resource({ i, j, type: fishType }, this.map.context)))
          }
        }
      }
    }
  }

  findPlayerPlaces() {
    if (this.map.mapType === 'ilot') {
      const border = 12
      const searchHalf = Math.max(10, Math.floor(this.map.size * 0.08))
      return this.getIlotSpawnAnchors()
        .slice(0, this.map.positionsCount)
        .map(anchor =>
          getZoneInGridWithCondition(
            {
              minX: Math.max(border, anchor.i - searchHalf),
              maxX: Math.min(this.map.size - border, anchor.i + searchHalf),
              minY: Math.max(border, anchor.j - searchHalf),
              maxY: Math.min(this.map.size - border, anchor.j + searchHalf),
            },
            this.map.grid,
            6,
            cell => !cell.border && !cell.solid && !cell.inclined && cell.category !== 'Water'
          )
        )
        .filter(Boolean)
    }

    const results = []
    const N = this.map.positionsCount
    const center = this.map.size / 2
    const startAngle = this.map.random() * 2 * Math.PI
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
