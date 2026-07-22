import { PLAYER_TYPES, UNIT_TYPES } from '../../constants'
import { Player } from './Player'
import type { PlayerOptions } from './Player'
import type { GameContextLike } from '../../types/context'
import type { UnitEntity } from '../../types/entities'

export class Human extends Player {
  constructor({ ...props }: PlayerOptions, context: GameContextLike) {
    super({ ...props, type: PLAYER_TYPES.human }, context)
    this.selectedUnits = []
    this.selectedUnit = null
    this.selectedBuilding = null
    this.selectedOther = null
  }

  unselectUnit(unit: UnitEntity) {
    const {
      context: { menu },
    } = this
    const index = this.selectedUnits.indexOf(unit)
    if (index < 0) {
      return
    }
    this.selectedUnits.splice(index, 1)

    if (!this.selectedUnits.length) {
      this.selectedUnit = null
      this.selectedUnits = []
      menu.setActionTarget()
      return
    }

    let nextVillager
    if (this.selectedUnit === unit) {
      for (let i = 0; i < this.selectedUnits.length; i++) {
        if (this.selectedUnits[i].type === UNIT_TYPES.villager) {
          nextVillager = this.selectedUnits[i]
          break
        }
      }
    }
    this.selectedUnit = nextVillager || this.selectedUnits[0]
    menu.setActionTarget(this.selectedUnit)
  }
}
