import { pointInRectangle, pointIsBetweenTwoPoint } from '../lib'
import { CELL_HEIGHT, CELL_WIDTH } from '../constants'
import { getCameraZoom } from '../lib/settings'

export class CameraController {
  constructor(context) {
    this.context = context
    this.camera = {
      x: 0,
      y: 0,
    }
    this.visibleCells = new Set()
    this.mouseMoveState = null
    this._rafPending = false
  }

  getCameraDiamondBounds() {
    const { map } = this.context
    return {
      A: { x: CELL_WIDTH / 2 - this.camera.x, y: -this.camera.y },
      B: {
        x: CELL_WIDTH / 2 - (map.size * CELL_WIDTH) / 2 - this.camera.x,
        y: (map.size * CELL_HEIGHT) / 2 - this.camera.y,
      },
      D: {
        x: CELL_WIDTH / 2 + (map.size * CELL_WIDTH) / 2 - this.camera.x,
        y: (map.size * CELL_HEIGHT) / 2 - this.camera.y,
      },
      C: { x: CELL_WIDTH / 2 - this.camera.x, y: map.size * CELL_HEIGHT - this.camera.y },
    }
  }

  scheduleVisibleCellsUpdate() {
    if (this._rafPending) return
    this._rafPending = true
    requestAnimationFrame(() => {
      this._rafPending = false
      this.updateVisibleCells()
    })
  }

  getViewportRect() {
    const {
      context: { app },
    } = this
    const zoom = getCameraZoom()
    const offsetX = (app.screen.width * (1 - zoom)) / 2
    const offsetY = (app.screen.height * (1 - zoom)) / 2

    return {
      zoom,
      offsetX,
      offsetY,
      visibleLeft: this.camera.x - offsetX / zoom,
      visibleTop: this.camera.y - offsetY / zoom,
      visibleWidth: app.screen.width / zoom,
      visibleHeight: app.screen.height / zoom,
    }
  }

  clampWorldPointToMap(x, y) {
    const { map } = this.context
    const gridX = (x / (CELL_WIDTH / 2) + y / (CELL_HEIGHT / 2)) / 2
    const gridY = (y / (CELL_HEIGHT / 2) - x / (CELL_WIDTH / 2)) / 2
    const clampedX = Math.min(Math.max(gridX, 0), map.size)
    const clampedY = Math.min(Math.max(gridY, 0), map.size)
    return {
      x: ((clampedX - clampedY) * CELL_WIDTH) / 2,
      y: ((clampedX + clampedY) * CELL_HEIGHT) / 2,
    }
  }

  clampCameraToMap() {
    const {
      context: { app },
    } = this
    const center = this.clampWorldPointToMap(
      this.camera.x + app.screen.width / 2,
      this.camera.y + app.screen.height / 2
    )
    this.camera.x = center.x - app.screen.width / 2
    this.camera.y = center.y - app.screen.height / 2
  }

  move(dir, moveSpeed, isSpeedDivided, deltaScale = 1) {
    /**
     *  /A\
     * /   \
     *B     D
     * \   /
     *  \C/
     */

    const {
      context: { map, app, menu },
    } = this

    const dividedSpeed = isSpeedDivided ? 1.5 : 1
    const speed = ((moveSpeed || 20) / dividedSpeed) * deltaScale
    const { A, B, C, D } = this.getCameraDiamondBounds()
    const cameraCenter = {
      x: app.screen.width / 2,
      y: app.screen.height / 2,
    }
    const prevX = this.camera.x
    const prevY = this.camera.y

    if (dir === 'left') {
      if (cameraCenter.x - 100 > B.x && pointIsBetweenTwoPoint(A, B, cameraCenter, 50)) {
        this.camera.y += speed / (CELL_WIDTH / CELL_HEIGHT)
        this.camera.x -= speed
      } else if (cameraCenter.x - 100 > B.x && pointIsBetweenTwoPoint(B, C, cameraCenter, 50)) {
        this.camera.y -= speed / (CELL_WIDTH / CELL_HEIGHT)
        this.camera.x -= speed
      } else if (cameraCenter.x - 100 > B.x) {
        this.camera.x -= speed
      }
    } else if (dir === 'right') {
      if (cameraCenter.x + 100 < D.x && pointIsBetweenTwoPoint(A, D, cameraCenter, 50)) {
        this.camera.y += speed / (CELL_WIDTH / CELL_HEIGHT)
        this.camera.x += speed
      } else if (cameraCenter.x + 100 < D.x && pointIsBetweenTwoPoint(D, C, cameraCenter, 50)) {
        this.camera.y -= speed / (CELL_WIDTH / CELL_HEIGHT)
        this.camera.x += speed
      } else if (cameraCenter.x + 100 < D.x) {
        this.camera.x += speed
      }
    }
    if (dir === 'up') {
      if (cameraCenter.y - 50 > A.y && pointIsBetweenTwoPoint(A, B, cameraCenter, 50)) {
        this.camera.y -= speed / (CELL_WIDTH / CELL_HEIGHT)
        this.camera.x += speed
      } else if (cameraCenter.y - 50 > A.y && pointIsBetweenTwoPoint(A, D, cameraCenter, 50)) {
        this.camera.y -= speed / (CELL_WIDTH / CELL_HEIGHT)
        this.camera.x -= speed
      } else if (cameraCenter.y - 50 > A.y) {
        this.camera.y -= speed
      }
    } else if (dir === 'down') {
      if (cameraCenter.y + 50 < C.y && pointIsBetweenTwoPoint(D, C, cameraCenter, 50)) {
        this.camera.y += speed / (CELL_WIDTH / CELL_HEIGHT)
        this.camera.x -= speed
      } else if (cameraCenter.y + 50 < C.y && pointIsBetweenTwoPoint(B, C, cameraCenter, 50)) {
        this.camera.y += speed / (CELL_WIDTH / CELL_HEIGHT)
        this.camera.x += speed
      } else if (cameraCenter.y + 100 < C.y) {
        this.camera.y += speed
      }
    }

    if (this.camera.x === prevX && this.camera.y === prevY) return

    this.clampCameraToMap()
    menu.updateCameraMiniMap()
    map.setCoordinate(-this.camera.x, -this.camera.y)
    this.scheduleVisibleCellsUpdate()
  }

  moveWithMouse(evt) {
    const dir = []
    const mouse = {
      x: evt.pageX,
      y: evt.pageY,
    }
    const coef = 1
    const moveDist = 10

    const calcs = {
      left: (0 + moveDist - mouse.x) * coef,
      right: (mouse.x - (window.innerWidth - moveDist)) * coef,
      up: (0 + moveDist - mouse.y) * coef,
      down: (mouse.y - (window.innerHeight - moveDist)) * coef,
    }
    if (mouse.x >= 0 && mouse.x <= 0 + moveDist && mouse.y >= 0 && mouse.y <= window.innerHeight) {
      dir.push('left')
    } else if (
      mouse.x > window.innerWidth - moveDist &&
      mouse.x <= window.innerWidth &&
      mouse.y >= 0 &&
      mouse.y <= window.innerHeight
    ) {
      dir.push('right')
    }
    if (mouse.x >= 0 && mouse.x <= window.innerWidth && mouse.y >= 0 && mouse.y <= 0 + moveDist) {
      dir.push('up')
    } else if (
      mouse.x >= 0 &&
      mouse.x <= window.innerWidth &&
      mouse.y > window.innerHeight - moveDist &&
      mouse.y <= window.innerHeight
    ) {
      dir.push('down')
    }
    this.mouseMoveState = dir.length ? { dir, calcs } : null
  }

  stopMouseMove() {
    this.mouseMoveState = null
  }

  updateMouseMove(deltaScale = 1) {
    if (!this.mouseMoveState) return
    this.mouseMoveState.dir.forEach(dir => {
      this.move(dir, this.mouseMoveState.calcs[dir], false, deltaScale)
    })
  }

  instanceInCamera(instance) {
    const { visibleLeft, visibleTop, visibleWidth, visibleHeight } = this.getViewportRect()
    return pointInRectangle(instance.x, instance.y, visibleLeft, visibleTop, visibleWidth, visibleHeight)
  }

  getCellOnCamera(callback) {
    const {
      context: { map },
    } = this

    const { visibleLeft, visibleTop, visibleWidth, visibleHeight } = this.getViewportRect()
    const cameraFloor = {
      x: Math.floor(visibleLeft),
      y: Math.floor(visibleTop),
    }
    const margin = CELL_WIDTH

    const stepX = CELL_WIDTH / 2
    const stepY = CELL_HEIGHT / 2
    const invCW = 1 / CELL_WIDTH
    const invCH = 1 / CELL_HEIGHT
    for (let i = cameraFloor.x - margin; i <= cameraFloor.x + visibleWidth + margin; i += stepX) {
      for (let j = cameraFloor.y - margin; j <= cameraFloor.y + visibleHeight + margin; j += stepY) {
        const x = Math.min(Math.max(Math.round(i * invCW + j * invCH), 0), map.size)
        const y = Math.min(Math.max(Math.round(j * invCH - i * invCW), 0), map.size)
        if (map.grid[x]?.[y]) callback(map.grid[x][y])
      }
    }
  }

  updateVisibleCells() {
    const startedAt = performance.now()
    const { map, player } = this.context
    try {
      if (!map?.grid?.length) return
      const viewport = this.getViewportRect()
      map.updateRenderChunks?.(viewport)
      if (!player?.views) return
      const newVisible = this._nextVisibleCells ?? new Set()
      newVisible.clear()
      const margin = CELL_WIDTH
      const { visibleLeft, visibleTop, visibleWidth, visibleHeight } = viewport

      const startX = Math.floor(visibleLeft - margin)
      const endX = Math.floor(visibleLeft + visibleWidth + margin)
      const startY = Math.floor(visibleTop - margin)
      const endY = Math.floor(visibleTop + visibleHeight + margin)

      const stepX = CELL_WIDTH / 2
      const stepY = CELL_HEIGHT / 2
      const invCW = 1 / CELL_WIDTH
      const invCH = 1 / CELL_HEIGHT
      for (let i = startX; i <= endX; i += stepX) {
        for (let j = startY; j <= endY; j += stepY) {
          const x = Math.min(Math.max(Math.round(i * invCW + j * invCH), 0), map.size)
          const y = Math.min(Math.max(Math.round(j * invCH - i * invCW), 0), map.size)
          const cell = map.grid[x]?.[y]
          if (cell) newVisible.add(cell)
        }
      }

      for (let cell of this.visibleCells) {
        if (!newVisible.has(cell)) {
          if (cell.has) cell.has.visible = false
          for (const corpse of cell.corpses) corpse.visible = false
        }
      }

      for (let cell of newVisible) {
        const hasCameraCulledContent = cell.has || cell.corpses?.size
        if (!this.visibleCells.has(cell) || hasCameraCulledContent) {
          cell.updateVisible()
        }
      }

      this._nextVisibleCells = this.visibleCells
      this.visibleCells = newVisible
    } finally {
      this.context.performance?.record('camera.visibleCells', performance.now() - startedAt)
    }
  }

  set(x, y, direct) {
    const {
      context: { map, app, menu },
    } = this
    const requestedCenter = direct ? { x: x + app.screen.width / 2, y: y + app.screen.height / 2 } : { x, y }
    const center = this.clampWorldPointToMap(requestedCenter.x, requestedCenter.y)
    this.camera = {
      x: center.x - app.screen.width / 2,
      y: center.y - app.screen.height / 2,
    }
    menu && menu.updateCameraMiniMap()
    map.setCoordinate(-this.camera.x, -this.camera.y)
    this.updateVisibleCells()
  }
}
