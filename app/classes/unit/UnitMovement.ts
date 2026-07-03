import { ACTION_TYPES, BUILDING_TYPES, FAMILY_TYPES, SHEET_TYPES, UNIT_TYPES, WORK_TYPES } from '../../constants'
import {
  canUpdateMinimap,
  degreeToDirection,
  getCellsAroundPoint,
  findInstancesInSight,
  getClosestInstanceWithPath,
  getInstanceClosestFreeCellPath,
  getInstanceDegree,
  getInstancePath,
  getInstanceZIndex,
  instanceContactInstance,
  instancesDistance,
  moveTowardPoint,
  updateInstanceVisibility,
} from '../../lib'

type AnyRecord = Record<string, any>

function isBoatNavigationCell(cell: any) {
  return cell?.category === 'Water' || cell?.waterBorder
}

const POST_BUILD_GATHER_ACTIONS = {
  [BUILDING_TYPES.granary]: [ACTION_TYPES.forageberry],
  [BUILDING_TYPES.storagePit]: [ACTION_TYPES.chopwood, ACTION_TYPES.minestone, ACTION_TYPES.minegold],
  [BUILDING_TYPES.townCenter]: [
    ACTION_TYPES.chopwood,
    ACTION_TYPES.forageberry,
    ACTION_TYPES.minestone,
    ACTION_TYPES.minegold,
    ACTION_TYPES.farm,
    ACTION_TYPES.hunt,
    ACTION_TYPES.takemeat,
    ACTION_TYPES.fishing,
  ],
}

const GATHER_SEND_METHOD_BY_ACTION = {
  [ACTION_TYPES.chopwood]: 'sendToTree',
  [ACTION_TYPES.farm]: 'sendToFarm',
  [ACTION_TYPES.fishing]: 'sendToFish',
  [ACTION_TYPES.forageberry]: 'sendToBerrybush',
  [ACTION_TYPES.hunt]: 'sendToHunt',
  [ACTION_TYPES.minegold]: 'sendToGold',
  [ACTION_TYPES.minestone]: 'sendToStone',
  [ACTION_TYPES.takemeat]: 'sendToTakeMeat',
}

const BLOCKED_GATHER_APPROACH_ACTIONS = new Set([
  ACTION_TYPES.chopwood,
  ACTION_TYPES.farm,
  ACTION_TYPES.fishing,
  ACTION_TYPES.forageberry,
  ACTION_TYPES.hunt,
  ACTION_TYPES.minegold,
  ACTION_TYPES.minestone,
  ACTION_TYPES.takemeat,
])

const MAX_BLOCKED_GATHER_APPROACH_DISTANCE = 6

export class UnitMovement {
  unit: AnyRecord

  constructor(unit: AnyRecord) {
    this.unit = unit
  }

  sendToPostBuildResource() {
    const unit = this.unit
    const actions = POST_BUILD_GATHER_ACTIONS[unit.dest?.type]
    if (!actions || !unit.dest?.isBuilt || unit.dest.isDead || unit.dest.isDestroyed) return false

    const targets = findInstancesInSight(unit as any, (instance: any) =>
      actions.some((action: any) => unit.getActionCondition(instance, action))
    )
    if (!targets.length) return false

    const target = getClosestInstanceWithPath(unit as any, targets)
    if (!target) return false

    const action = actions.find((candidate: any) => unit.getActionCondition(target.instance, candidate))
    const sendMethod = GATHER_SEND_METHOD_BY_ACTION[action as keyof typeof GATHER_SEND_METHOD_BY_ACTION]
    if (!sendMethod || typeof unit[sendMethod] !== 'function') return false

    unit[sendMethod](target.instance, true)
    return true
  }

  findClosestReachableCellNearTarget(target: any, minDistance = 2, allowCurrentCell = false) {
    const unit = this.unit
    const {
      context: { map },
    } = unit
    const maxDistance = Math.max(
      2,
      Math.min(unit.sight || MAX_BLOCKED_GATHER_APPROACH_DISTANCE, MAX_BLOCKED_GATHER_APPROACH_DISTANCE)
    )
    let best = null

    for (let distance = minDistance; distance <= maxDistance; distance++) {
      const cells = getCellsAroundPoint(target.i, target.j, map.grid, distance, (cell: any): boolean => {
        if (cell.solid || cell.border) return false
        if (unit.category === 'Boat') return cell.category === 'Water' || cell.waterBorder
        return cell.category !== 'Water'
      })
      cells.sort(
        (a, b) =>
          Math.abs(a.i - target.i) + Math.abs(a.j - target.j) - (Math.abs(b.i - target.i) + Math.abs(b.j - target.j)) ||
          Math.abs(a.i - unit.i) + Math.abs(a.j - unit.j) - (Math.abs(b.i - unit.i) + Math.abs(b.j - unit.j))
      )

      for (const cell of cells) {
        if (allowCurrentCell && unit.i === cell.i && unit.j === cell.j) return { cell, path: [] }
        const path = getInstancePath(unit as any, cell.i, cell.j, map)
        if (path.length && (!best || path.length < best.path.length)) {
          best = { cell, path }
        }
      }
      if (best) return best
    }

    return null
  }

  approachBlockedGatherTarget(dest: any, action: any) {
    const unit = this.unit
    if (unit.type !== UNIT_TYPES.villager || !BLOCKED_GATHER_APPROACH_ACTIONS.has(action)) return false
    if (!dest || dest.isDestroyed || !unit.getActionCondition(dest, action)) return false
    if (unit.blockedGatherApproach?.target === dest && unit.blockedGatherApproach.action === action) return false

    const approach = this.findClosestReachableCellNearTarget(dest)
    if (!approach) return false

    unit.setDest(dest)
    unit.action = action
    unit.blockedGatherApproach = { target: dest, action }
    unit.setPath(approach.path)
    return true
  }

  retryBlockedGatherApproach() {
    const unit = this.unit
    const blockedGatherApproach = unit.blockedGatherApproach
    if (!blockedGatherApproach) return false

    unit.blockedGatherApproach = null
    const { target, action } = blockedGatherApproach
    if (!target || target.isDestroyed || !unit.getActionCondition(target, action)) {
      unit.affectNewDest()
      return true
    }

    unit.sendToEvt(target, action, { forceRepath: true, allowBlockedGatherApproach: false })
    return true
  }

  sendToEvt(dest: any, action: any, { forceRepath = false, allowBlockedGatherApproach = true }: AnyRecord = {}) {
    const startedAt = performance.now()
    if (forceRepath) this.unit.context.performance?.record('unit.repath', 0)
    try {
      return this._sendToEvt(dest, action, { forceRepath, allowBlockedGatherApproach })
    } finally {
      this.unit.context.performance?.record('unit.command', performance.now() - startedAt)
    }
  }

  _sendToEvt(dest: any, action: any, { forceRepath = false, allowBlockedGatherApproach = true }: AnyRecord = {}) {
    const unit = this.unit
    const {
      context: { map },
    } = unit
    if (unit.actionLocked) {
      return unit.queueOrder(dest, action)
    }
    if (
      !forceRepath &&
      dest &&
      unit.dest?.label === dest.label &&
      unit.action === action &&
      (unit.path.length > 0 || unit.isUnitAtDest(action, dest))
    ) {
      return
    }
    unit.handleChangeDest()
    unit.stopInterval()
    unit.blockedGatherApproach = null
    let path = []
    if (!dest || dest.isDestroyed || unit.isDead) return
    if (!action) {
      unit.previousDest = null
      unit.previousWork = null
    }
    if (
      unit.isUnitAtDest(action, dest) &&
      (!map.grid[unit.i][unit.j].solid ||
        (map.grid[unit.i][unit.j].solid && map.grid[unit.i][unit.j].has?.label === unit.label))
    ) {
      unit.setDest(dest)
      unit.action = action
      unit.degree = getInstanceDegree(unit as any, dest.x, dest.y)
      unit.getAction(action)
      return
    }
    if (map.grid[dest.i] && map.grid[dest.i][dest.j]) {
      const allowWaterCellCategory = unit.category === 'Boat'
      const destCell = map.grid[dest.i][dest.j]
      if (destCell.solid) {
        path = getInstanceClosestFreeCellPath(unit as any, dest, map)
        if (!path.length && unit.work) {
          unit.action = action
          if (allowBlockedGatherApproach && this.approachBlockedGatherTarget(dest, action)) return
          if (action === ACTION_TYPES.delivery) {
            unit.stop()
          } else {
            unit.affectNewDest()
          }
          return
        }
      } else if (!allowWaterCellCategory && destCell.category === 'Water') {
        const approach = this.findClosestReachableCellNearTarget(dest, 1, true)
        if (!approach) {
          unit.action = action
          if (allowBlockedGatherApproach && this.approachBlockedGatherTarget(dest, action)) return
          action ? unit.affectNewDest() : unit.stop()
          return
        }
        if (!action) {
          unit.sendToEvt(approach.cell)
          return
        }
        unit.setDest(dest)
        unit.action = action
        if (approach.path.length) {
          unit.setPath(approach.path)
        } else {
          unit.degree = getInstanceDegree(unit as any, dest.x, dest.y)
          unit.getAction(action)
        }
        return
      }
    }
    if (!path.length) {
      path = getInstancePath(unit as any, dest.i, dest.j, map)
    }
    if (path.length) {
      unit.setDest(dest)
      unit.action = action
      unit.setPath(path)
    } else {
      unit.action = action
      if (allowBlockedGatherApproach && this.approachBlockedGatherTarget(dest, action)) return
      if (action === ACTION_TYPES.delivery) {
        unit.stop()
      } else {
        unit.affectNewDest()
      }
    }
  }

  isUnitAtDest(action: any, dest: any) {
    const unit = this.unit
    if (!action || !dest) return false
    const effectiveRange =
      unit.type === UNIT_TYPES.villager && action === ACTION_TYPES.hunt ? unit.huntRange || 4 : unit.range
    if (
      (unit.type !== UNIT_TYPES.villager || action === ACTION_TYPES.hunt) &&
      effectiveRange &&
      instancesDistance(unit as any, dest) <= effectiveRange
    ) {
      return true
    }
    return instanceContactInstance(unit as any, dest)
  }

  destHasMoved() {
    const unit = this.unit
    return (
      (unit.dest.i !== unit.realDest.i || unit.dest.j !== unit.realDest.j) &&
      instancesDistance(unit as any, unit.dest) <= unit.sight
    )
  }

  moveToPath() {
    const performanceMonitor = this.unit.context.performance
    if (performanceMonitor) return performanceMonitor.measureSampled('unit.move', () => this._moveToPath())
    return this._moveToPath()
  }

  _moveToPath() {
    const unit = this.unit
    const {
      context: { map },
    } = unit
    const next = unit.path[unit.path.length - 1]
    const nextCell = map.grid[next.i][next.j]
    if (!unit.dest || unit.dest.isDestroyed) {
      unit.affectNewDest()
      return
    }
    if (
      nextCell.has &&
      nextCell.has.family === FAMILY_TYPES.unit &&
      nextCell.has.label !== unit.label &&
      nextCell.has.hasPath() &&
      instancesDistance(unit as any, nextCell.has) <= 1 &&
      nextCell.has.sprite.playing
    ) {
      unit.sprite.stop()
      return
    }
    if (nextCell.solid && unit.dest) {
      unit.context.performance?.record('unit.blockedPath', 0)
      unit.sendToEvt(unit.dest, unit.action, { forceRepath: true })
      return
    }
    if (!unit.sprite.playing) {
      unit.sprite.play()
    }
    if (instancesDistance(unit as any, nextCell, false) <= unit.speed) {
      const oldI = unit.i,
        oldJ = unit.j
      unit.z = nextCell.z
      unit.i = nextCell.i
      unit.j = nextCell.j
      unit.zIndex = getInstanceZIndex(unit as any)
      if (unit.currentCell.has === unit) {
        unit.currentCell.has = null
        unit.currentCell.solid = false
      }
      unit.currentCell = map.grid[unit.i][unit.j]
      if (unit.currentCell.has === null) {
        unit.currentCell.place(unit)
        unit.currentCell.solid = true
      }
      map.updateInstanceBucket(unit, oldI, oldJ)
      updateInstanceVisibility(unit as any)
      if (unit.transportCapacity && unit.owner.isPlayed && unit.owner.selectedUnit === unit) {
        unit.context.menu.setBottombar(unit)
      }
      unit.path.pop()
      if (unit.destHasMoved()) {
        unit.sendToEvt(unit.dest, unit.action, { forceRepath: true })
        return
      }
      if (unit.isUnitAtDest(unit.action, unit.dest)) {
        unit.path = []
        unit.stopInterval()
        unit.degree = getInstanceDegree(unit as any, unit.dest.x, unit.dest.y)
        unit.getAction(unit.action)
        return
      }
      if (!unit.path.length) {
        if (this.retryBlockedGatherApproach()) return
        unit.affectNewDest()
      }
    } else {
      const {
        context: { menu, player },
      } = unit
      const oldDeg = unit.degree
      let speed = unit.speed
      if (unit.loading > 0) speed *= 0.8
      moveTowardPoint(unit as any, nextCell.x, nextCell.y, speed)
      canUpdateMinimap(unit as any, player) && menu.updatePlayerMiniMap(unit.owner)
      if (degreeToDirection(oldDeg) !== degreeToDirection(unit.degree)) {
        unit.setTextures(SHEET_TYPES.walking)
      }
    }
  }

  affectNewDest() {
    const unit = this.unit
    unit.stopInterval()
    if (!unit.action) {
      unit.stop()
      return
    }
    const queuedBuildInterrupted =
      unit.work === WORK_TYPES.builder && unit.action === ACTION_TYPES.build && unit.buildQueue?.length
    if (queuedBuildInterrupted) {
      if (unit.dest && unit.getActionCondition(unit.dest, ACTION_TYPES.build)) {
        unit.buildQueue.push(unit.buildQueue.shift())
      }
      unit.stop()
      unit.context.scheduler.addOneShot(
        () => {
          if (unit.inactif && unit.buildQueue?.length) unit.continueBuildingQueue()
        },
        500,
        'unit.resumeBuildQueue'
      )
      return
    }

    const lostBuildTarget =
      unit.work === WORK_TYPES.builder &&
      unit.action === ACTION_TYPES.build &&
      (!unit.dest || !unit.getActionCondition(unit.dest, ACTION_TYPES.build))

    if (lostBuildTarget) {
      if (unit.previousDest || unit.previousWork) {
        unit.goBackToPrevious()
        return
      }

      if (this.sendToPostBuildResource()) return

      const targets = findInstancesInSight(unit as any, (instance: any) => unit.getActionCondition(instance, ACTION_TYPES.build))
      if (targets.length) {
        const target = getClosestInstanceWithPath(unit as any, targets)
        if (target) {
          unit.setDest(target.instance)
          unit.setPath(target.path)
          return
        }
      }

      unit.stop()
      unit.work = null
      return
    }

    if (unit.action === ACTION_TYPES.loadTransport) {
      if (!unit.dest || !unit.getActionCondition(unit.dest, ACTION_TYPES.loadTransport)) {
        unit.stop()
        return
      }
      const expectedCoastCell = unit.transportLoadCoastCell
      unit.setTextures(SHEET_TYPES.standing)
      unit.startInterval(
        () => {
          if (!unit.dest || !unit.getActionCondition(unit.dest, ACTION_TYPES.loadTransport)) {
            unit.stop()
            return
          }
          if (unit.isUnitAtDest(ACTION_TYPES.loadTransport, unit.dest)) {
            unit.getAction(ACTION_TYPES.loadTransport)
            return
          }
          if (
            expectedCoastCell &&
            unit.dest.dest &&
            (unit.dest.dest.i !== expectedCoastCell.i || unit.dest.dest.j !== expectedCoastCell.j)
          ) {
            unit.stop()
            return
          }
          const transportAtExpectedCoast =
            expectedCoastCell && unit.dest.i === expectedCoastCell.i && unit.dest.j === expectedCoastCell.j
          if (expectedCoastCell && !transportAtExpectedCoast && !unit.dest.dest && !unit.dest.path?.length) {
            unit.stop()
          }
        },
        250,
        true,
        'unit.waitTransport'
      )
      return
    }

    if (unit.previousDest && unit.action !== ACTION_TYPES.delivery) {
      unit.goBackToPrevious()
      return
    }
    let handleSuccess = false
    if (
      unit.type === UNIT_TYPES.villager &&
      (unit.action === ACTION_TYPES.takemeat || unit.action === ACTION_TYPES.hunt)
    ) {
      handleSuccess = unit.handleAffectNewDestHunter()
    } else if (!unit.dest || unit.dest.family !== FAMILY_TYPES.animal) {
      const targets = findInstancesInSight(unit as any, (instance: any) => unit.getActionCondition(instance))
      if (targets.length) {
        const target = getClosestInstanceWithPath(unit as any, targets)
        if (target) {
          unit.setDest(target.instance)
          if (instanceContactInstance(unit as any, target.instance)) {
            unit.degree = getInstanceDegree(unit as any, target.instance.x, target.instance.y)
            unit.getAction(unit.action)
            return
          }
          unit.setPath(target.path)
          return
        }
      }
    }
    if (!handleSuccess) {
      const notDeliveryWork = [WORK_TYPES.builder, WORK_TYPES.attacker, WORK_TYPES.healer]
      if (unit.loading && unit.work === WORK_TYPES.builder && unit.previousWork) {
        unit.goBackToPrevious()
      } else if (unit.loading && !notDeliveryWork.includes(unit.work)) {
        unit.sendToDelivery()
      } else {
        unit.stop()
      }
    }
  }

  explore() {
    const unit = this.unit
    const {
      context: { map },
    } = unit
    const { grid } = map
    const views = unit.owner.views
    const candidates = []

    for (let r = 1; r <= 50; r++) {
      for (let dx = -r; dx <= r; dx++) {
        const x = unit.i + dx
        const row = grid[x]
        if (!row) continue
        const dyMax = r - Math.abs(dx)
        for (const dy of dyMax === 0 ? [0] : [-dyMax, dyMax]) {
          const cell = row[unit.j + dy]
          if (cell && !views.isViewed(cell.i, cell.j) && !cell.solid) {
            let unseenNeighbors = 0
            for (let ni = cell.i - 1; ni <= cell.i + 1; ni++) {
              for (let nj = cell.j - 1; nj <= cell.j + 1; nj++) {
                const neighbor = grid[ni]?.[nj]
                if (neighbor && !views.isViewed(ni, nj) && !neighbor.solid) unseenNeighbors++
              }
            }
            const score = unseenNeighbors * 3 - r
            candidates.push({ cell, score, dist: r })
          }
        }
      }
    }

    candidates.sort((a, b) => b.score - a.score || a.dist - b.dist)

    for (const { cell } of candidates.slice(0, 12)) {
      const path = getInstancePath(unit as any, cell.i, cell.j, map)
      if (path.length) {
        unit.sendTo(cell)
        return true
      }
    }

    unit.stop()
    return false
  }

  runaway(instance: any) {
    const unit = this.unit
    const {
      context: { map },
    } = unit
    const di = unit.i - instance.i
    const dj = unit.j - instance.j
    const len = Math.sqrt(di * di + dj * dj) || 1
    for (let dist = unit.sight; dist >= 1; dist--) {
      const ti = Math.round(unit.i + (di / len) * dist)
      const tj = Math.round(unit.j + (dj / len) * dist)
      if (ti >= 0 && ti < map.grid.length && tj >= 0 && tj < (map.grid[ti]?.length ?? 0)) {
        const cell = map.grid[ti][tj]
        const categoryAllowed = unit.category === 'Boat' ? isBoatNavigationCell(cell) : cell.category !== 'Water'
        if (categoryAllowed && !cell.solid && !cell.border) {
          unit.sendTo(cell)
          return
        }
      }
    }
    unit.stop()
  }
}
