import { CORPSE_TIME, FADE_DURATION_MS, MENU_INFO_IDS, SHEET_TYPES } from '../../constants'
import {
  cartesianToIsometric,
  getGroundReliefLevel,
  getInstanceZIndex,
  getPercentage,
  isometricToCartesian,
  playAudibleSoundCue,
  updateInstanceVisibility,
} from '../../lib'
import { getEntityCell, getEntitySpaceMapLike } from '../../lib/mapSpaces'
import { runAfterDeathFlash } from '../../lib/entities/deathFlash'
import { clearEntityVisualFeedback } from '../../lib/entities/entityVisualFeedback'
import { fadeOutThenClear } from '../../lib/entities/entityFade'
import { clearCombatAttackRecovery } from '../../lib/combat/combatAttackLoop'
import { playSpriteAnimationFromStart } from '../../lib/entities/spriteAnimation'
import type { SchedulerTaskId } from '../../types/context'
import type { RuntimeCell } from '../../types/map'
import type { AnimalControllerHost } from './AnimalTypes'

type ParentDisplay = {
  parent?: {
    removeChild: (child: unknown) => unknown
  } | null
}

const DEATH_FALL_STEPS = 8
const DEATH_FALL_STEP_MS = 40

export class AnimalLifecycle {
  animal: AnimalControllerHost
  // Runs on its own scheduler task (not animal.interval): decompose() starts the
  // corpse interval via startInterval, which would kill a fall stored there and
  // strand the corpse mid-air.
  fallTaskId: SchedulerTaskId | null = null

  constructor(animal: AnimalControllerHost) {
    this.animal = animal
  }

  setCorpseFrame(frame: number): void {
    const { sprite } = this.animal
    const lastFrame = Math.max(sprite.textures.length - 1, 0)
    sprite.currentFrame = Math.min(frame, lastFrame)
  }

  canSettleCorpseOnCell(cell: RuntimeCell | null | undefined): cell is RuntimeCell {
    if (!cell || cell.border || cell.category === 'Water') return false
    const occupant = cell.has
    return !occupant || occupant === this.animal || Boolean(occupant.isDestroyed)
  }

  snapCorpseToCell(cell: RuntimeCell | null | undefined): void {
    const animal = this.animal
    if (!cell) return
    const oldI = animal.i
    const oldJ = animal.j
    const [x, y] = cartesianToIsometric(cell.i, cell.j)
    animal.x = x
    animal.y = y
    animal.z = cell.z
    animal.i = cell.i
    animal.j = cell.j
    animal.currentCell = cell
    animal.zIndex = getInstanceZIndex(animal)
    if (this.canSettleCorpseOnCell(cell)) {
      cell.place(animal)
      cell.solid = true
    }
    animal.context.map.updateInstanceBucket(animal, oldI, oldJ)
    animal.applyReliefLift(getGroundReliefLevel(cell), true)
  }

  settleCorpseCell(): void {
    const animal = this.animal
    const map = animal.context.map
    const spaceMap = getEntitySpaceMapLike(animal, map)
    const grid = spaceMap?.grid ?? map.grid
    const currentCell = animal.currentCell ?? grid[animal.i]?.[animal.j]
    const [targetI, targetJ] = isometricToCartesian(animal.x, animal.y)
    const targetCell = grid[targetI]?.[targetJ]

    if (!this.canSettleCorpseOnCell(targetCell)) {
      this.snapCorpseToCell(currentCell)
      return
    }

    const oldI = animal.i
    const oldJ = animal.j
    if (currentCell && currentCell !== targetCell && currentCell.has === animal) {
      currentCell.has = null
      currentCell.solid = false
    }

    animal.i = targetCell.i
    animal.j = targetCell.j
    animal.z = targetCell.z
    animal.currentCell = targetCell
    animal.zIndex = getInstanceZIndex(animal)
    targetCell.place(animal)
    targetCell.solid = true
    map.updateInstanceBucket(animal, oldI, oldJ)
    animal.applyReliefLift(getGroundReliefLevel(targetCell), true)
  }

  die(): void {
    const animal = this.animal
    if (animal.isDead) return
    if (animal.sounds && animal.context.controls.instanceIsAudible(animal)) {
      playAudibleSoundCue(animal, animal.sounds.die, { profile: 'combat' })
      playAudibleSoundCue(animal, animal.sounds.fall, { profile: 'combat' })
    }
    updateInstanceVisibility(animal)
    animal.owner.population = Math.max(0, animal.owner.population - 1)
    animal.stopInterval()
    animal.stopTimeout()
    clearCombatAttackRecovery(animal)
    animal.animalBehavior.stop()
    clearEntityVisualFeedback(animal)
    if (animal.companionOwner) {
      animal.companionOwner.companionHorseColor = null
      animal.companionOwner = null
      animal.companionHitCount = 0
    }
    this.settleCorpseCell()
    animal.isDead = true
    animal.zIndex--
    animal.path = []
    animal.action = null
    animal.death()
  }

  death(): void {
    const animal = this.animal
    clearEntityVisualFeedback(animal)
    if (animal.altitude) this.startDeathFall()
    animal.setTextures(SHEET_TYPES.dying)
    animal.zIndex--
    animal.syncShadow()
    playSpriteAnimationFromStart(animal.sprite, {
      clearFrameChange: true,
      loop: false,
    })
    animal.sprite.onComplete = runAfterDeathFlash(animal.sprite, () => {
      animal.decompose()
    })
  }

  startDeathFall(): void {
    const animal = this.animal
    const startAltitude = animal.altitude
    let step = 0
    this.stopDeathFall()
    this.fallTaskId = animal.context.scheduler.add(
      () => {
        if (animal.isDestroyed) {
          this.stopDeathFall()
          return
        }
        step++
        animal.setAltitude(step >= DEATH_FALL_STEPS ? 0 : startAltitude * (1 - step / DEATH_FALL_STEPS))
        if (step >= DEATH_FALL_STEPS) this.stopDeathFall()
      },
      DEATH_FALL_STEP_MS,
      'animal.deathFall'
    )
  }

  stopDeathFall(): void {
    if (this.fallTaskId != null) {
      this.animal.context.scheduler.remove(this.fallTaskId)
      this.fallTaskId = null
    }
  }

  decompose(): void {
    const animal = this.animal
    clearEntityVisualFeedback(animal)
    const {
      context: { player, menu },
    } = animal
    animal.setTextures(SHEET_TYPES.corpse)
    animal.sprite.animationSpeed = 0
    animal.syncShadow()
    animal.startInterval(() => {
      if (animal.quantity > 0) {
        animal.quantity--
        if (animal.selected && player.selectedOther === animal) {
          menu.updateInfo(MENU_INFO_IDS.quantityText, animal.quantity)
        }
      }
      animal.updateTexture()
    }, 5000)
  }

  updateTexture(): void {
    const animal = this.animal
    const {
      context: { player, map },
    } = animal
    const percentage = getPercentage(animal.quantity, animal.totalQuantity)
    if (percentage > 25 && percentage < 50) {
      this.setCorpseFrame(1)
      animal.syncShadow()
    } else if (percentage > 0 && percentage <= 25) {
      this.setCorpseFrame(2)
      animal.syncShadow()
    } else if (percentage <= 0) {
      animal.stopInterval()
      const cell = getEntityCell(animal, map)
      if (cell?.has === animal) {
        cell.has = null
        cell.corpses.add(animal)
        cell.solid = false
      }
      if (animal.selected && player.selectedOther === animal) {
        player.unselectAll()
      }
      this.setCorpseFrame(3)
      animal.syncShadow()
      animal.timeoutId = animal.context.scheduler.addOneShot(
        () => fadeOutThenClear(animal, FADE_DURATION_MS),
        CORPSE_TIME * 1000,
        'animal.clearCorpse'
      )
    }
  }

  clear(): void {
    const animal = this.animal
    if (animal.isDestroyed) return
    clearEntityVisualFeedback(animal)
    const {
      context: { map },
    } = animal
    animal.stopTimeout()
    animal.stopInterval()
    this.stopDeathFall()
    animal.animalBehavior.stop()
    animal.isDestroyed = true
    map.removeFromInstanceBucket(animal)
    const cell = getEntityCell(animal, map)
    if (cell?.has === animal) {
      cell.has = null
      cell.solid = false
    }
    cell?.corpses.delete(animal)
    const index = animal.owner.units.findIndex(unit => unit.label === animal.label)
    if (index >= 0) {
      animal.owner.units.splice(index, 1)
    }
    ;(animal as ParentDisplay).parent?.removeChild(animal)
    animal.destroy({ children: true, texture: false })
  }
}
