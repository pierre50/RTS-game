import { Assets, Container, Sprite } from 'pixi.js'
import { isometricToCartesian, canPlaceBuildingAt, changeSpriteColor, getTexture } from '../lib'
import { COLOR_WHITE, COLOR_RED, LABEL_TYPES } from '../constants'

export class BuildingPlacer {
  constructor(controls) {
    this.controls = controls
  }

  handleMouseMove() {
    const { controls } = this
    const {
      context: { map, app },
    } = controls
    const pos = isometricToCartesian(
      controls.mouse.x - map.x,
      controls.mouse.y >= app.screen.height ? app.screen.height - map.y : controls.mouse.y - map.y
    )
    const i = Math.min(Math.max(pos[0], 0), map.size)
    const j = Math.min(Math.max(pos[1], 0), map.size)
    if (!map.grid[i] || !map.grid[i][j]) return

    const cell = map.grid[i][j]
    controls.mouseBuilding.x = cell.x - controls.camera.x
    controls.mouseBuilding.y = cell.y - controls.camera.y
    const isFree = canPlaceBuildingAt(map.grid, i, j, controls.mouseBuilding, { requireVisible: true })

    const sprite = controls.mouseBuilding.getChildByLabel(LABEL_TYPES.sprite)
    const color = controls.mouseBuilding.getChildByLabel(LABEL_TYPES.color)
    const tint = isFree ? COLOR_WHITE : COLOR_RED
    sprite.tint = tint
    if (color) color.tint = tint
    controls.mouseBuilding.isFree = isFree
  }

  handleMouseUp(cell) {
    const { controls } = this
    const {
      context: { menu, player },
    } = controls
    if (cell.inclined || cell.border) return
    if (controls.mouseBuilding.isFree) {
      if (player.buyBuilding(cell.i, cell.j, controls.mouseBuilding.type)) {
        controls.removeMouseBuilding()
        if (menu.selection) {
          menu.setBottombar(menu.selection)
        }
      }
    }
  }

  setMouseBuilding(building) {
    const { controls } = this
    const {
      context: { player },
    } = controls
    controls.mouseBuilding = new Container()
    const sprite = Sprite.from(getTexture(building.images.final, Assets))
    sprite.label = LABEL_TYPES.sprite
    controls.mouseBuilding.addChild(sprite)
    Object.keys(building).forEach(prop => {
      controls.mouseBuilding[prop] = building[prop]
    })
    controls.mouseBuilding.x = controls.mouse.x
    controls.mouseBuilding.y = controls.mouse.y
    controls.mouseBuilding.label = LABEL_TYPES.mouseBuilding
    if (building.images.color) {
      const color = Sprite.from(getTexture(building.images.color, Assets))
      color.label = LABEL_TYPES.color
      changeSpriteColor(color, player.color)
      controls.mouseBuilding.addChild(color)
    } else {
      changeSpriteColor(sprite, player.color)
    }
    controls.addChild(controls.mouseBuilding)
  }

  removeMouseBuilding() {
    const { controls } = this
    if (!controls.mouseBuilding) return
    controls.removeChild(controls.mouseBuilding)
    controls.mouseBuilding.destroy()
    controls.mouseBuilding = null
  }
}
