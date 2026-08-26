import { playAudibleSoundCue } from '../lib'
import { MOUNTED_HORSE_SPEED_BONUS, SHEET_TYPES, SOUND_CUES } from '../constants'
import { findFacingEntity } from '../lib/hero/heroTools'
import { isHeroInteractionTargetReachable } from '../lib/hero/heroActionRange'
import { t } from '../lib/lang'
import type { ControlsLike } from '../types/context'
import type { UnitEntity } from '../types/entities'
import type { RuntimeCell } from '../types/map'
import {
  COMPANION_HORSE_CALL_MAX_RADIUS,
  COMPANION_HORSE_CALL_MIN_RADIUS,
  MOUNT_TRANSITION_CAMERA_MS,
  MOUNT_TRANSITION_FADE_IN_MS,
  MOUNT_TRANSITION_FADE_OUT_MS,
  MOUNT_TRANSITION_HIDDEN_ALPHA,
  MOUNT_TRANSITION_TICK_MS,
  easeInOut,
  findCompanionHorseSpawnCell,
  type CompanionHorse,
  type HeroAimPoint,
  type ViewportMetrics,
} from './HeroControllerSupport'

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
    const getViewportMetrics = this.controls.getViewportMetrics
    if (typeof getViewportMetrics !== 'function') return null
    const viewport = getViewportMetrics.call(this.controls)
    if (
      typeof viewport?.visibleLeft !== 'number' ||
      typeof viewport.visibleTop !== 'number' ||
      typeof viewport.visibleWidth !== 'number' ||
      typeof viewport.visibleHeight !== 'number'
    ) {
      return null
    }
    return viewport
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
    const horse = createAnimal.call(map.gaia, { i: cell.i, j: cell.j, type: 'Horse', horseColor }) as CompanionHorse
    return this.registerCompanionHorse(horse)
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
    const cell = unit.currentCell ?? unit.context?.map?.grid?.[unit.i]?.[unit.j]
    const destination = cell
      ? { i: cell.i, j: cell.j, x: cell.x, y: cell.y, z: cell.z }
      : { i: unit.i, j: unit.j, x: unit.x, y: unit.y, z: unit.z ?? 0 }
    horse.sendTo?.(destination, null, { forceRepath: true })
    playAudibleSoundCue(horse, SOUND_CUES.unit.horseMoving, { profile: 'voice' })
    this.controls.context.menu?.showMessage(t('companionHorseComing'), 'success')
  }

  callCompanionHorse(): boolean {
    const unit = this.getHeroUnit()
    if (!unit) return false
    const activeHorse = this.getActiveCompanionHorse()
    if (activeHorse) {
      const facingHorse = findFacingEntity(
        unit,
        target => target === activeHorse && isHeroInteractionTargetReachable(unit, null, target)
      )
      if (facingHorse === activeHorse) return this.mountCompanionHorse(activeHorse)
      this.sendCompanionHorseToHero(activeHorse, unit)
      return true
    }
    if (!unit.companionHorseColor) {
      this.controls.context.menu?.showMessage(t('heroNeedsLinkedHorse'), 'warning')
      return false
    }

    const horse = this.createCompanionHorseNearHero(COMPANION_HORSE_CALL_MAX_RADIUS, {
      minRadius: COMPANION_HORSE_CALL_MIN_RADIUS,
      useViewport: true,
    })
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
    const targetCell = map?.grid[horse.i]?.[horse.j]
    if (targetCell) this.snapHeroToCell(targetCell)
  }

  finishCompanionHorseMount(horse: CompanionHorse): boolean {
    const unit = this.getHeroUnit()
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
    const horseCell = unit.currentCell ?? map.grid[unit.i]?.[unit.j]
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
    const unit = this.getHeroUnit()
    const scheduler = this.controls.context.scheduler
    if (!unit) return false
    if (this.mountTransitionTaskId != null) return true
    if (!scheduler) return finish()

    const startedAt = scheduler.elapsedMs
    const cameraStart = { x: unit.x, y: unit.y }
    let swapped = false
    unit.alpha = 1
    const taskId = scheduler.add(
      () => {
        const currentUnit = this.getHeroUnit()
        if (!currentUnit || currentUnit.isDead || currentUnit.isDestroyed || targetValid?.() === false) {
          this.cancelMountTransition()
          return
        }
        const elapsed = scheduler.elapsedMs - startedAt
        const cameraProgress = easeInOut(elapsed / MOUNT_TRANSITION_CAMERA_MS)
        this.controls.setCamera?.(
          cameraStart.x + (cameraEnd.x - cameraStart.x) * cameraProgress,
          cameraStart.y + (cameraEnd.y - cameraStart.y) * cameraProgress
        )
        if (elapsed < MOUNT_TRANSITION_FADE_OUT_MS) {
          const progress = Math.max(0, elapsed / MOUNT_TRANSITION_FADE_OUT_MS)
          currentUnit.alpha = 1 - (1 - MOUNT_TRANSITION_HIDDEN_ALPHA) * progress
          return
        }
        if (!swapped) {
          currentUnit.alpha = MOUNT_TRANSITION_HIDDEN_ALPHA
          if (!finish()) {
            this.cancelMountTransition()
            return
          }
          swapped = true
        }
        const fadeInProgress = Math.min(1, (elapsed - MOUNT_TRANSITION_FADE_OUT_MS) / MOUNT_TRANSITION_FADE_IN_MS)
        currentUnit.alpha = MOUNT_TRANSITION_HIDDEN_ALPHA + (1 - MOUNT_TRANSITION_HIDDEN_ALPHA) * fadeInProgress
        if (fadeInProgress >= 1) this.cancelMountTransition(false)
      },
      MOUNT_TRANSITION_TICK_MS,
      taskName
    )
    this.mountTransitionTaskId = taskId
    return true
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
