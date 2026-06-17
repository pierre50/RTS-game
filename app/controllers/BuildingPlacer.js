import { Assets, Container, Sprite } from 'pixi.js'
import { isometricToCartesian, canAfford, canPlaceBuildingAt, changeSpriteColor, getTexture, payCost } from '../lib'
import { BUILDING_TYPES, COLOR_FLASHY_GREEN, COLOR_RED, LABEL_TYPES, UNIT_TYPES } from '../constants'
import { getWallTexture, isWall } from '../lib/buildings/walls'
import { WallPlacementController } from './WallPlacementController'
import { t } from '../lib/lang'

export class BuildingPlacer {
  constructor(controls) {
    this.controls = controls
    this.wallPlacementController = new WallPlacementController({
      context: controls.context,
      parent: controls,
      getPreviewPosition: cell => ({
        x: cell.x - controls.camera.x,
        y: cell.y - controls.camera.y,
      }),
      canUseCell: (cell, owner, allowExistingWall) => this.canWallUseCell(cell, owner, allowExistingWall),
      onCommit: (path, owner) => this.commitWallPath(path, owner),
    })
  }

  getPointerCell() {
    const { controls } = this
    const {
      context: { map },
    } = controls
    const pointer = controls.screenToLocal(controls.mouse.x, controls.mouse.y)
    const { visibleHeight } = controls.getViewportMetrics()
    const [i, j] = isometricToCartesian(
      pointer.x - map.x,
      pointer.y >= visibleHeight ? visibleHeight - map.y : pointer.y - map.y
    )
    return map.grid[Math.min(Math.max(i, 0), map.size)]?.[Math.min(Math.max(j, 0), map.size)] || null
  }

  handleMouseMove() {
    const { controls } = this
    const {
      context: { map, player },
    } = controls
    const cell = this.getPointerCell()
    if (!cell) return
    if (controls.mouseBuilding.type === BUILDING_TYPES.smallWall) {
      const sprite = controls.mouseBuilding.getChildByLabel(LABEL_TYPES.sprite)
      if (!this.wallPlacementController.active) {
        const canPlace = this.canWallUseCell(cell, player)
        sprite.visible = true
        sprite.tint = canPlace ? COLOR_FLASHY_GREEN : COLOR_RED
        controls.mouseBuilding.x = cell.x - controls.camera.x
        controls.mouseBuilding.y = cell.y - controls.camera.y
      } else {
        sprite.visible = false
      }
      this.wallPlacementController.update(cell)
      return
    }

    controls.mouseBuilding.x = cell.x - controls.camera.x
    controls.mouseBuilding.y = cell.y - controls.camera.y
    const isFree = canPlaceBuildingAt(map.grid, cell.i, cell.j, controls.mouseBuilding, { requireVisible: true })

    const sprite = controls.mouseBuilding.getChildByLabel(LABEL_TYPES.sprite)
    const tint = isFree ? COLOR_FLASHY_GREEN : COLOR_RED
    sprite.tint = tint
    controls.mouseBuilding.isFree = isFree
  }

  handleMouseUp(cell) {
    const { controls } = this
    const {
      context: { menu, player },
    } = controls
    if (controls.mouseBuilding.type === BUILDING_TYPES.smallWall) {
      return this.wallPlacementController.handleClick(cell, player)
    }
    if (cell.inclined || cell.border) return
    if (controls.mouseBuilding.isFree) {
      if (player.buyBuilding(cell.i, cell.j, controls.mouseBuilding.type)) {
        controls.removeMouseBuilding()
        if (menu.selection) {
          menu.setBottombar(menu.selection)
        }
      }
    }
  }

  setMouseBuilding(building) {
    const { controls } = this
    const {
      context: { player },
    } = controls
    controls.mouseBuilding = new Container()
    const texture =
      building.type === BUILDING_TYPES.smallWall ? getWallTexture(player, 2) : getTexture(building.images.final, Assets)
    const sprite = Sprite.from(texture)
    sprite.label = LABEL_TYPES.sprite
    sprite.visible = building.type !== BUILDING_TYPES.smallWall
    controls.mouseBuilding.addChild(sprite)
    Object.keys(building).forEach(prop => {
      controls.mouseBuilding[prop] = building[prop]
    })
    const pointer = controls.screenToLocal(controls.mouse.x, controls.mouse.y)
    controls.mouseBuilding.x = pointer.x
    controls.mouseBuilding.y = pointer.y
    controls.mouseBuilding.label = LABEL_TYPES.mouseBuilding
    changeSpriteColor(sprite, player.color)
    controls.addChild(controls.mouseBuilding)
  }

  removeMouseBuilding() {
    const { controls } = this
    this.wallPlacementController.cancel()
    if (!controls.mouseBuilding) return
    controls.removeChild(controls.mouseBuilding)
    controls.mouseBuilding.destroy()
    controls.mouseBuilding = null
  }

  cancelWallDraft() {
    return this.wallPlacementController.cancel()
  }

  canWallUseCell(cell, owner, allowExistingWall = false) {
    if (!cell || !cell.visible || cell.category === 'Water' || cell.waterBorder || cell.inclined || cell.border) {
      return false
    }
    if (!cell.has && !cell.solid) return true
    return allowExistingWall && isWall(cell.has, owner)
  }

  commitWallPath(path, owner) {
    const {
      controls,
      controls: {
        context: { map, menu },
      },
    } = this
    const cells = path.filter(cell => !isWall(cell.has, owner) && this.canWallUseCell(cell, owner))
    if (!cells.length) return true

    const config = owner.config.buildings[BUILDING_TYPES.smallWall]
    const totalCost = Object.fromEntries(
      Object.entries(config.cost).map(([resource, amount]) => [resource, amount * cells.length])
    )
    if (!canAfford(owner, totalCost)) {
      const resource = Object.keys(totalCost).find(key => owner[key] < totalCost[key])
      menu.showMessage(t('needMore', { resource: t(resource) }), 'warning')
      return false
    }

    payCost(owner, totalCost)
    const walls = cells.map(cell =>
      owner.createBuilding({
        i: cell.i,
        j: cell.j,
        type: BUILDING_TYPES.smallWall,
        isBuilt: map.instantMode,
      })
    )

    const builders = owner.selectedUnits.filter(unit => unit.type === UNIT_TYPES.villager)
    builders.forEach((builder, index) => {
      const start = Math.floor((index * walls.length) / builders.length)
      const end = Math.floor(((index + 1) * walls.length) / builders.length)
      const assignedWalls = walls.slice(start, end)
      const first = assignedWalls[0]
      const last = assignedWalls.at(-1)
      if (
        first &&
        last &&
        Math.abs(builder.i - last.i) + Math.abs(builder.j - last.j) <
          Math.abs(builder.i - first.i) + Math.abs(builder.j - first.j)
      ) {
        assignedWalls.reverse()
      }
      if (assignedWalls.length) builder.sendToBuildingQueue(assignedWalls)
    })

    owner.isPlayed && menu.updateTopbar()
    controls.removeMouseBuilding()
    if (owner.selectedUnit) menu.setBottombar(owner.selectedUnit)
    return true
  }
}
