import { CORPSE_TIME, MENU_INFO_IDS, SHEET_TYPES } from '../../constants'
import { getPercentage, playAudibleSoundCue, updateInstanceVisibility } from '../../lib'
import type { Animal } from './index'

export class AnimalLifecycle {
  animal: Animal

  constructor(animal: Animal) {
    this.animal = animal
  }

  die(): void {
    const animal = this.animal
    if (animal.isDead) return
    if (animal.sounds && animal.context.controls.instanceIsAudible(animal)) {
      playAudibleSoundCue(animal, animal.sounds.die)
      playAudibleSoundCue(animal, animal.sounds.fall)
    }
    updateInstanceVisibility(animal)
    animal.owner.population = Math.max(0, animal.owner.population - 1)
    animal.stopInterval()
    animal.stopTimeout()
    animal.animalBehavior.stop()
    animal.isDead = true
    animal.zIndex--
    animal.path = []
    animal.action = null
    animal.death()
  }

  death(): void {
    const animal = this.animal
    animal.setTextures(SHEET_TYPES.dying)
    animal.zIndex--
    animal.sprite.loop = false
    animal.syncShadow()
    animal.sprite.onComplete = () => animal.decompose()
  }

  decompose(): void {
    const animal = this.animal
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
      animal.syncShadow()
      animal.timeoutId = animal.context.scheduler.addOneShot(
        () => animal.clear(),
        CORPSE_TIME * 1000,
        'animal.clearCorpse'
      )
    }
  }

  clear(): void {
    const animal = this.animal
    if (animal.isDestroyed) return
    const {
      context: { map },
    } = animal
    animal.stopTimeout()
    animal.stopInterval()
    animal.animalBehavior.stop()
    animal.isDestroyed = true
    map.removeFromInstanceBucket(animal)
    const cell = map.grid[animal.i]?.[animal.j]
    if (cell?.has === animal) {
      cell.has = null
      cell.solid = false
    }
    cell?.corpses.delete(animal)
    const index = animal.owner.units.findIndex(unit => unit.label === animal.label)
    if (index >= 0) {
      animal.owner.units.splice(index, 1)
    }
    map.removeChild(animal)
    animal.destroy({ children: true, texture: false })
  }
}
