import { ACTION_TYPES, FAMILY_TYPES, SHEET_TYPES, UNIT_TYPES, WORK_TYPES } from '../../constants'
import {
  canUpdateMinimap,
  degreeToDirection,
  findInstancesInSight,
  getClosestInstanceWithPath,
  getFreeCellAroundPoint,
  getInstanceClosestFreeCellPath,
  getInstanceDegree,
  getInstancePath,
  getInstanceZIndex,
  instanceContactInstance,
  instancesDistance,
  moveTowardPoint,
  updateInstanceVisibility,
} from '../../lib'

export class UnitMovement {
  constructor(unit) {
    this.unit = unit
  }

  sendToEvt(dest, action) {
    const unit = this.unit
    const {
      context: { map },
    } = unit
    unit.handleChangeDest()
    unit.stopInterval()
    let path = []
    if (!dest || dest.isDestroyed || unit.isDead) return
    if (
      unit.isUnitAtDest(action, dest) &&
      (!map.grid[unit.i][unit.j].solid ||
        (map.grid[unit.i][unit.j].solid && map.grid[unit.i][unit.j].has?.label === unit.label))
    ) {
      unit.setDest(dest)
      unit.action = action
      unit.degree = getInstanceDegree(unit, dest.x, dest.y)
      unit.getAction(action)
      return
    }
    if (map.grid[dest.i] && map.grid[dest.i][dest.j]) {
      const allowWaterCellCategory = unit.category === 'Boat'
      if (map.grid[dest.i][dest.j].solid) {
        path = getInstanceClosestFreeCellPath(unit, dest, map)
        if (!path.length && unit.work) {
          unit.action = action
          if (action === ACTION_TYPES.delivery) {
            unit.stop()
          } else {
            unit.affectNewDest()
          }
          return
        }
      } else if (!allowWaterCellCategory && dest.category === 'Water') {
        const cell = getFreeCellAroundPoint(
          dest.i,
          dest.j,
          1,
          map.grid,
          cell => cell.category !== 'Water' && !cell.solid
        )
        unit.sendToEvt(cell)
        return
      }
    }
    if (!path.length) {
      path = getInstancePath(unit, dest.i, dest.j, map)
    }
    if (path.length) {
      unit.setDest(dest)
      unit.action = action
      unit.setPath(path)
    } else {
      unit.action = action
      if (action === ACTION_TYPES.delivery) {
        unit.stop()
      } else {
        unit.affectNewDest()
      }
    }
  }

  isUnitAtDest(action, dest) {
    const unit = this.unit
    if (!action) return false
    if (!dest) {
      unit.affectNewDest()
      return false
    }
    if (
      (unit.type !== UNIT_TYPES.villager || action === ACTION_TYPES.hunt) &&
      unit.range &&
      instancesDistance(unit, dest) <= unit.range
    ) {
      return true
    }
    return instanceContactInstance(unit, dest)
  }

  destHasMoved() {
    const unit = this.unit
    return (
      (unit.dest.i !== unit.realDest.i || unit.dest.j !== unit.realDest.j) &&
      instancesDistance(unit, unit.dest) <= unit.sight
    )
  }

  moveToPath() {
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
      instancesDistance(unit, nextCell.has) <= 1 &&
      nextCell.has.sprite.playing
    ) {
      unit.sprite.stop()
      return
    }
    if (nextCell.solid && unit.dest) {
      unit.sendTo(unit.dest, unit.action)
      return
    }
    if (!unit.sprite.playing) {
      unit.sprite.play()
    }
    if (instancesDistance(unit, nextCell, false) <= unit.speed) {
      const oldI = unit.i,
        oldJ = unit.j
      unit.z = nextCell.z
      unit.i = nextCell.i
      unit.j = nextCell.j
      unit.zIndex = getInstanceZIndex(unit)
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
      updateInstanceVisibility(unit)
      unit.path.pop()
      if (unit.destHasMoved()) {
        unit.sendTo(unit.dest, unit.action)
        return
      }
      if (unit.isUnitAtDest(unit.action, unit.dest)) {
        unit.path = []
        unit.stopInterval()
        unit.degree = getInstanceDegree(unit, unit.dest.x, unit.dest.y)
        unit.getAction(unit.action)
        return
      }
      if (!unit.path.length) {
        unit.affectNewDest()
      }
    } else {
      const {
        context: { menu, player },
      } = unit
      const oldDeg = unit.degree
      let speed = unit.speed
      if (unit.loading > 0) speed *= 0.8
      moveTowardPoint(unit, nextCell.x, nextCell.y, speed)
      canUpdateMinimap(unit, player) && menu.updatePlayerMiniMap(unit.owner)
      if (degreeToDirection(oldDeg) !== degreeToDirection(unit.degree)) {
        unit.setTextures(SHEET_TYPES.walking)
      }
    }
  }

  affectNewDest() {
    const unit = this.unit
    unit.stopInterval()
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
      const targets = findInstancesInSight(unit, instance => unit.getActionCondition(instance))
      if (targets.length) {
        const target = getClosestInstanceWithPath(unit, targets)
        if (target) {
          if (instanceContactInstance(unit, target)) {
            unit.degree = getInstanceDegree(unit, target.x, target.y)
            unit.getAction(unit.action)
            return
          }
          unit.setDest(target.instance)
          unit.setPath(target.path)
          return
        }
      }
    }
    if (!handleSuccess) {
      const notDeliveryWork = [WORK_TYPES.builder, WORK_TYPES.attacker, WORK_TYPES.healer]
      if (unit.loading && !notDeliveryWork.includes(unit.work)) {
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
          if (cell && !views[cell.i][cell.j].viewed && !cell.solid) {
            let unseenNeighbors = 0
            for (let ni = cell.i - 1; ni <= cell.i + 1; ni++) {
              for (let nj = cell.j - 1; nj <= cell.j + 1; nj++) {
                const neighbor = grid[ni]?.[nj]
                if (neighbor && !views[ni][nj].viewed && !neighbor.solid) unseenNeighbors++
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
      const path = getInstancePath(unit, cell.i, cell.j, map)
      if (path.length) {
        unit.sendTo(views[cell.i][cell.j])
        return true
      }
    }

    unit.stop()
    return false
  }

  runaway(instance) {
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
        if (!cell.solid && !cell.border) {
          unit.sendTo(unit.owner.views[ti][tj])
          return
        }
      }
    }
    unit.stop()
  }
}
