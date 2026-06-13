import { Resource } from '../resource'
import { RESOURCE_TYPES } from '../../constants'

const SPACED_RESOURCE_TYPES = new Set([RESOURCE_TYPES.berrybush, RESOURCE_TYPES.gold, RESOURCE_TYPES.stone])

function hasSpacedResourceAround(grid, i, j, radius = 3) {
  const minI = Math.max(0, i - radius)
  const maxI = Math.min(grid.length - 1, i + radius)

  for (let ni = minI; ni <= maxI; ni++) {
    const row = grid[ni]
    const minJ = Math.max(0, j - radius)
    const maxJ = Math.min(row.length - 1, j + radius)
    for (let nj = minJ; nj <= maxJ; nj++) {
      if (SPACED_RESOURCE_TYPES.has(row[nj]?.has?.type)) return true
    }
  }
  return false
}

const RESOURCE_DENSITY_PROFILES = {
  low: {
    neutralGroups: { berrybush: 2, stone: 2, gold: 2, tree: 4 },
    minNeutralDistance: 28,
    playerSafeDistance: 34,
  },
  moderate: {
    neutralGroups: { berrybush: 4, stone: 4, gold: 4, tree: 7 },
    minNeutralDistance: 24,
    playerSafeDistance: 30,
  },
  high: {
    neutralGroups: { berrybush: 7, stone: 6, gold: 6, tree: 11 },
    minNeutralDistance: 20,
    playerSafeDistance: 26,
  },
}

export class MapResources {
  constructor(map) {
    this.map = map
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
    const { grid } = this.map
    const random = () => this.map.random()
    const { i: playerI, j: playerJ } = player
    const gridWidth = grid.length
    const gridHeight = grid[0].length
    let forestCells = []
    const pathCells = new Set()

    const rangeFactor = this.map.mapType === 'lac' ? 0.55 : 0.4
    const forestRange = Math.max(30, Math.floor(this.map.size * rangeFactor))

    function distSq(x1, y1, x2, y2) {
      return (x1 - x2) ** 2 + (y1 - y2) ** 2
    }
    const safeDistanceSq = safeDistance ** 2

    function createCircle(centerI, centerJ, radius, density = 0.7, edgeNoise = 0) {
      const circleCells = []
      for (let x = -radius; x <= radius; x++) {
        for (let y = -radius; y <= radius; y++) {
          const noise = random() * edgeNoise - edgeNoise / 2
          const effectiveRadius = radius - noise
          if (effectiveRadius > 0 && x * x + y * y <= effectiveRadius * effectiveRadius) {
            const cellI = centerI + x
            const cellJ = centerJ + y
            if (
              cellI >= 0 &&
              cellI < gridWidth &&
              cellJ >= 0 &&
              cellJ < gridHeight &&
              !grid[cellI][cellJ].solid &&
              grid[cellI][cellJ].category !== 'Water' &&
              grid[cellI][cellJ].type !== 'Border' &&
              !grid[cellI][cellJ].inclined &&
              random() < density
            ) {
              circleCells.push({ i: cellI, j: cellJ })
            }
          }
        }
      }
      return circleCells
    }

    for (let cluster = 0; cluster < clusterCount; cluster++) {
      let clusterCenterI, clusterCenterJ
      let tries = 0
      const clusterRadius = Math.floor(random() * (maxClusterRadius - minClusterRadius + 1)) + minClusterRadius
      const clusterDensity = random() * 0.5 + 0.5
      const edgeNoise = random() * 2

      do {
        clusterCenterI = playerI + Math.floor(random() * forestRange * 2 - forestRange)
        clusterCenterJ = playerJ + Math.floor(random() * forestRange * 2 - forestRange)
        tries++
        if (tries > 100) break
      } while (
        distSq(clusterCenterI, clusterCenterJ, playerI, playerJ) < safeDistanceSq ||
        clusterCenterI < 0 ||
        clusterCenterI >= gridWidth ||
        clusterCenterJ < 0 ||
        clusterCenterJ >= gridHeight ||
        grid[clusterCenterI][clusterCenterJ].category === 'Water' ||
        grid[clusterCenterI][clusterCenterJ].solid ||
        grid[clusterCenterI][clusterCenterJ].inclined
      )

      if (tries <= 100) {
        const treeCluster = createCircle(clusterCenterI, clusterCenterJ, clusterRadius, clusterDensity, edgeNoise)
        treeCluster.forEach(cell => forestCells.push(cell))
      }
    }

    const scatteredTreeCount = Math.floor(treeCount * 0.2)
    for (let i = 0; i < scatteredTreeCount; i++) {
      let soloI, soloJ
      let tries = 0

      do {
        soloI = playerI + Math.floor(random() * forestRange * 2 - forestRange)
        soloJ = playerJ + Math.floor(random() * forestRange * 2 - forestRange)
        tries++
        if (tries > 50) break
      } while (
        distSq(soloI, soloJ, playerI, playerJ) < safeDistanceSq ||
        soloI < 0 ||
        soloI >= gridWidth ||
        soloJ < 0 ||
        soloJ >= gridHeight ||
        grid[soloI][soloJ].category === 'Water' ||
        grid[soloI][soloJ].solid ||
        grid[soloI][soloJ].inclined
      )

      if (tries <= 50) {
        forestCells.push({ i: soloI, j: soloJ })
      }
    }

    for (let clearing = 0; clearing < clusterCount; clearing++) {
      if (random() < clearingProbability) {
        let clearingCenterI, clearingCenterJ
        let tries = 0
        const clearingRadius = Math.floor(random() * 8) + 5
        const edgeNoise = random() * 1.5

        do {
          clearingCenterI = playerI + Math.floor(random() * forestRange * 2 - forestRange)
          clearingCenterJ = playerJ + Math.floor(random() * forestRange * 2 - forestRange)
          tries++
          if (tries > 100) break
        } while (
          distSq(clearingCenterI, clearingCenterJ, playerI, playerJ) < safeDistanceSq ||
          clearingCenterI < 0 ||
          clearingCenterI >= gridWidth ||
          clearingCenterJ < 0 ||
          clearingCenterJ >= gridHeight ||
          grid[clearingCenterI][clearingCenterJ].category === 'Water' ||
          grid[clearingCenterI][clearingCenterJ].solid ||
          grid[clearingCenterI][clearingCenterJ].inclined
        )

        if (tries <= 100) {
          const clearingCells = createCircle(clearingCenterI, clearingCenterJ, clearingRadius, 0, edgeNoise)
          const clearingSet = new Set(clearingCells.map(c => `${c.i},${c.j}`))
          forestCells = forestCells.filter(c => !clearingSet.has(`${c.i},${c.j}`))
        }
      }
    }

    const pathLength = 20
    const pathDirection = random() > 0.5 ? 1 : -1

    for (let step = 0; step < pathLength; step++) {
      const offsetX = step * pathDirection
      const offsetY = step
      const ni = playerI + offsetX
      const nj = playerJ + offsetY
      if (
        ni >= 0 &&
        ni < gridWidth &&
        nj >= 0 &&
        nj < gridHeight &&
        distSq(ni, nj, playerI, playerJ) >= safeDistanceSq
      ) {
        const randOffsetX = random() > 0.5 ? 1 : -1
        const randOffsetY = random() > 0.5 ? 1 : -1
        pathCells.add(`${ni + randOffsetX},${nj + randOffsetY}`)
      }
    }

    for (let idx = forestCells.length - 1; idx >= 0; idx--) {
      if (pathCells.has(`${forestCells[idx].i},${forestCells[idx].j}`)) {
        forestCells.splice(idx, 1)
      }
    }

    const cellsToPlace = []
    for (let i = 0; i < treeCount; i++) {
      if (forestCells.length === 0) break
      const itemIndex = Math.floor(random() * forestCells.length)
      const cell = forestCells[itemIndex]
      cellsToPlace.push(cell)
      forestCells.splice(itemIndex, 1)
    }

    for (const cell of cellsToPlace) {
      if (
        grid[cell.i][cell.j].category !== 'Water' &&
        !grid[cell.i][cell.j].waterBorder &&
        !grid[cell.i][cell.j].solid &&
        !grid[cell.i][cell.j].inclined
      ) {
        !hasSpacedResourceAround(grid, cell.i, cell.j) &&
          this.map.resources.add(
            this.map.addChild(new Resource({ i: cell.i, j: cell.j, type: RESOURCE_TYPES.tree }, this.map.context))
          )
      }
    }
  }

  placeAnimalHerd(player, quantity, range) {
    const { grid } = this.map
    const randomDistance = this.map.randomRange(range[0], range[1])
    const centerI = player.i + this.map.randomItem([-randomDistance, randomDistance])
    const centerJ = player.j + this.map.randomItem([-randomDistance, randomDistance])

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
      const idx = Math.floor(this.map.random() * validCells.length)
      const cell = validCells.splice(idx, 1)[0]
      this.map.gaia.createAnimal({ i: cell.i, j: cell.j, type: 'Gazelle' })
    }
  }

  generateAnimalsAroundPlayers(playersPos) {
    for (let i = 0; i < playersPos.length; i++) {
      this.map.placeAnimalHerd(playersPos[i], 5, [8, 14])
      this.map.placeAnimalHerd(playersPos[i], 4, [16, 24])
    }
  }

  generateResourcesAroundPlayers(playersPos) {
    for (let i = 0; i < playersPos.length; i++) {
      this.map.placeResourceGroup(playersPos[i], RESOURCE_TYPES.berrybush, 8, [7, 14])
      this.map.placeResourceGroup(playersPos[i], RESOURCE_TYPES.berrybush, 8, [14, 22])
      this.map.placeResourceGroup(playersPos[i], RESOURCE_TYPES.berrybush, 8, [22, 29])
      this.map.placeResourceGroup(playersPos[i], RESOURCE_TYPES.stone, 7, [7, 14])
      this.map.placeResourceGroup(playersPos[i], RESOURCE_TYPES.stone, 7, [14, 22])
      this.map.placeResourceGroup(playersPos[i], RESOURCE_TYPES.stone, 7, [22, 29])
      this.map.placeResourceGroup(playersPos[i], RESOURCE_TYPES.gold, 7, [7, 14])
      this.map.placeResourceGroup(playersPos[i], RESOURCE_TYPES.gold, 7, [14, 22])
      this.map.placeResourceGroup(playersPos[i], RESOURCE_TYPES.gold, 7, [22, 29])
      this.map.generateForestAroundPlayer(playersPos[i], this.map.size * 4)
    }
  }

  generateNeutralResourceGroups(playersPos) {
    const profile = RESOURCE_DENSITY_PROFILES[this.map.resourceDensity] ?? RESOURCE_DENSITY_PROFILES.moderate
    const placedCenters = []
    const sizeScale = Math.max(1, Math.round((this.map.size / 120) ** 2))
    const groupEntries = [
      [RESOURCE_TYPES.berrybush, profile.neutralGroups.berrybush, 8, 2],
      [RESOURCE_TYPES.stone, profile.neutralGroups.stone, 7, 2],
      [RESOURCE_TYPES.gold, profile.neutralGroups.gold, 7, 2],
      [RESOURCE_TYPES.tree, profile.neutralGroups.tree, 14, 4],
    ]

    for (const [type, baseCount, quantity, radius] of groupEntries) {
      const targetCount = baseCount * sizeScale
      for (let i = 0; i < targetCount; i++) {
        const center = this.map.findNeutralResourceCenter(
          playersPos,
          placedCenters,
          profile.playerSafeDistance,
          profile.minNeutralDistance
        )
        if (!center) break
        if (this.map.placeResourceGroupAt(center, type, quantity, radius)) {
          placedCenters.push(center)
        }
      }
    }
  }

  findNeutralResourceCenter(playersPos, placedCenters, playerSafeDistance, minNeutralDistance) {
    const border = 10
    const playerSafeDistanceSq = playerSafeDistance ** 2
    const minNeutralDistanceSq = minNeutralDistance ** 2

    for (let attempt = 0; attempt < 300; attempt++) {
      const i = this.map.randomRange(border, this.map.size - border)
      const j = this.map.randomRange(border, this.map.size - border)
      const cell = this.map.grid[i]?.[j]
      if (!cell || cell.solid || cell.category === 'Water' || cell.has || cell.border || cell.inclined) continue

      const tooCloseToPlayer = playersPos.some(pos => (pos.i - i) ** 2 + (pos.j - j) ** 2 < playerSafeDistanceSq)
      if (tooCloseToPlayer) continue

      const tooCloseToGroup = placedCenters.some(pos => (pos.i - i) ** 2 + (pos.j - j) ** 2 < minNeutralDistanceSq)
      if (tooCloseToGroup) continue

      return { i, j }
    }

    return null
  }

  placeResourceGroup(player, instance, quantity, range) {
    const angle = this.map.random() * 2 * Math.PI
    const dist = range[0] + this.map.random() * (range[1] - range[0])
    const centerI = Math.round(player.i + Math.cos(angle) * dist)
    const centerJ = Math.round(player.j + Math.sin(angle) * dist)

    return this.map.placeResourceGroupAt({ i: centerI, j: centerJ }, instance, quantity)
  }

  placeResourceGroupAt(center, instance, quantity, clusterRadius = 2) {
    const { context, grid } = this.map

    function getValidCells(ci, cj, radius) {
      const cells = []
      for (let dx = -radius; dx <= radius; dx++) {
        for (let dy = -radius; dy <= radius; dy++) {
          const newI = ci + dx
          const newJ = cj + dy
          if (!grid[newI]?.[newJ]) continue
          const cell = grid[newI][newJ]
          if (
            !hasSpacedResourceAround(grid, cell.i, cell.j) &&
            !cell.solid &&
            cell.category !== 'Water' &&
            !cell.has &&
            !cell.border &&
            !cell.inclined
          ) {
            cells.push({ i: newI, j: newJ })
          }
        }
      }
      return cells
    }

    let validCells = getValidCells(center.i, center.j, clusterRadius)
    if (validCells.length < quantity) validCells = getValidCells(center.i, center.j, clusterRadius + 1)
    if (validCells.length < quantity) return false

    const cellsToPlace = []
    for (let i = 0; i < quantity; i++) {
      if (!validCells.length) break
      const idx = Math.floor(this.map.random() * validCells.length)
      cellsToPlace.push(validCells.splice(idx, 1)[0])
    }

    for (const cell of cellsToPlace) {
      this.map.resources.add(this.map.addChild(new Resource({ i: cell.i, j: cell.j, type: instance }, context)))
    }
    return true
  }
}
