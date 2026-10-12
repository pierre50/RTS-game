import { Graphics } from 'pixi.js'
import { CELL_WIDTH, CELL_HEIGHT } from '../constants/gridGeometry'
import { BASE_TERRITORY_RADIUS } from '../config/territory'
import { getBaseTerritory } from '../lib/territory/baseTerritory'
import type { ControlsLike } from '../types/context'
import type { RuntimeCell } from '../types/map'

/** Placement-only overlay: the same Euclidean territory projected onto the isometric map. */
export class BuildingTerritoryPreview {
  private graphics?: Graphics
  private signature = ''

  constructor(private controls: ControlsLike) {}

  update(cell: RuntimeCell | null): void {
    const { controls } = this
    const { player } = controls.context
    const preview = controls.mouseBuilding
    if (!preview || !cell || (cell.spaceId && cell.spaceId !== 'outside')) {
      if (this.graphics) this.graphics.visible = false
      return
    }
    const centers = (player.buildings ?? []).filter(
      center => center.type === 'TownCenter' && getBaseTerritory(center, [player])?.center === center
    )
    const points = centers.map(center => ({ i: center.i, j: center.j, proposed: false }))
    if (preview.type === 'TownCenter') points.push({ i: cell.i, j: cell.j, proposed: true })
    if (!points.length) {
      if (this.graphics) this.graphics.visible = false
      return
    }
    if (!this.graphics) {
      this.graphics = new Graphics()
      this.graphics.label = 'building-territory-preview'
      this.graphics.eventMode = 'none'
      this.graphics.zIndex = -1
      // Added before the building ghost so its placement feedback stays readable.
      controls.addChild(this.graphics)
    }
    const graphic = this.graphics
    graphic.visible = true
    graphic.position.set(-controls.camera.x, -controls.camera.y)
    const color = player.colorHex || '#ffffff'
    const signature = JSON.stringify([color, points])
    if (signature === this.signature) return
    this.signature = signature
    graphic.clear()
    for (const point of points) {
      const x = ((point.i - point.j) * CELL_WIDTH) / 2
      const y = ((point.i + point.j) * CELL_HEIGHT) / 2
      graphic.ellipse(
        x,
        y,
        (BASE_TERRITORY_RADIUS * CELL_WIDTH) / Math.SQRT2,
        (BASE_TERRITORY_RADIUS * CELL_HEIGHT) / Math.SQRT2
      )
      graphic.fill({ color, alpha: point.proposed ? 0.14 : 0.08 })
      graphic.stroke({ color, alpha: point.proposed ? 0.95 : 0.7, width: point.proposed ? 3 : 2 })
    }
  }

  destroy(): void {
    this.graphics?.parent?.removeChild(this.graphics)
    this.graphics?.destroy()
    this.graphics = undefined
    this.signature = ''
  }
}
