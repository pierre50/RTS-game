import { getPlayerBuildingConfig } from '../lib/buildings/buildingAge'
import { Assets, Container, Sprite } from 'pixi.js'
import { BUILDING_TYPES, COLOR_GREEN, COLOR_RED, LABEL_TYPES, UNIT_TYPES } from '../constants'
import type { ResourceLedger } from '../lib'
import { canAfford, cartesianToIsometric, getTexture, payCost } from '../lib'
import { isTrapObservedBySight } from '../lib/buildings/trapRules'
import { getWallTexture, isWall } from '../lib/buildings/walls'
import { addHeroInventoryItem, removeHeroInventoryItem } from '../lib/equipment/equipmentLoot'
import { t } from '../lib/lang'
import { getCellMapPoint } from '../lib/mapSpaces'
import { getMissingPlayerResources, hasPlayerResourceChests } from '../lib/resources/playerResourceTotals'
import type { ControlsLike } from '../types/context'
import type { PlaceableBuildingConfig, UnitEntity } from '../types/entities'
import type { RuntimeCell } from '../types/map'
import type { PlacementOwner } from '../types/player'
import { BuildingPlacementRules } from './BuildingPlacementRules'
import { WallPlacementController } from './WallPlacementController'

type MouseBuilding = Container &
  PlaceableBuildingConfig & {
    isFree?: boolean
    inventoryItem?: string
  }

const WHEAT_FIELD_SIZE = 4
const WHEAT_PREVIEW_ALPHA = 0.75

export class BuildingPlacer {
  private readonly placementRules: BuildingPlacementRules
  controls: ControlsLike
  wallPlacementController: WallPlacementController

  constructor(controls: ControlsLike) {
    this.controls = controls
    this.placementRules = new BuildingPlacementRules(controls)
    this.wallPlacementController = new WallPlacementController({
      context: controls.context,
      parent: controls,
      getPreviewPosition: (cell: RuntimeCell) => this.getPreviewPosition(cell),
      canUseCell: (cell: RuntimeCell, owner: PlacementOwner, allowExistingWall?: boolean) =>
        this.canWallUseCell(cell, owner, allowExistingWall),
      onCommit: (path: RuntimeCell[], owner: PlacementOwner) => this.commitWallPath(path, owner),
    })
  }

  getPointerCell(): RuntimeCell | null {
    const { controls } = this
    return controls.getCellUnderCursor?.() ?? null
  }

  getPreviewPosition(cell: RuntimeCell): { x: number; y: number } {
    const { controls } = this
    const point = getCellMapPoint(cell, controls.context.map)
    return {
      x: point.x - controls.camera.x,
      y: point.y - controls.camera.y,
    }
  }

  handleMouseMove(): void {
    const { controls } = this
    const {
      context: { player },
    } = controls
    const cell = this.getPointerCell()
    const mouseBuilding = controls.mouseBuilding as MouseBuilding | null | undefined
    if (!cell || !mouseBuilding) return
    if (mouseBuilding.type === BUILDING_TYPES.smallWall) {
      const sprite = mouseBuilding.getChildByLabel(LABEL_TYPES.sprite) as Sprite | null
      if (!sprite) return
      if (!this.wallPlacementController.active) {
        const canPlace = this.canWallUseCell(cell, player)
        sprite.visible = true
        sprite.tint = canPlace ? COLOR_GREEN : COLOR_RED
        const point = this.getPreviewPosition(cell)
        mouseBuilding.x = point.x
        mouseBuilding.y = point.y
      } else {
        sprite.visible = false
      }
      this.wallPlacementController.update(cell)
      return
    }

    const point = this.getPreviewPosition(cell)
    mouseBuilding.x = point.x
    mouseBuilding.y = point.y
    const isFree = this.canPlaceMouseBuilding(cell)

    const tint = isFree ? COLOR_GREEN : COLOR_RED
    this.tintMouseBuilding(tint)
    mouseBuilding.isFree = isFree
  }

  handleMouseUp(cell: RuntimeCell): boolean | void {
    const { controls } = this
    const {
      context: { menu, player },
    } = controls
    const mouseBuilding = controls.mouseBuilding as MouseBuilding | null | undefined
    if (!mouseBuilding) return
    if (mouseBuilding.type === BUILDING_TYPES.smallWall) {
      return this.wallPlacementController.handleClick(cell, player)
    }
    if (cell.inclined || cell.border) return
    if (this.canPlaceMouseBuilding(cell)) {
      if (mouseBuilding.type === BUILDING_TYPES.farm) {
        return this.placeWheatField(cell)
      }
      if (
        mouseBuilding.inventoryItem &&
        !removeHeroInventoryItem(controls.heroUnit ?? null, mouseBuilding.inventoryItem)
      ) {
        return false
      }
      if (
        mouseBuilding.type &&
        player.buyBuilding?.(cell.i, cell.j, mouseBuilding.type, {
          alreadyPaid: Boolean(mouseBuilding.inventoryItem),
          buildingAge: typeof mouseBuilding.buildingAge === 'number' ? mouseBuilding.buildingAge : player.age,
          spaceId: cell.spaceId,
        })
      ) {
        if (
          mouseBuilding.type === BUILDING_TYPES.trap &&
          isTrapObservedBySight({ i: cell.i, j: cell.j, label: cell.has?.label }, controls.context, true)
        ) {
          menu.showMessage(t('trapPlacementObservedWarning'), 'warning')
        }
        controls.removeMouseBuilding()
        if (controls.isHeroControlActive?.()) {
          menu.setActionTarget(controls.heroUnit ?? null)
        } else if (menu.selection) {
          menu.setActionTarget(menu.selection)
        }
      } else if (mouseBuilding.inventoryItem) {
        addHeroInventoryItem(controls.heroUnit ?? null, mouseBuilding.inventoryItem)
      }
    }
  }

  setMouseBuilding(building: PlaceableBuildingConfig): void {
    const { controls } = this
    const {
      context: { player },
    } = controls
    controls.mouseBuilding = new Container() as MouseBuilding
    const texture =
      building.type === BUILDING_TYPES.smallWall
        ? getWallTexture(player, 2)
        : getTexture(
            building.type === BUILDING_TYPES.farm
              ? { sheet: 'resources/wheat', frame: 0 }
              : (building.images?.final ?? ''),
            Assets
          )
    if (building.type === BUILDING_TYPES.farm) {
      this.addWheatFieldPreview(controls.mouseBuilding, texture)
    } else {
      const sprite = Sprite.from(texture)
      sprite.label = LABEL_TYPES.sprite
      if (texture.defaultAnchor) sprite.anchor.copyFrom(texture.defaultAnchor)
      sprite.visible = building.type !== BUILDING_TYPES.smallWall
      controls.mouseBuilding.addChild(sprite)
    }
    Object.keys(building).forEach(prop => {
      ;(controls.mouseBuilding as MouseBuilding)[prop] = building[prop]
    })
    controls.mouseBuilding.label = LABEL_TYPES.mouseBuilding
    this.tintMouseBuilding(COLOR_GREEN)
    controls.addChild(controls.mouseBuilding)
    this.handleMouseMove()
  }

  removeMouseBuilding(): void {
    const { controls } = this
    this.wallPlacementController.cancel()
    if (!controls.mouseBuilding) return
    controls.removeChild(controls.mouseBuilding)
    controls.mouseBuilding.destroy()
    controls.mouseBuilding = null
  }

  cancelWallDraft(): boolean {
    return this.wallPlacementController.cancel()
  }

  isExploredForPlacement(cell: RuntimeCell, owner: PlacementOwner): boolean {
    return this.placementRules.isExploredForPlacement(cell, owner)
  }

  canPlaceMouseBuilding(cell: RuntimeCell): boolean {
    return this.placementRules.canPlaceMouseBuilding(cell)
  }

  addWheatFieldPreview(container: Container, texture: ReturnType<typeof getTexture>): void {
    const before = Math.floor((WHEAT_FIELD_SIZE - 1) / 2)
    const after = WHEAT_FIELD_SIZE - before - 1
    for (let di = -before; di <= after; di++) {
      for (let dj = -before; dj <= after; dj++) {
        const [x, y] = cartesianToIsometric(di, dj)
        const sprite = Sprite.from(texture)
        sprite.label = LABEL_TYPES.sprite
        sprite.alpha = WHEAT_PREVIEW_ALPHA
        sprite.x = x
        sprite.y = y
        sprite.zIndex = di + dj
        if (texture.defaultAnchor) sprite.anchor.copyFrom(texture.defaultAnchor)
        container.addChild(sprite)
      }
    }
    container.sortableChildren = true
  }

  tintMouseBuilding(tint: number): void {
    const mouseBuilding = this.controls.mouseBuilding as MouseBuilding | null | undefined
    if (!mouseBuilding) return
    for (const child of mouseBuilding.children) {
      if (child.label === LABEL_TYPES.sprite && child instanceof Sprite) {
        child.tint = tint
      }
    }
  }

  placeWheatField(cell: RuntimeCell): boolean {
    const { controls } = this
    const {
      context: { menu, player },
    } = controls
    const age = (controls.mouseBuilding as MouseBuilding | null)?.buildingAge
    if (
      !player.buyBuilding?.(cell.i, cell.j, BUILDING_TYPES.farm, {
        spaceId: cell.spaceId,
        ...(typeof age === 'number' ? { buildingAge: age } : {}),
      })
    )
      return false

    controls.removeMouseBuilding()
    if (controls.isHeroControlActive?.()) {
      menu.setActionTarget(controls.heroUnit ?? null)
    } else if (menu.selection) {
      menu.setActionTarget(menu.selection)
    }
    return true
  }

  doesBuildingOverlapHero(cell: RuntimeCell, building: PlaceableBuildingConfig): boolean {
    return this.placementRules.doesBuildingOverlapHero(cell, building)
  }

  isInventoryBuildingInHeroPlacementRange(cell: RuntimeCell, building: PlaceableBuildingConfig): boolean {
    return this.placementRules.isInventoryBuildingInHeroPlacementRange(cell, building)
  }

  canWallUseCell(cell: RuntimeCell, owner: PlacementOwner, allowExistingWall = false): boolean {
    return this.placementRules.canWallUseCell(cell, owner, allowExistingWall)
  }

  isHeroOnCell(cell: RuntimeCell): boolean {
    return this.placementRules.isHeroOnCell(cell)
  }

  commitWallPath(path: RuntimeCell[], owner: PlacementOwner): boolean {
    const {
      controls,
      controls: {
        context: { map, menu },
      },
    } = this
    const cells = path.filter(cell => !isWall(cell.has, owner) && this.canWallUseCell(cell, owner))
    if (!cells.length) return true

    const config = getPlayerBuildingConfig(owner, BUILDING_TYPES.smallWall)!
    const totalCost = Object.fromEntries(
      Object.entries(config.cost ?? {}).map(([resource, amount]) => [resource, (amount as number) * cells.length])
    ) as ResourceLedger
    const ownerLedger: ResourceLedger = owner
    if (!canAfford(ownerLedger, totalCost as ResourceLedger)) {
      const missing = hasPlayerResourceChests(owner)
        ? getMissingPlayerResources(owner, totalCost)
        : Object.fromEntries(
            (Object.keys(totalCost) as Array<keyof ResourceLedger>)
              .filter(key => Number(ownerLedger[key]) < Number(totalCost[key]))
              .map(key => [key, totalCost[key]])
          )
      const resource = (Object.keys(missing) as Array<keyof ResourceLedger>)[0]
      menu.showMessage(t('needMore', { resource: t(resource ?? '') }), 'warning')
      return false
    }

    payCost(owner, totalCost as ResourceLedger)
    const walls = cells.map(cell =>
      owner.createBuilding({
        i: cell.i,
        j: cell.j,
        spaceId: cell.spaceId,
        type: BUILDING_TYPES.smallWall,
        isBuilt: map.instantMode,
      })
    )

    const builders = owner.selectedUnits.filter((unit: UnitEntity) => unit.type === UNIT_TYPES.villager)
    builders.forEach((builder: UnitEntity, index: number) => {
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
      if (assignedWalls.length) builder.sendToBuildingQueue?.(assignedWalls)
    })

    owner.isPlayed && menu.updateTopbar()
    controls.removeMouseBuilding()
    if (controls.isHeroControlActive?.()) {
      menu.setActionTarget(controls.heroUnit ?? null)
    } else if (owner.selectedUnit) {
      menu.setActionTarget(owner.selectedUnit)
    }
    return true
  }
}
