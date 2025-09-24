import { PLAYER_TYPES, UNIT_TYPES } from '../../constants'
import { Player } from './player'

export class Human extends Player {
  constructor({ ...props }, context) {
    super({ ...props, type: PLAYER_TYPES.human }, context)
    this.selectedUnits = []
    this.selectedUnit = null
    this.selectedBuilding = null
    this.selectedOther = null
  }

  unselectUnit(unit) {
    const {
      context: { menu },
    } = this
    const index = this.selectedUnits.indexOf(unit)
    this.selectedUnits.splice(index, 1)

    if (!this.selectedUnits.length) {
      this.selectedUnit = null
      this.selectedUnits = []
      menu.setBottombar()
      return
    }

    let nextVillager
    if (this.selectedUnit === unit) {
      for (let i = 0; i < this.selectedUnits.length; i++) {
        if (this.selectedUnits[i].type === UNIT_TYPES.villager) {
          nextVillager = this.selectedUnits[i].type
          break
        }
      }
    }
    this.selectedUnit = nextVillager || this.selectedUnits[0]
    menu.setBottombar(this.selectedUnit)
  }

  unselectAllUnits() {
    const {
      context: { menu },
    } = this
    for (let i = 0; i < this.selectedUnits.length; i++) {
      this.selectedUnits[i].unselect()
    }
    this.selectedUnit = null
    this.selectedUnits = []
    menu.setBottombar()
  }

  unselectAll() {
    if (this.selectedBuilding) {
      this.selectedBuilding.unselect()
      this.selectedBuilding = null
    }
    if (this.selectedOther) {
      this.selectedOther.unselect()
      this.selectedOther = null
    }
    this.unselectAllUnits()
  }
}
