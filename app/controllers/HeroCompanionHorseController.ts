import { MOUNTED_HORSE_SPEED_BONUS, SHEET_TYPES } from '../constants'
import { takeStableInteriorHorseForHero } from '../lib/horses/stableHorseInteraction'
import type { StableHorse } from '../lib/horses/stableHorses'
import { t } from '../lib/lang'
import { getEntityCell, getEntitySpaceGrid } from '../lib/mapSpaces'
import type { ControlsLike } from '../types/context'
import type { BuildingEntity, UnitEntity } from '../types/entities'
import type { RuntimeCell } from '../types/map'
import {
  COMPANION_HORSE_CALL_MAX_RADIUS,
  COMPANION_HORSE_CALL_MIN_RADIUS,
  findCompanionHorseSpawnCell,
  findCompanionHorseSpawnCellNear,
  type CompanionHorse,
  type HeroAimPoint,
  type ViewportMetrics,
} from './HeroControllerSupport'
import { moveCompanionHorseToCell, sendCompanionHorseToHero } from './horse/CompanionHorseMovement'
import { startHorseTransition } from './horse/CompanionHorseTransition'
import {
  getViewportMetrics,
  isCompanionHorseVisibleToHero,
  isStableVisibleToHero,
} from './horse/CompanionHorseVisibility'

const COMPANION_HORSE_STABLE_EXIT_RADIUS = 6

export class HeroCompanionHorseController {
  controls: ControlsLike
  companionHorse: CompanionHorse | null
  mountTransitionTaskId: number | null
  private getHeroUnit: () => UnitEntity | null

  constructor(controls: ControlsLike, getHeroUnit: () => UnitEntity | null) {
    this.controls = controls
    this.getHeroUnit = getHeroUnit
    this.companionHorse = null
    this.mountTransitionTaskId = null
  }

  setHeroMountedOnHorse(mounted: boolean): boolean {
    const unit = this.getHeroUnit()
    if (!unit) return false
    if (!mounted && unit.mountedOnHorse) {
      unit.mountedOnHorse = false
      unit.speed = Math.max(0, Number(((unit.speed ?? 0) - MOUNTED_HORSE_SPEED_BONUS).toFixed(6)))
      unit.removeMountedHorseSprite?.()
      unit.syncMountedRiderPosition?.()
      unit.setTextures?.(unit.currentSheet ?? SHEET_TYPES.standing)
      return true
    }
    if (!mounted || unit.mountedOnHorse) return false
    unit.mountedOnHorse = true
    unit.speed = (unit.speed ?? 0) + MOUNTED_HORSE_SPEED_BONUS
    unit.setTextures?.(unit.currentSheet ?? SHEET_TYPES.standing)
    return true
  }

  getViewportMetrics(): ViewportMetrics | null {
    return getViewportMetrics.call(this)
  }

  createCompanionHorseNearHero(
    radiusLimit = COMPANION_HORSE_CALL_MAX_RADIUS,
    options: { minRadius?: number; useViewport?: boolean } = {}
  ): CompanionHorse | null {
    const unit = this.getHeroUnit()
    const map = unit?.context?.map
    const createAnimal = map?.gaia?.createAnimal
    if (!unit || !map || typeof createAnimal !== 'function') return null
    const cell = findCompanionHorseSpawnCell(unit, radiusLimit, {
      minRadius: options.minRadius,
      viewport: options.useViewport ? this.getViewportMetrics() : null,
    })
    if (!cell) return null
    return this.createCompanionHorseAt(cell)
  }

  createCompanionHorseAt(cell: RuntimeCell): CompanionHorse | null {
    const unit = this.getHeroUnit()
    const map = unit?.context?.map
    const createAnimal = map?.gaia?.createAnimal
    if (!unit || !map || typeof createAnimal !== 'function') return null
    const horseColor = unit.companionHorseColor ?? unit.horseColor
    const horse = createAnimal.call(map.gaia, {
      i: cell.i,
      j: cell.j,
      spaceId: cell.spaceId,
      type: 'Horse',
      horseColor,
      tamingStatus: 'tamed',
    }) as CompanionHorse
    return this.registerCompanionHorse(horse)
  }

  isCompanionHorseVisibleToHero(horse: CompanionHorse, unit: UnitEntity): boolean {
    return isCompanionHorseVisibleToHero.call(this, horse, unit)
  }

  isStableVisibleToHero(stable: BuildingEntity, unit: UnitEntity): boolean {
    return isStableVisibleToHero.call(this, stable, unit)
  }

  findVisibleOwnedStableForCompanionHorse(): BuildingEntity | null {
    const unit = this.getHeroUnit()
    const buildings = unit?.owner?.buildings
    if (!unit || !buildings?.length) return null
    let nearestStable: BuildingEntity | null = null
    let nearestDistance = Infinity
    for (const building of buildings) {
      if (!this.isStableVisibleToHero(building, unit)) continue
      const distance = Math.hypot(building.i - unit.i, building.j - unit.j)
      if (distance >= nearestDistance) continue
      nearestStable = building
      nearestDistance = distance
    }
    return nearestStable
  }

  findCompanionHorseLocalCallCell(): RuntimeCell | null {
    const unit = this.getHeroUnit()
    const map = unit?.context?.map
    if (!unit || !map) return null
    const stable = this.findVisibleOwnedStableForCompanionHorse()
    if (stable) {
      const radius = Math.max(COMPANION_HORSE_STABLE_EXIT_RADIUS, (stable.size ?? 1) + 2)
      const grid = getEntitySpaceGrid(stable, map)
      const cell = findCompanionHorseSpawnCellNear(stable, grid ?? undefined, radius)
      if (cell) return cell
    }
    return findCompanionHorseSpawnCell(unit, COMPANION_HORSE_CALL_MAX_RADIUS, {
      minRadius: COMPANION_HORSE_CALL_MIN_RADIUS,
      viewport: this.getViewportMetrics(),
    })
  }

  moveCompanionHorseToCell(horse: CompanionHorse, cell: RuntimeCell): void {
    return moveCompanionHorseToCell.call(this, this.getHeroUnit, horse, cell)
  }

  registerCompanionHorse(horse: CompanionHorse): CompanionHorse {
    const unit = this.getHeroUnit()
    horse.strategy = undefined
    horse.ambientMovement = false
    horse.companionOwner = unit ?? null
    horse.companionHitCount = 0
    horse.animalBehavior?.stop?.()
    this.companionHorse = horse
    return horse
  }

  getActiveCompanionHorse(): CompanionHorse | null {
    const unit = this.getHeroUnit()
    const horse = this.companionHorse
    if (horse?.isDead || horse?.isDestroyed) {
      if (unit) unit.companionHorseColor = null
      this.companionHorse = null
      return null
    }
    if (horse && unit?.companionHorseColor && horse.companionOwner === unit) return horse
    this.companionHorse = null
    return null
  }

  sendCompanionHorseToHero(horse: CompanionHorse, unit: UnitEntity): void {
    return sendCompanionHorseToHero.call(this, this.getHeroUnit, horse, unit)
  }

  callCompanionHorse(): boolean {
    const unit = this.getHeroUnit()
    if (!unit) return false
    const activeHorse = this.getActiveCompanionHorse()
    if (activeHorse) {
      if (!this.isCompanionHorseVisibleToHero(activeHorse, unit)) {
        const cell = this.findCompanionHorseLocalCallCell()
        if (!cell) {
          this.controls.context.menu?.showMessage(t('heroNeedsVisibleStableOrOpenEdge'), 'warning')
          return false
        }
        this.moveCompanionHorseToCell(activeHorse, cell)
      }
      this.sendCompanionHorseToHero(activeHorse, unit)
      return true
    }
    if (!unit.companionHorseColor) {
      this.controls.context.menu?.showMessage(t('heroNeedsLinkedHorse'), 'warning')
      return false
    }

    const cell = this.findCompanionHorseLocalCallCell()
    if (!cell) {
      this.controls.context.menu?.showMessage(t('heroNeedsVisibleStableOrOpenEdge'), 'warning')
      return false
    }
    const horse = this.createCompanionHorseAt(cell)
    if (!horse) return false
    this.sendCompanionHorseToHero(horse, unit)
    return true
  }

  snapHeroToCell(targetCell: RuntimeCell): void {
    const unit = this.getHeroUnit()
    const map = unit?.context?.map
    if (!unit || !map) return
    const oldI = unit.i
    const oldJ = unit.j
    const currentCell = unit.currentCell
    if (currentCell?.has === unit) {
      currentCell.has = null
      currentCell.solid = false
    }
    unit.i = targetCell.i
    unit.j = targetCell.j
    unit.x = targetCell.x
    unit.y = targetCell.y
    unit.z = targetCell.z
    unit.currentCell = targetCell
    targetCell.place(unit)
    targetCell.solid = true
    map.updateInstanceBucket?.(unit, oldI, oldJ)
  }

  snapHeroToHorse(horse: CompanionHorse): void {
    const map = this.getHeroUnit()?.context?.map
    const targetCell = map ? getEntityCell(horse, map) : null
    if (targetCell) this.snapHeroToCell(targetCell)
  }

  takeMountedStableHorse(
    horse: CompanionHorse,
    replacementHorse: StableHorse | null
  ): { building: BuildingEntity; horse: StableHorse } | null {
    const unit = this.getHeroUnit()
    if (!unit) return null
    return takeStableInteriorHorseForHero(unit, horse, replacementHorse)
  }

  finishCompanionHorseMount(horse: CompanionHorse): boolean {
    const unit = this.getHeroUnit()
    const wasMounted = Boolean(unit?.mountedOnHorse)
    if (wasMounted) return false
    this.takeMountedStableHorse(horse, null)
    if (unit && horse.horseColor) {
      unit.horseColor = horse.horseColor
      unit.companionHorseColor = horse.horseColor
    }
    if (unit && typeof horse.degree === 'number') unit.degree = horse.degree
    this.snapHeroToHorse(horse)
    if (!this.setHeroMountedOnHorse(true)) return false
    horse.clear?.()
    this.companionHorse = null
    if (unit) this.controls.setCamera?.(unit.x, unit.y)
    return true
  }

  finishCompanionHorseDismount(): boolean {
    const unit = this.getHeroUnit()
    const map = unit?.context?.map
    const createAnimal = map?.gaia?.createAnimal
    if (!unit || !map || typeof createAnimal !== 'function') return false
    const horseCell = getEntityCell(unit, map)
    const heroCell = findCompanionHorseSpawnCell(unit, 1)
    if (!horseCell || !heroCell) return false
    unit.companionHorseColor = unit.horseColor ?? unit.companionHorseColor ?? 'brown'
    if (!this.setHeroMountedOnHorse(false)) return false
    this.snapHeroToCell(heroCell)
    const horse = this.createCompanionHorseAt(horseCell)
    if (!horse) return false
    if (typeof unit.degree === 'number') horse.degree = unit.degree
    this.controls.setCamera?.(unit.x, unit.y)
    return true
  }

  cancelMountTransition(restoreAlpha = true): void {
    if (this.mountTransitionTaskId != null) {
      this.controls.context.scheduler?.remove(this.mountTransitionTaskId)
      this.mountTransitionTaskId = null
    }
    const unit = this.getHeroUnit()
    if (restoreAlpha && unit && !unit.isDestroyed) unit.alpha = 1
  }

  startHorseTransition({
    cameraEnd,
    finish,
    taskName,
    targetValid,
  }: {
    cameraEnd: HeroAimPoint
    finish: () => boolean
    taskName: string
    targetValid?: () => boolean
  }): boolean {
    return startHorseTransition.call(this, this.getHeroUnit.bind(this), {
      cameraEnd,
      finish,
      taskName,
      targetValid,
    })
  }

  mountCompanionHorse(horse: CompanionHorse): boolean {
    return this.startHorseTransition({
      cameraEnd: { x: horse.x, y: horse.y },
      finish: () => this.finishCompanionHorseMount(horse),
      targetValid: () => !horse.isDead && !horse.isDestroyed,
      taskName: 'hero.mountHorseTransition',
    })
  }

  dismountCompanionHorse(): boolean {
    const unit = this.getHeroUnit()
    const map = unit?.context?.map
    if (!unit || !map) return false
    const heroCell = findCompanionHorseSpawnCell(unit, 1)
    if (!heroCell) return false
    return this.startHorseTransition({
      cameraEnd: { x: heroCell.x, y: heroCell.y },
      finish: () => this.finishCompanionHorseDismount(),
      taskName: 'hero.dismountHorseTransition',
    })
  }

  toggleHeroHorse(): boolean {
    return this.getHeroUnit()?.mountedOnHorse ? this.dismountCompanionHorse() : this.callCompanionHorse()
  }
}
