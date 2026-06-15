import { Assets, AnimatedSprite } from 'pixi.js'
import { BUILDING_TYPES, LABEL_TYPES } from '../../constants'
import { getTexture } from '../graphics/textures'
import { changeSpriteColor } from '../graphics/colors'
import { bindAnimatedSpriteToTicker } from '../extra'
import { getWallFrame } from '../grid/wallPath'

const WALL_SHEETS = {
  1: {
    default: '599',
  },
  2: {
    Egyptian: '25',
    Greek: '69',
    Asian: '113',
    Babylonian: '169',
  },
  3: {
    Egyptian: '23',
    Greek: '67',
    Asian: '111',
    Babylonian: '167',
  },
}

export function isWall(instance, owner = null) {
  return instance?.type === BUILDING_TYPES.smallWall && (!owner || instance.owner === owner)
}

export function getWallLevel(owner) {
  if (owner?.technologies?.includes('UpgradeFortification')) return 3
  if (owner?.technologies?.includes('UpgradeMediumWall')) return 2
  return 1
}

export function getWallSheet(owner) {
  const level = getWallLevel(owner)
  return WALL_SHEETS[level][owner?.civ] || WALL_SHEETS[level].default || WALL_SHEETS[1].default
}

export function getWallTexture(owner, frame, assets = Assets) {
  return getTexture(`${String(frame).padStart(3, '0')}_${getWallSheet(owner)}`, assets)
}

export function getWallIcon(owner, baseIcon) {
  const [index, sheet] = baseIcon.split('_')
  const levelOffset = (getWallLevel(owner) - 1) * 3
  return `${String(Number(index) + levelOffset).padStart(3, '0')}_${sheet}`
}

export function getWallFrameAt(grid, i, j, owner) {
  const neighbours = [
    isWall(grid[i - 1]?.[j]?.has, owner),
    isWall(grid[i + 1]?.[j]?.has, owner),
    isWall(grid[i]?.[j - 1]?.has, owner),
    isWall(grid[i]?.[j + 1]?.has, owner),
  ]
  const hasNorthSouth = neighbours[0] || neighbours[1]
  const hasEastWest = neighbours[2] || neighbours[3]
  return getWallFrame(hasNorthSouth, hasEastWest, neighbours.filter(Boolean).length <= 1)
}

export function updateWallTexture(wall) {
  if (!isWall(wall) || !wall.sprite || wall.isDestroyed || !wall.isBuilt) return
  const frame = getWallFrameAt(wall.context.map.grid, wall.i, wall.j, wall.owner)
  wall.sprite.texture = getWallTexture(wall.owner, frame)
  wall.sprite.anchor.copyFrom(wall.sprite.texture.defaultAnchor)

  const existingFill = wall.getChildByLabel(LABEL_TYPES.deco)
  if (existingFill) existingFill.destroy()

  if (getWallLevel(wall.owner) === 1 && frame === 2) {
    const spritesheet = Assets.cache.get('598')
    const frames = Array.from(
      { length: 6 },
      (_, i) => spritesheet.textures[`${String(i + 12).padStart(3, '0')}_598.png`]
    )
    const flagSprite = new AnimatedSprite(frames)
    flagSprite.label = LABEL_TYPES.deco
    flagSprite.anchor.copyFrom(frames[0].defaultAnchor)
    flagSprite.x = -6
    flagSprite.y = -20
    flagSprite.eventMode = 'none'
    flagSprite.roundPixels = true
    flagSprite.animationSpeed = 0.15
    changeSpriteColor(flagSprite, wall.owner.color)
    bindAnimatedSpriteToTicker(flagSprite, wall.context.app)
    flagSprite.play()
    wall.addChild(flagSprite)
  }
}

export function getAdjacentWalls(grid, i, j, owner) {
  return [grid[i - 1]?.[j]?.has, grid[i + 1]?.[j]?.has, grid[i]?.[j - 1]?.has, grid[i]?.[j + 1]?.has].filter(instance =>
    isWall(instance, owner)
  )
}

export function updateWallAndNeighbours(wall) {
  if (!isWall(wall)) return
  updateWallTexture(wall)
  getAdjacentWalls(wall.context.map.grid, wall.i, wall.j, wall.owner).forEach(updateWallTexture)
}

export function refreshOwnerWalls(owner) {
  owner?.buildings?.filter(building => isWall(building, owner)).forEach(updateWallTexture)
}
