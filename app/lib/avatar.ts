import { extractSquareAvatar, extractSquareCanvasAvatar } from './graphics/avatarCrop'
import { Assets, Rectangle, type Texture } from 'pixi.js'
import { SHEET_TYPES } from '../constants'
import { getAnimationFrames } from './extra'
import { getBuildingAsset, type AssetOwner } from './graphics/assets'
import { recolorCanvasByPalette, SOURCE_COLORS } from './graphics/colors'
import { getTexture, type TextureRef } from './graphics/textures'
import { getBakedUnitStandingSheetAlias } from './lpc/baked'
import { getAppearanceAgeSheetOverride } from './lpc/appearanceLayers'
import { getUnitEquipmentTier } from './units/unitExperience'
import type { Application, Sprite } from 'pixi.js'
import type { UnitAppearanceLayerConfig } from '../types/config'
import type { AnimalEntity, RuntimeEntityBase, UnitEntity } from '../types/entities'
import type { PlayerLike } from '../types/player'
import type { SpritesheetLike } from '../types/pixi'

// Where to look for the head: the LPC body frame is 64px tall and shoulders
// start widening past ~y=34, so scanning above that keeps torso/arms out of
// the bounding-box search regardless of civ/gear.
const HEAD_SCAN_HEIGHT_RATIO = 34 / 64
const MAIN_SPRITE_LAYER_Z_INDEX = 10

type PortraitSource = Pick<
  UnitEntity,
  | 'standingSheet'
  | 'walkingSheet'
  | 'sheetDirectionCounts'
  | 'sheetDirectionOrders'
  | 'owner'
  | 'appearance'
  | 'appearanceVariants'
  | 'category'
  | 'type'
  | 'experience'
  | 'work'
>

function getUnitFacePortraitTexture(unit: PortraitSource): Texture | null {
  const sheet = unit.standingSheet ?? unit.walkingSheet
  if (!sheet?.textures) return null

  const directionCount =
    unit.sheetDirectionCounts?.[SHEET_TYPES.standing] ?? unit.sheetDirectionCounts?.[SHEET_TYPES.walking] ?? null
  const directionOrder =
    unit.sheetDirectionOrders?.[SHEET_TYPES.standing] ?? unit.sheetDirectionOrders?.[SHEET_TYPES.walking] ?? null

  const frames = getAnimationFrames(sheet.textures, 'south', directionCount, directionOrder) as Texture[]
  return frames[0] ?? null
}

export function renderUnitHeadCanvasAvatar(
  source: HTMLCanvasElement,
  canvas: HTMLCanvasElement,
  color: string
): boolean {
  const scanHeight = Math.min(source.height, Math.round(source.height * HEAD_SCAN_HEIGHT_RATIO))
  return extractSquareCanvasAvatar(source, scanHeight, canvas, color, SOURCE_COLORS)
}

function getCachedSpritesheet(id: string): SpritesheetLike | undefined {
  return Assets.cache.has(id) ? (Assets.cache.get(id) as SpritesheetLike | undefined) : undefined
}

function getPortraitLayerTexture(unit: PortraitSource, layer: UnitAppearanceLayerConfig): Texture | null {
  const level = getUnitEquipmentTier(unit as UnitEntity)
  if (level < (layer.minLevel ?? 0) || level > (layer.maxLevel ?? Number.POSITIVE_INFINITY)) return null
  if (layer.workTypes?.length && (!unit.work || !layer.workTypes.includes(unit.work))) return null

  const sheetKey = SHEET_TYPES.walking
  const ownerAge = Math.max(0, Math.floor(unit.owner?.age ?? 0))
  const baseSheetId =
    getAppearanceAgeSheetOverride(layer.ageSheetOverrides, ownerAge, sheetKey) ??
    (layer[sheetKey as keyof UnitAppearanceLayerConfig] as string | undefined)
  if (!baseSheetId) return null

  const playerColorVariant = unit.owner?.color ? layer.playerColorVariants?.[unit.owner.color] : undefined
  const appearanceVariant = layer.appearanceVariantKey
    ? unit.appearanceVariants?.[layer.appearanceVariantKey]
    : undefined
  const variantSheetId =
    appearanceVariant && `${baseSheetId}/${appearanceVariant}${playerColorVariant ? `/${playerColorVariant}` : ''}`
  const basePlayerColorSheetId = playerColorVariant ? `${baseSheetId}/${playerColorVariant}` : baseSheetId
  const sheetId = variantSheetId && Assets.cache.has(variantSheetId) ? variantSheetId : basePlayerColorSheetId
  const sheet = getCachedSpritesheet(sheetId)
  if (!sheet?.textures) return null

  const directionCount = layer.sheetDirectionCounts?.[sheetKey] ?? 3
  const directionOrder = layer.sheetDirectionOrders?.[sheetKey] ?? null
  const frames = getAnimationFrames(sheet.textures, 'south', directionCount, directionOrder) as Texture[]
  return frames[0] ?? null
}

function renderLayeredUnitHeadAvatar(
  app: Application,
  unit: PortraitSource,
  baseTexture: Texture,
  canvas: HTMLCanvasElement
): boolean {
  const layers = unit.appearance?.layers
    ?.map((layer, index) => ({ layer, index, texture: getPortraitLayerTexture(unit, layer) }))
    .filter((entry): entry is { layer: UnitAppearanceLayerConfig; index: number; texture: Texture } =>
      Boolean(entry.texture)
    )
    .sort((a, b) => a.layer.zIndex - b.layer.zIndex || a.index - b.index)

  if (!layers?.length) return false

  const composed = document.createElement('canvas')
  composed.width = baseTexture.width
  composed.height = baseTexture.height
  const ctx = composed.getContext('2d', { willReadFrequently: true })
  if (!ctx) return false
  ctx.imageSmoothingEnabled = false

  const drawTexture = (texture: Texture, layer?: UnitAppearanceLayerConfig) => {
    const layerCanvas = app.renderer.extract.canvas(texture) as HTMLCanvasElement
    if (layer?.palette?.startsWith('hair:')) {
      recolorCanvasByPalette(layerCanvas, layer.paletteSource ?? 'brown_hair', layer.palette.slice('hair:'.length))
    }
    ctx.drawImage(layerCanvas as unknown as CanvasImageSource, 0, 0)
  }

  for (const { layer, texture } of layers) {
    if (layer.zIndex >= MAIN_SPRITE_LAYER_Z_INDEX) continue
    drawTexture(texture, layer)
  }
  drawTexture(baseTexture)
  for (const { layer, texture } of layers) {
    if (layer.zIndex < MAIN_SPRITE_LAYER_Z_INDEX) continue
    drawTexture(texture, layer)
  }

  const scanHeight = Math.min(composed.height, Math.round(composed.height * HEAD_SCAN_HEIGHT_RATIO))
  return extractSquareCanvasAvatar(composed, scanHeight, canvas, unit.owner?.color ?? '', SOURCE_COLORS)
}

// Renders the unit's face into `canvas`, tightly cropped and scaled to fill
// it, from its idle south-facing frame (the same frame the game already
// shows when a unit stands still).
export function renderUnitHeadAvatar(app: Application, unit: PortraitSource, canvas: HTMLCanvasElement): boolean {
  const texture = getUnitFacePortraitTexture(unit)
  if (!texture?.width || !texture.height) return false

  if (renderLayeredUnitHeadAvatar(app, unit, texture, canvas)) return true

  const scanHeight = Math.min(texture.height, Math.round(texture.height * HEAD_SCAN_HEIGHT_RATIO))
  const scanRect = new Rectangle(texture.frame.x, texture.frame.y, texture.width, scanHeight)
  return extractSquareAvatar(app, texture, scanRect, canvas, unit.owner?.color ?? '', SOURCE_COLORS)
}

// Renders a building type's completed appearance into `canvas`, tightly
// cropped to its own silhouette and scaled to fill it.
export function renderBuildingAvatar(
  app: Application,
  type: string,
  owner: AssetOwner & { color?: string },
  canvas: HTMLCanvasElement
): boolean {
  let texture: Texture | null = null
  try {
    const ref = getBuildingAsset(type, owner, Assets).images?.final
    texture = ref ? getTexture(ref, Assets) : null
  } catch {
    return false
  }
  if (!texture?.width || !texture.height) return false

  const scanRect = new Rectangle(texture.frame.x, texture.frame.y, texture.width, texture.height)
  return extractSquareAvatar(app, texture, scanRect, canvas, owner.color ?? '', SOURCE_COLORS)
}

export function renderTextureRefAvatar(
  app: Application,
  ref: TextureRef,
  canvas: HTMLCanvasElement,
  color = '',
  sourceColors: readonly number[] = []
): boolean {
  let texture: Texture | null = null
  try {
    texture = getTexture(ref, Assets)
  } catch {
    return false
  }
  if (!texture?.width || !texture.height) return false

  const scanRect = new Rectangle(texture.frame.x, texture.frame.y, texture.width, texture.height)
  return extractSquareAvatar(app, texture, scanRect, canvas, color, sourceColors)
}

// Same idea as getUnitFacePortraitTexture, but for a unit TYPE with no live
// instance yet (e.g. a training-button preview) — resolves the baked sheet
// straight from the civ, rather than reading a UnitEntity's own appearance.
function getUnitTypePortraitTexture(type: string, owner: Pick<PlayerLike, 'civ' | 'label'>): Texture | null {
  const alias = getBakedUnitStandingSheetAlias(type, owner)
  if (!alias) return null

  const sheet = Assets.cache.has(alias) ? (Assets.cache.get(alias) as SpritesheetLike | undefined) : undefined
  if (!sheet?.textures) return null

  const frames = getAnimationFrames(sheet.textures, 'south', 3, null) as Texture[]
  return frames[0] ?? null
}

// Renders a unit type's face into `canvas` for previews where no UnitEntity
// exists yet (training buttons) — otherwise identical to renderUnitHeadAvatar.
export function renderUnitTypeAvatar(
  app: Application,
  type: string,
  owner: Pick<PlayerLike, 'civ' | 'label' | 'color'>,
  canvas: HTMLCanvasElement
): boolean {
  const texture = getUnitTypePortraitTexture(type, owner)
  if (!texture?.width || !texture.height) return false

  const scanHeight = Math.min(texture.height, Math.round(texture.height * HEAD_SCAN_HEIGHT_RATIO))
  const scanRect = new Rectangle(texture.frame.x, texture.frame.y, texture.width, scanHeight)
  return extractSquareAvatar(app, texture, scanRect, canvas, owner.color ?? '', SOURCE_COLORS)
}

type AnimalPortraitSource = Pick<AnimalEntity, 'standingSheet' | 'walkingSheet'>

// Animal sheets use the same 3-direction (back/side/front) layout as LPC unit
// sheets, just with fewer frames per direction (4 for standing instead of 8) —
// frame counts are always multiples of 3 (12, 15, 18...), not 8, so the
// direction-count-guessing heuristic never recognizes them on its own and
// directionCount must be passed explicitly or it defaults to the back-facing
// first frame.
function getAnimalPortraitTexture(animal: AnimalPortraitSource): Texture | null {
  const sheet = animal.standingSheet ?? animal.walkingSheet
  if (!sheet?.textures) return null

  const frames = getAnimationFrames(sheet.textures, 'south', 3, null) as Texture[]
  return frames[0] ?? null
}

// Renders an animal's whole silhouette into `canvas` — no head to isolate on
// a quadruped, and no team color to repaint (wildlife isn't player-owned).
export function renderAnimalAvatar(app: Application, animal: AnimalPortraitSource, canvas: HTMLCanvasElement): boolean {
  const texture = getAnimalPortraitTexture(animal)
  if (!texture?.width || !texture.height) return false

  const scanRect = new Rectangle(texture.frame.x, texture.frame.y, texture.width, texture.height)
  return extractSquareAvatar(app, texture, scanRect, canvas, '', [])
}

type ResourcePortraitSource = Pick<RuntimeEntityBase, 'sprite'>

function getResourcePortraitTexture(resource: ResourcePortraitSource): Texture | null {
  return (resource.sprite as Sprite | undefined)?.texture ?? null
}

// Renders a resource's current appearance into `canvas` — trees/stone/gold
// are static single textures (or a plain looping animation with no direction
// split), no team color involved, so this just reads the live sprite texture.
export function renderResourceAvatar(
  app: Application,
  resource: ResourcePortraitSource,
  canvas: HTMLCanvasElement
): boolean {
  const texture = getResourcePortraitTexture(resource)
  if (!texture?.width || !texture.height) return false

  const scanRect = new Rectangle(texture.frame.x, texture.frame.y, texture.width, texture.height)
  return extractSquareAvatar(app, texture, scanRect, canvas, '', [])
}

// Equipment is baked as two standalone overlay layers (back/front, composited
// on either side of the body silhouette) rather than a single sprite — a bow
// held at rest, for instance, is fully transparent on both layers, only
// appearing once "action" (its draw/shoot pose) is played. So each sheet is
// tried in turn and the first with enough opaque pixels wins, rather than
// assuming 'walking' always has visible art the way unit/building sheets do.
export { renderEquipmentAvatar } from './graphics/equipmentAvatar'
