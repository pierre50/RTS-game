import { Sprite } from 'pixi.js'
import { COLOR_FLASHY_GREEN } from '../constants'
import { findWallPath, getWallFrame } from '../lib/grid/wallPath'
import { getWallTexture, isWall } from '../lib/buildings/walls'

export class WallPlacementController {
  constructor({ context, parent, getPreviewPosition, canUseCell, onCommit, onChange = null }) {
    this.context = context
    this.parent = parent
    this.getPreviewPosition = getPreviewPosition
    this.canUseCell = canUseCell
    this.onCommit = onCommit
    this.onChange = onChange
    this.draft = null
  }

  get active() {
    return Boolean(this.draft)
  }

  handleClick(cell, owner) {
    if (!cell || !owner || !this.canUseCell(cell, owner, true)) return false
    if (!this.draft) {
      this.draft = { start: cell, owner, path: [cell], preview: [] }
      this.update(cell)
      this.onChange?.()
      return true
    }

    this.update(cell)
    const path = [...this.draft.path]
    const committed = this.onCommit(path, this.draft.owner)
    if (committed !== false) this.cancel()
    return true
  }

  update(cell) {
    const draft = this.draft
    if (!draft || !cell) return false
    const path = findWallPath(
      this.context.map.grid,
      draft.start,
      cell,
      (candidate, isEnd) => candidate === draft.start || this.canUseCell(candidate, draft.owner, isEnd)
    )
    if (!path.length) return false
    draft.path = path
    this.render()
    return true
  }

  render() {
    const draft = this.draft
    if (!draft) return
    draft.preview.forEach(sprite => sprite.destroy())
    draft.preview = []

    draft.path.forEach((cell, index) => {
      if (isWall(cell.has, draft.owner)) return
      const previous = draft.path[index - 1]
      const next = draft.path[index + 1]
      const hasNorthSouth = [previous, next].some(neighbour => neighbour && neighbour.i !== cell.i)
      const hasEastWest = [previous, next].some(neighbour => neighbour && neighbour.j !== cell.j)
      const isEndpoint = index === 0 || index === draft.path.length - 1
      const sprite = Sprite.from(getWallTexture(draft.owner, getWallFrame(hasNorthSouth, hasEastWest, isEndpoint)))
      const position = this.getPreviewPosition(cell)
      sprite.x = position.x
      sprite.y = position.y
      sprite.zIndex = cell.i + cell.j + 0.5
      sprite.alpha = 0.55
      sprite.tint = COLOR_FLASHY_GREEN
      sprite.eventMode = 'none'
      sprite.roundPixels = true
      this.parent.addChild(sprite)
      draft.preview.push(sprite)
    })
  }

  cancel() {
    if (!this.draft) return false
    this.draft.preview.forEach(sprite => sprite.destroy())
    this.draft = null
    this.onChange?.()
    return true
  }
}
