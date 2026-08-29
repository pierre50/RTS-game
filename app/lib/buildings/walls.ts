import type { Texture, Ticker } from 'pixi.js'
import { Assets, AnimatedSprite } from 'pixi.js'
import { BUILDING_TYPES, LABEL_TYPES } from '../constants'
import { getTexture, getTextureByFrame } from '../graphics/textures'
import { changeSpriteColor } from '../graphics/colors'
import { bindAnimatedSpriteToTicker } from '../extra'
import { getEntitySpaceId, OUTSIDE_SPACE_ID } from '../mapSpaces'
import { getWallFrame } from '../grid/wallPath'
import type { Grid, GridCell } from '../../types/grid'
import type { RecolorableSprite } from '../graphics/colors'

const SHARED_WALL_SHEET = 'buildings/wall/level-1'

const WALL_SHEETS = {
  1: {
    default: SHARED_WALL_SHEET,
  },
  2: {
    default: SHARED_WALL_SHEET,
  },
  3: {
    default: SHARED_WALL_SHEET,
  },
} as const

export const WALL_CONSTRUCTION_FLAG_SHEET_ID = 'buildings/wall/construction-flag'

export type WallOwner = {
  age?: number
  civ?: string
  color?: string
  technologies?: string[]
  buildings?: Array<{ owner?: WallOwner; type?: string }>
}

export type WallCell = GridCell & {
  has?: { owner?: WallOwner; type?: string } | null
}

type WallTickerApp = {
  ticker?: {
    add: (tick: (ticker: Ticker) => void) => void
    remove: (tick: (ticker: Ticker) => void) => void
  }
}

export type WallBuilding = {
  addChild: (child: AnimatedSprite) => void
  context: {
    app?: WallTickerApp
    map: {
      grid: Grid<WallCell>
      spaces?: Map<string, { grid: Grid<WallCell> }>
    }
  }
  getChildByLabel: (label: string) => { destroy: () => void } | null
  i: number
  j: number
  isBuilt?: boolean
  isDestroyed?: boolean
  owner: WallOwner
  sprite?: {
    anchor: { copyFrom: (anchor: { x: number; y: number }) => void }
    texture: Texture
  }
  type?: string
  spaceId?: string
}

function isWallCandidate(instance: unknown): instance is { owner?: WallOwner; type?: string } {
  return typeof instance === 'object' && instance !== null
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

function getWallSheet(owner?: WallOwner | null): string {
  const level = getWallLevel(owner)
  const sheets = WALL_SHEETS[level] as Record<string, string>
  return sheets[owner?.civ ?? ''] || sheets.default || WALL_SHEETS[1].default
}

export function getWallTexture(owner: WallOwner | null, frame: number, assets = Assets) {
  return getTexture({ sheet: getWallSheet(owner), frame }, assets)
}

function getWallFrameAt(grid: Grid<WallCell>, i: number, j: number, owner: WallOwner): number {
  const north = grid[i - 1]?.[j]?.has
  const south = grid[i + 1]?.[j]?.has
  const west = grid[i]?.[j - 1]?.has
  const east = grid[i]?.[j + 1]?.has
  const neighbours = [
    isWallCandidate(north) && isWall(north, owner),
    isWallCandidate(south) && isWall(south, owner),
    isWallCandidate(west) && isWall(west, owner),
    isWallCandidate(east) && isWall(east, owner),
  ]
  const hasNorthSouth = neighbours[0] || neighbours[1]
  const hasEastWest = neighbours[2] || neighbours[3]
  return getWallFrame(hasNorthSouth, hasEastWest, neighbours.filter(Boolean).length <= 1)
}

function getWallGrid(wall: WallBuilding): Grid<WallCell> {
  const spaceId = getEntitySpaceId(wall)
  if (spaceId === OUTSIDE_SPACE_ID) return wall.context.map.grid
  return wall.context.map.spaces?.get(spaceId)?.grid ?? wall.context.map.grid
}

export function updateWallTexture(wall?: WallBuilding | null): void {
  if (!isWall(wall) || !wall.sprite || wall.isDestroyed || !wall.isBuilt) return
  const frame = getWallFrameAt(getWallGrid(wall), wall.i, wall.j, wall.owner)
  wall.sprite.texture = getWallTexture(wall.owner, frame)
  if (wall.sprite.texture.defaultAnchor) {
    wall.sprite.anchor.copyFrom(wall.sprite.texture.defaultAnchor)
  }

  const existingFill = wall.getChildByLabel(LABEL_TYPES.deco)
  if (existingFill) existingFill.destroy()

  if (getWallLevel(wall.owner) === 1 && frame === 2) {
    const frames = Array.from({ length: 6 }, (_, i) =>
      getTextureByFrame(WALL_CONSTRUCTION_FLAG_SHEET_ID, i + 12, Assets)
    )
    const flagSprite = new AnimatedSprite(frames)
    flagSprite.label = LABEL_TYPES.deco
    if (frames[0].defaultAnchor) {
      flagSprite.anchor.copyFrom(frames[0].defaultAnchor)
    }
    flagSprite.x = -6
    flagSprite.y = -20
    flagSprite.eventMode = 'none'
    flagSprite.roundPixels = true
    flagSprite.animationSpeed = 0.2
    changeSpriteColor(flagSprite as RecolorableSprite, wall.owner.color ?? 'blue')
    bindAnimatedSpriteToTicker(flagSprite, wall.context.app)
    flagSprite.play()
    wall.addChild(flagSprite)
  }
}

export function getAdjacentWalls(grid: Grid<WallCell>, i: number, j: number, owner: WallOwner): WallBuilding[] {
  return [grid[i - 1]?.[j]?.has, grid[i + 1]?.[j]?.has, grid[i]?.[j - 1]?.has, grid[i]?.[j + 1]?.has].filter(
    instance => isWallCandidate(instance) && isWall(instance, owner)
  )
}

export function updateWallAndNeighbours(wall?: WallBuilding | null): void {
  if (!isWall(wall)) return
  updateWallTexture(wall)
  getAdjacentWalls(getWallGrid(wall), wall.i, wall.j, wall.owner).forEach(updateWallTexture)
}

export function refreshOwnerWalls(owner?: WallOwner | null): void {
  owner?.buildings?.filter((building): building is WallBuilding => isWall(building, owner)).forEach(updateWallTexture)
}
