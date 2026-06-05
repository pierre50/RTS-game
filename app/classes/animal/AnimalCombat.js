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

export class AnimalCombat {
  constructor(animal) {
    this.animal = animal
  }

  getReaction(instance) {
    const animal = this.animal
    if (animal.strategy === 'runaway') {
      animal.runaway(instance)
    } else {
      animal.sendTo(instance, ACTION_TYPES.attack)
    }
  }

  detect(instance) {
    const animal = this.animal
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

  isAttacked(instance) {
    const animal = this.animal
    if (!instance || animal.dest || animal.isDead) return
    this.getReaction(instance)
  }

  affectNewDest() {
    const animal = this.animal
    animal.stopInterval()
    if (animal.strategy !== 'attack') {
      animal.stop()
      return
    }
    const targets = findInstancesInSight(animal, instance => animal.getActionCondition(instance))
    if (targets.length) {
      const target = getClosestInstanceWithPath(animal, targets)
      if (target) {
        if (instanceContactInstance(animal, target)) {
          animal.degree = getInstanceDegree(animal, target.x, target.y)
          animal.getAction(animal.action)
          return
        }
        animal.setDest(target.instance)
        animal.setPath(target.path)
        return
      }
    }
    animal.stop()
  }

  runaway(instance) {
    const animal = this.animal
    const {
      context: { map },
    } = animal
    let dest = null
    getCellsAroundPoint(animal.i, animal.j, map.grid, animal.sight, cell => {
      if (
        !cell.solid &&
        (!dest ||
          pointsDistance(cell.i, cell.j, instance.i, instance.j) >
            pointsDistance(dest.i, dest.j, instance.i, instance.j))
      ) {
        dest = animal.owner.views[cell.i][cell.j]
      }
    })
    if (dest) {
      animal.sendTo(dest)
    } else {
      animal.stop()
    }
  }

  getAction(name) {
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
            if (animal.destHasMoved()) {
              animal.degree = getInstanceDegree(animal, animal.dest.x, animal.dest.y)
              animal.setTextures(SHEET_TYPES.action)
            }
            if (!instanceContactInstance(animal, animal.dest)) {
              animal.sendTo(animal.dest, ACTION_TYPES.attack, { forceRepath: true })
              return
            }
            animal.sounds &&
              animal.sounds.hit &&
              animal.context.controls.instanceIsAudible(animal) &&
              playAudibleSoundCue(animal, animal.sounds.hit)
            if (animal.dest.hitPoints > 0) {
              animal.dest.hitPoints = getHitPointsWithDamage(animal, animal.dest)
              if (
                animal.dest.selected &&
                player &&
                (player.selectedUnit === animal.dest || player.selectedBuilding === animal.dest)
              ) {
                menu.updateInfo(MENU_INFO_IDS.hitPoints, animal.dest.hitPoints + '/' + animal.dest.totalHitPoints)
              }
              animal.dest.isAttacked(animal)
            }
            if (animal.dest.hitPoints <= 0) {
              animal.dest.die()
              animal.affectNewDest()
            }
          },
          animal.rateOfFire * 1000,
          false
        )
        break
      default:
        animal.stop()
    }
  }
}
