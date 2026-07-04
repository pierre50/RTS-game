import { Assets, AnimatedSprite, Texture } from 'pixi.js'
import { BUILDING_TYPES, LABEL_TYPES } from '../../constants'
import { getTexture } from '../graphics/textures'
import { changeSpriteColor } from '../graphics/colors'
import { bindAnimatedSpriteToTicker } from '../extra'
import { getWallFrame } from '../grid/wallPath'
import type { Grid, GridCell } from '../../types/grid'

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
} as const

type WallOwner = {
  age?: number
  civ?: keyof (typeof WALL_SHEETS)[2] | keyof (typeof WALL_SHEETS)[3] | string
  color?: string
  technologies?: string[]
  buildings?: unknown[]
}

type WallCell = GridCell & {
  has?: WallBuilding | null
}

type WallBuilding = {
  addChild: (child: AnimatedSprite) => void
  context: {
    app?: unknown
    map: {
      grid: Grid<WallCell>
    }
  }
  getChildByLabel: (label: string) => { destroy: () => void } | null
  i: number
  j: number
  isBuilt?: boolean
  isDestroyed?: boolean
  owner: WallOwner
  sprite?: {
    anchor: { copyFrom: (anchor: unknown) => void }
    texture: Texture
  }
  type?: string
}

export function isWall(
  instance?: { owner?: WallOwner; type?: string } | null,
  owner: WallOwner | null = null
): instance is WallBuilding {
  return instance?.type === BUILDING_TYPES.smallWall && (!owner || instance.owner === owner)
}

export function getWallLevel(owner?: WallOwner | null): 1 | 2 | 3 {
  if (owner?.technologies?.includes('UpgradeFortification')) return 3
  if (owner?.technologies?.includes('UpgradeMediumWall')) return 2
  return 1
}

export function getWallSheet(owner?: WallOwner | null): string {
  const level = getWallLevel(owner)
  const sheets = WALL_SHEETS[level] as Record<string, string>
  return sheets[owner?.civ ?? ''] || sheets.default || WALL_SHEETS[1].default
}

export function getWallTexture(owner: WallOwner | null, frame: number, assets = Assets) {
  return getTexture(`${String(frame).padStart(3, '0')}_${getWallSheet(owner)}`, assets)
}

export function getWallIcon(owner: WallOwner | null, baseIcon: string): string {
  const [index, sheet] = baseIcon.split('_')
  const levelOffset = (getWallLevel(owner) - 1) * 3
  return `${String(Number(index) + levelOffset).padStart(3, '0')}_${sheet}`
}

export function getWallFrameAt(grid: Grid<WallCell>, i: number, j: number, owner: WallOwner): number {
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

export function updateWallTexture(wall?: WallBuilding | null): void {
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
    changeSpriteColor(flagSprite as unknown as Parameters<typeof changeSpriteColor>[0], wall.owner.color ?? 'blue')
    bindAnimatedSpriteToTicker(
      flagSprite as Parameters<typeof bindAnimatedSpriteToTicker>[0],
      wall.context.app as Parameters<typeof bindAnimatedSpriteToTicker>[1]
    )
    flagSprite.play()
    wall.addChild(flagSprite)
  }
}

export function getAdjacentWalls(grid: Grid<WallCell>, i: number, j: number, owner: WallOwner): WallBuilding[] {
  return [grid[i - 1]?.[j]?.has, grid[i + 1]?.[j]?.has, grid[i]?.[j - 1]?.has, grid[i]?.[j + 1]?.has].filter(instance =>
    isWall(instance, owner)
  )
}

export function updateWallAndNeighbours(wall?: WallBuilding | null): void {
  if (!isWall(wall)) return
  updateWallTexture(wall)
  getAdjacentWalls(wall.context.map.grid, wall.i, wall.j, wall.owner).forEach(updateWallTexture)
}

export function refreshOwnerWalls(owner?: WallOwner | null): void {
  owner?.buildings
    ?.filter((building): building is WallBuilding => isWall(building as WallBuilding, owner))
    .forEach(updateWallTexture)
}
