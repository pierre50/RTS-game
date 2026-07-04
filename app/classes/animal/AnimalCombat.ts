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
import type { LooseRecord } from '../../types/common'
import type { RuntimeEntity } from '../../types/entities'
import type { RuntimeCell } from '../../types/map'
import type { Animal } from './index'

export class AnimalCombat {
  animal: Animal & LooseRecord

  constructor(animal: Animal & LooseRecord) {
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
    const targets = findInstancesInSight(
      animal as unknown as Parameters<typeof findInstancesInSight>[0],
      (instance: LooseRecord) => animal.getActionCondition(instance)
    )
    if (targets.length) {
      const target = getClosestInstanceWithPath(
        animal as unknown as Parameters<typeof getClosestInstanceWithPath>[0],
        targets as unknown as Parameters<typeof getClosestInstanceWithPath>[1]
      )
      if (target) {
        animal.setDest(target.instance as LooseRecord)
        if (
          instanceContactInstance(
            animal as unknown as Parameters<typeof instanceContactInstance>[0],
            target.instance as unknown as Parameters<typeof instanceContactInstance>[1]
          )
        ) {
          animal.degree = getInstanceDegree(animal as unknown as Parameters<typeof getInstanceDegree>[0], target.instance.x, target.instance.y)
          animal.getAction(animal.action ?? '')
          return
        }
        animal.setPath(target.path as LooseRecord[])
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
    getCellsAroundPoint(animal.i, animal.j, map.grid, animal.sight ?? 0, ((cell: RuntimeCell) => {
      if (
        !cell.solid &&
        (!dest ||
          pointsDistance(cell.i, cell.j, instance.i, instance.j) >
            pointsDistance(dest.i, dest.j, instance.i, instance.j))
      ) {
        dest = cell
      }
    }) as unknown as Parameters<typeof getCellsAroundPoint>[4])
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
              if (animal.dest && animal.dest.hitPoints <= 0) {
                animal.dest.die()
              }
              animal.affectNewDest()
              return
            }
            if (!animal.dest) return
            if (animal.destHasMoved()) {
              animal.degree = getInstanceDegree(animal as unknown as Parameters<typeof getInstanceDegree>[0], animal.dest.x, animal.dest.y)
              animal.setTextures(SHEET_TYPES.action)
            }
            if (
              !instanceContactInstance(
                animal as unknown as Parameters<typeof instanceContactInstance>[0],
                animal.dest as unknown as Parameters<typeof instanceContactInstance>[1]
              )
            ) {
              animal.sendTo(animal.dest, ACTION_TYPES.attack, { forceRepath: true })
              return
            }
            animal.sounds &&
              animal.sounds.hit &&
              animal.context.controls.instanceIsAudible(animal) &&
              playAudibleSoundCue(animal, animal.sounds.hit)
            if (animal.dest.hitPoints > 0) {
              animal.dest.hitPoints = getHitPointsWithDamage(animal, animal.dest)
              if (animal.dest.selected) {
                animal.dest.drawHealthBar()
                if (player && (player.selectedUnit === animal.dest || player.selectedBuilding === animal.dest)) {
                  menu.updateInfo(MENU_INFO_IDS.hitPoints, animal.dest.hitPoints + '/' + animal.dest.totalHitPoints)
                }
              }
              animal.dest.isAttacked(animal)
            }
            if (animal.dest.hitPoints <= 0) {
              animal.dest.die()
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
