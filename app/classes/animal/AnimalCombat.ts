import { ACTION_TYPES, FAMILY_TYPES, MENU_INFO_IDS, SHEET_TYPES } from '../../constants'
import {
  findInstancesInSight,
  getCellsAroundPoint,
  getClosestInstanceWithPath,
  getHitPointsWithDamage,
  getInstanceDegree,
  instanceContactInstance,
  pointsDistance,
  playAudibleSoundCue,
} from '../../lib'
import { showDamageFeedback } from '../../lib/combatFeedback'
import type { RuntimeEntity } from '../../types/entities'
import type { RuntimeCell } from '../../types/map'
import type { Animal } from './index'

export class AnimalCombat {
  animal: Animal

  constructor(animal: Animal) {
    this.animal = animal
  }

  getReaction(instance: RuntimeEntity): void {
    const animal = this.animal
    if (animal.strategy === 'runaway') {
      animal.runaway(instance)
    } else {
      animal.sendTo(instance, ACTION_TYPES.attack)
    }
  }

  detect(instance: RuntimeEntity): void {
    const animal = this.animal
    if (animal.context.editor) return
    if (
      animal.strategy &&
      instance &&
      instance.family === FAMILY_TYPES.unit &&
      !animal.isDead &&
      !animal.path.length &&
      !animal.dest
    ) {
      this.getReaction(instance)
    }
  }

  isAttacked(instance: RuntimeEntity): void {
    const animal = this.animal
    if (animal.context.editor) return
    if (!instance || animal.dest || animal.isDead) return
    this.getReaction(instance)
  }

  affectNewDest(): void {
    const animal = this.animal
    animal.stopInterval()
    if (animal.strategy !== 'attack') {
      animal.stop()
      return
    }
    const targets = findInstancesInSight<Animal, RuntimeEntity>(animal, (instance: RuntimeEntity) =>
      animal.getActionCondition(instance)
    )
    if (targets.length) {
      const target = getClosestInstanceWithPath<RuntimeEntity, RuntimeCell>(animal, targets)
      if (target) {
        animal.setDest(target.instance)
        if (instanceContactInstance(animal, target.instance)) {
          animal.degree = getInstanceDegree(animal, target.instance.x, target.instance.y)
          animal.getAction(animal.action ?? '')
          return
        }
        animal.setPath(target.path)
        return
      }
    }
    animal.stop()
  }

  runaway(instance: RuntimeEntity): void {
    const animal = this.animal
    const {
      context: { map },
    } = animal
    let dest: RuntimeCell | null = null
    getCellsAroundPoint(animal.i, animal.j, map.grid, animal.sight ?? 0, (cell: RuntimeCell) => {
      if (
        !cell.solid &&
        (!dest ||
          pointsDistance(cell.i, cell.j, instance.i, instance.j) >
            pointsDistance(dest.i, dest.j, instance.i, instance.j))
      ) {
        dest = cell
      }
      return false
    })
    if (dest) {
      animal.isFleeing = true
      animal.sendTo(dest, null, {
        movementSheet: animal.runningSheet ? SHEET_TYPES.running : SHEET_TYPES.walking,
      })
    } else {
      animal.stop()
    }
  }

  getAction(name: string): void {
    const animal = this.animal
    const {
      context: { menu, player },
    } = animal
    switch (name) {
      case ACTION_TYPES.attack:
        if (!animal.getActionCondition(animal.dest)) {
          animal.affectNewDest()
          return
        }
        animal.setTextures(SHEET_TYPES.action)
        animal.startInterval(
          () => {
            if (!animal.getActionCondition(animal.dest)) {
              const target = animal.dest && 'hitPoints' in animal.dest ? animal.dest : null
              if (target && (target.hitPoints ?? 0) <= 0) {
                target.die?.()
              }
              animal.affectNewDest()
              return
            }
            const target = animal.dest && 'hitPoints' in animal.dest ? animal.dest : null
            if (!target) return
            if (animal.destHasMoved()) {
              animal.degree = getInstanceDegree(animal, target.x, target.y)
              animal.setTextures(SHEET_TYPES.action)
            }
            if (!instanceContactInstance(animal, target)) {
              animal.sendTo(target, ACTION_TYPES.attack, { forceRepath: true })
              return
            }
            animal.sounds &&
              animal.sounds.hit &&
              animal.context.controls.instanceIsAudible(animal) &&
              playAudibleSoundCue(animal, animal.sounds.hit)
            if ((target.hitPoints ?? 0) > 0) {
              const beforeHitPoints = target.hitPoints ?? 0
              target.hitPoints = getHitPointsWithDamage(animal, target)
              showDamageFeedback(target, beforeHitPoints - (target.hitPoints ?? 0))
              if (target.selected) {
                target.drawHealthBar?.()
                if (player && (player.selectedUnit === target || player.selectedBuilding === target)) {
                  menu.updateInfo(MENU_INFO_IDS.hitPoints, target.hitPoints + '/' + target.totalHitPoints)
                }
              }
              target.isAttacked?.(animal)
            }
            if ((target.hitPoints ?? 0) <= 0) {
              target.die?.()
              animal.affectNewDest()
            }
          },
          animal.rateOfFire * 1000,
          false,
          'animal.attack'
        )
        break
      default:
        animal.stop()
    }
  }
}
