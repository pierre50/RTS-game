import { sound } from '@pixi/sound'
import { CORPSE_TIME, MENU_INFO_IDS, SHEET_TYPES } from '../../constants'
import { getPercentage, updateInstanceVisibility } from '../../lib'

export class AnimalLifecycle {
  constructor(animal) {
    this.animal = animal
  }

  die() {
    const animal = this.animal
    if (animal.isDead) return
    if (animal.sounds && animal.context.controls.instanceIsAudible(animal)) {
      animal.sounds.die && sound.play(animal.sounds.die)
      animal.sounds.fall && sound.play(animal.sounds.fall)
    }
    updateInstanceVisibility(animal)
    animal.owner.population--
    animal.stopInterval()
    animal.stopTimeout()
    animal.isDead = true
    animal.zIndex--
    animal.path = []
    animal.action = null
    animal.death()
  }

  death() {
    const animal = this.animal
    animal.setTextures(SHEET_TYPES.dying)
    animal.zIndex--
    animal.sprite.loop = false
    animal.sprite.onComplete = () => animal.decompose()
  }

  decompose() {
    const animal = this.animal
    const {
      context: { player, menu },
    } = animal
    animal.setTextures(SHEET_TYPES.corpse)
    animal.sprite.animationSpeed = 0
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

  updateTexture() {
    const animal = this.animal
    const {
      context: { player, map },
    } = animal
    const percentage = getPercentage(animal.quantity, animal.totalQuantity)
    if (percentage > 25 && percentage < 50) {
      animal.sprite.currentFrame = 1
    } else if (percentage > 0 && percentage <= 25) {
      animal.sprite.currentFrame = 2
    } else if (percentage <= 0) {
      animal.stopInterval()
      if (map.grid[animal.i][animal.j].has === animal) {
        map.grid[animal.i][animal.j].has = null
        map.grid[animal.i][animal.j].corpses.add(animal)
        map.grid[animal.i][animal.j].solid = false
      }
      if (animal.selected && player.selectedOther === animal) {
        player.unselectAll()
      }
      animal.sprite.currentFrame = 3
      animal.timeoutId = animal.context.scheduler.addOneShot(() => animal.clear(), CORPSE_TIME * 1000)
    }
  }

  clear() {
    const animal = this.animal
    const {
      context: { map },
    } = animal
    animal.stopTimeout()
    animal.isDestroyed = true
    map.grid[animal.i][animal.j].corpses.delete(animal)
    map.removeChild(animal)
    animal.destroy({ child: true, texture: true })
  }
}
