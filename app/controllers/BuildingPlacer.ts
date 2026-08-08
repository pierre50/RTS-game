import { Assets, Container, Sprite } from 'pixi.js'
import {
  isometricToCartesian,
  canAfford,
  canPlaceBuildingAt,
  changeSpriteColor,
  getBuildingFootprintRadius,
  getPlainCellsAroundPoint,
  getTexture,
  payCost,
} from '../lib'
import { BUILDING_TYPES, COLOR_GREEN, COLOR_RED, LABEL_TYPES, UNIT_TYPES } from '../constants'
import { getWallTexture, isWall } from '../lib/buildings/walls'
import { WallPlacementController } from './WallPlacementController'
import { t } from '../lib/lang'
import type { ControlsLike } from '../types/context'
import type { PlaceableBuildingConfig, UnitEntity } from '../types/entities'
import type { RuntimeCell } from '../types/map'
import type { PlacementOwner } from '../types/player'
import type { RecolorableSprite } from '../lib'
import type { ResourceLedger } from '../lib'

type MouseBuilding = Container &
  PlaceableBuildingConfig & {
    isFree?: boolean
  }

export class BuildingPlacer {
  controls: ControlsLike
  wallPlacementController: WallPlacementController

  constructor(controls: ControlsLike) {
    this.controls = controls
    this.wallPlacementController = new WallPlacementController({
      context: controls.context,
      parent: controls,
      getPreviewPosition: (cell: RuntimeCell) => ({
        x: cell.x - controls.camera.x,
        y: cell.y - controls.camera.y,
      }),
      canUseCell: (cell: RuntimeCell, owner: PlacementOwner, allowExistingWall?: boolean) =>
        this.canWallUseCell(cell, owner, allowExistingWall),
      onCommit: (path: RuntimeCell[], owner: PlacementOwner) => this.commitWallPath(path, owner),
    })
  }

  getPointerCell(): RuntimeCell | null {
    const { controls } = this
    const {
      context: { map },
    } = controls
    const pointer = controls.screenToLocal(controls.mouse.x, controls.mouse.y)
    const [i, j] = isometricToCartesian(pointer.x - map.x, pointer.y - map.y)
    return map.grid[Math.min(Math.max(i, 0), map.size)]?.[Math.min(Math.max(j, 0), map.size)] || null
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
        mouseBuilding.x = cell.x - controls.camera.x
        mouseBuilding.y = cell.y - controls.camera.y
      } else {
        sprite.visible = false
      }
      this.wallPlacementController.update(cell)
      return
    }

    mouseBuilding.x = cell.x - controls.camera.x
    mouseBuilding.y = cell.y - controls.camera.y
    const isFree = this.canPlaceMouseBuilding(cell)

    const sprite = mouseBuilding.getChildByLabel(LABEL_TYPES.sprite) as Sprite | null
    if (!sprite) return
    const tint = isFree ? COLOR_GREEN : COLOR_RED
    sprite.tint = tint
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
      if (mouseBuilding.type && player.buyBuilding?.(cell.i, cell.j, mouseBuilding.type)) {
        controls.removeMouseBuilding()
        if (controls.isHeroControlActive?.()) {
          menu.setActionTarget(controls.heroUnit ?? null)
        } else if (menu.selection) {
          menu.setActionTarget(menu.selection)
        }
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
        : getTexture(building.images?.final ?? '', Assets)
    const sprite = Sprite.from(texture)
    sprite.label = LABEL_TYPES.sprite
    if (texture.defaultAnchor) sprite.anchor.copyFrom(texture.defaultAnchor)
    sprite.visible = building.type !== BUILDING_TYPES.smallWall
    controls.mouseBuilding.addChild(sprite)
    Object.keys(building).forEach(prop => {
      ;(controls.mouseBuilding as MouseBuilding)[prop] = building[prop]
    })
    controls.mouseBuilding.label = LABEL_TYPES.mouseBuilding
    changeSpriteColor(sprite as RecolorableSprite, player.color ?? '')
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
    const {
      controls: {
        context: { map },
      },
    } = this
    return Boolean(cell && (map.revealEverything || map.revealTerrain || owner?.views?.isViewed(cell.i, cell.j)))
  }

  canPlaceMouseBuilding(cell: RuntimeCell): boolean {
    const {
      controls,
      controls: {
        context: { map, player },
      },
    } = this
    const mouseBuilding = controls.mouseBuilding as MouseBuilding | null | undefined
    if (!mouseBuilding) return false
    if (!cell) return false
    if (this.doesBuildingOverlapHero(cell, mouseBuilding)) return false
    return canPlaceBuildingAt(map.grid, cell.i, cell.j, mouseBuilding, {
      requireVisible: true,
      requireExplored: true,
      isExplored: candidate => this.isExploredForPlacement(candidate, player),
    })
  }

  doesBuildingOverlapHero(cell: RuntimeCell, building: PlaceableBuildingConfig): boolean {
    const hero = this.controls.isHeroControlActive?.() ? this.controls.heroUnit : null
    if (!hero || hero.isDead || hero.isDestroyed) return false
    const size = typeof building.size === 'number' ? building.size : 1
    const radius = getBuildingFootprintRadius(size)
    return getPlainCellsAroundPoint(cell.i, cell.j, this.controls.context.map.grid, radius).some(
      footprintCell => footprintCell.i === hero.i && footprintCell.j === hero.j
    )
  }

  canWallUseCell(cell: RuntimeCell, owner: PlacementOwner, allowExistingWall = false): boolean {
    if (
      !cell ||
      this.isHeroOnCell(cell) ||
      !cell.visible ||
      !this.isExploredForPlacement(cell, owner) ||
      cell.category === 'Water' ||
      cell.waterBorder ||
      cell.inclined ||
      cell.border
    ) {
      return false
    }
    if (!cell.has && !cell.solid) return true
    return allowExistingWall && isWall(cell.has, owner)
  }

  isHeroOnCell(cell: RuntimeCell): boolean {
    const hero = this.controls.isHeroControlActive?.() ? this.controls.heroUnit : null
    return Boolean(hero && !hero.isDead && !hero.isDestroyed && hero.i === cell.i && hero.j === cell.j)
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

    const config = owner.config.buildings[BUILDING_TYPES.smallWall]
    const totalCost = Object.fromEntries(
      Object.entries(config.cost ?? {}).map(([resource, amount]) => [resource, (amount as number) * cells.length])
    ) as ResourceLedger
    const ownerLedger: ResourceLedger = owner
    if (!canAfford(ownerLedger, totalCost as ResourceLedger)) {
      const resource = (Object.keys(totalCost) as Array<keyof ResourceLedger>).find(
        key => Number(ownerLedger[key]) < Number(totalCost[key])
      )
      menu.showMessage(t('needMore', { resource: t(resource ?? '') }), 'warning')
      return false
    }

    payCost(owner, totalCost as ResourceLedger)
    const walls = cells.map(cell =>
      owner.createBuilding({
        i: cell.i,
        j: cell.j,
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
