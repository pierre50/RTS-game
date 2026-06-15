import { Assets, Sprite, AnimatedSprite } from 'pixi.js'
import { COLOR_FLASHY_GREEN } from '../constants'
import { findWallPath, getWallFrame } from '../lib/grid/wallPath'
import { getWallLevel, getWallTexture, isWall } from '../lib/buildings/walls'
import { bindAnimatedSpriteToTicker, changeSpriteColor } from '../lib'

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
      const wallFrame = getWallFrame(hasNorthSouth, hasEastWest, isEndpoint)
      const sprite = Sprite.from(getWallTexture(draft.owner, wallFrame))
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

      if (getWallLevel(draft.owner) === 1 && wallFrame === 2) {
        const spritesheet = Assets.cache.get('598')
        const frames = Array.from(
          { length: 6 },
          (_, i) => spritesheet.textures[`${String(i + 12).padStart(3, '0')}_598.png`]
        )
        const flagSprite = new AnimatedSprite(frames)
        flagSprite.anchor.copyFrom(frames[0].defaultAnchor)
        flagSprite.x = position.x - 6
        flagSprite.y = position.y - 20
        flagSprite.zIndex = cell.i + cell.j + 0.5
        flagSprite.alpha = 0.55
        flagSprite.animationSpeed = 0.15
        flagSprite.eventMode = 'none'
        flagSprite.roundPixels = true
        changeSpriteColor(flagSprite, draft.owner.color)
        bindAnimatedSpriteToTicker(flagSprite, this.context.app)
        flagSprite.play()
        this.parent.addChild(flagSprite)
        draft.preview.push(flagSprite)
      }
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
