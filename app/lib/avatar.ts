import { Assets, Rectangle, Texture } from 'pixi.js'
import { SHEET_TYPES } from '../constants'
import { getAnimationFrames } from './extra'
import { getBuildingAsset, type AssetOwner } from './graphics/assets'
import { recolorCanvasPixels, SOURCE_COLORS } from './graphics/colors'
import { getTexture } from './graphics/textures'
import { getBakedUnitStandingSheetAlias } from './lpc/baked'
import { getUnitEquipmentLevel } from './unitExperience'
import type { Application, Sprite } from 'pixi.js'
import type { DynamicEquipmentKey } from './lpc/equipment'
import type { UnitAppearanceLayerConfig } from '../types/config'
import type { AnimalEntity, RuntimeEntityBase, UnitEntity } from '../types/entities'
import type { PlayerLike } from '../types/player'
import type { SpritesheetLike } from '../types/pixi'

// Where to look for the head: the LPC body frame is 64px tall and shoulders
// start widening past ~y=34, so scanning above that keeps torso/arms out of
// the bounding-box search regardless of civ/gear.
const HEAD_SCAN_HEIGHT_RATIO = 34 / 64
const BBOX_PADDING_RATIO = 0.12
const ALPHA_THRESHOLD = 16
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

export function getUnitFacePortraitTexture(unit: PortraitSource): Texture | null {
  const sheet = unit.standingSheet ?? unit.walkingSheet
  if (!sheet?.textures) return null

  const directionCount =
    unit.sheetDirectionCounts?.[SHEET_TYPES.standing] ?? unit.sheetDirectionCounts?.[SHEET_TYPES.walking] ?? null
  const directionOrder =
    unit.sheetDirectionOrders?.[SHEET_TYPES.standing] ?? unit.sheetDirectionOrders?.[SHEET_TYPES.walking] ?? null

  const frames = getAnimationFrames(sheet.textures, 'south', directionCount, directionOrder) as Texture[]
  return frames[0] ?? null
}

// Finds the tight square around the actual opaque pixels (hair/face, or a
// whole building), so the crop isn't stuck with the source's empty margins.
function findOpaqueSquare(pixels: Uint8ClampedArray, width: number, height: number): Rectangle | null {
  let minX = width
  let maxX = -1
  let minY = height
  let maxY = -1

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (pixels[(y * width + x) * 4 + 3] > ALPHA_THRESHOLD) {
        if (x < minX) minX = x
        if (x > maxX) maxX = x
        if (y < minY) minY = y
        if (y > maxY) maxY = y
      }
    }
  }
  if (maxX < minX || maxY < minY) return null

  const boxWidth = maxX - minX + 1
  const boxHeight = maxY - minY + 1
  const centerX = minX + boxWidth / 2
  const centerY = minY + boxHeight / 2
  const side = Math.max(boxWidth, boxHeight) * (1 + BBOX_PADDING_RATIO * 2)

  return new Rectangle(Math.round(centerX - side / 2), Math.round(centerY - side / 2), Math.round(side), Math.round(side))
}

// `extract.canvas`/`extract.pixels` ignore the `frame` option when the
// target is a Texture (only Containers get clipped) — so cropping a
// sub-region means building a real sub-Texture sharing the same source.
function subTexture(texture: Texture, frame: Rectangle): Texture {
  return new Texture({ source: texture.source, frame })
}

// Crops `texture` to a tight square around its opaque content within
// `scanRect` (an absolute rect in the texture's atlas), draws it scaled to
// fill `canvas`, and repaints it from the neutral "blue" template to the
// player's color. Shared by unit and building portraits — only what counts
// as "the subject" (a head vs. a whole building) differs between callers.
function extractSquareAvatar(
  app: Application,
  texture: Texture,
  scanRect: Rectangle,
  canvas: HTMLCanvasElement,
  color: string,
  sourceColors: readonly number[]
): boolean {
  const scanTexture = subTexture(texture, scanRect)
  const { pixels, width, height } = app.renderer.extract.pixels(scanTexture)

  const square = findOpaqueSquare(pixels, width, height) ?? new Rectangle(0, 0, scanRect.width, scanRect.height)
  // Clamp to the source texture so the extraction never samples outside it.
  square.width = Math.min(square.width, texture.width, texture.height)
  square.height = square.width
  square.x = Math.max(0, Math.min(square.x, texture.width - square.width))
  square.y = Math.max(0, Math.min(square.y, texture.height - square.height))

  const cropTexture = subTexture(texture, new Rectangle(texture.frame.x + square.x, texture.frame.y + square.y, square.width, square.height))
  const extracted = app.renderer.extract.canvas(cropTexture)

  const ctx = canvas.getContext('2d')
  if (!ctx) return false
  ctx.imageSmoothingEnabled = false
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  ctx.drawImage(
    extracted as unknown as CanvasImageSource,
    0,
    0,
    square.width,
    square.height,
    0,
    0,
    canvas.width,
    canvas.height
  )

  // The source art ships in the neutral "blue" template convention — real
  // team color is repainted at runtime elsewhere (see applyOwnerColorToSprite /
  // changeSpriteColorDirectly). Recoloring the already-drawn canvas (plain
  // Canvas2D) rather than the Pixi texture avoids extract() reading back a
  // texture that was never uploaded through a real render pass.
  recolorCanvasPixels(canvas, color, sourceColors)
  return true
}

function extractSquareCanvasAvatar(
  source: HTMLCanvasElement,
  scanHeight: number,
  canvas: HTMLCanvasElement,
  color: string,
  sourceColors: readonly number[]
): boolean {
  const sourceCtx = source.getContext('2d')
  if (!sourceCtx) return false

  const scanWidth = source.width
  const clampedScanHeight = Math.max(1, Math.min(source.height, scanHeight))
  const imageData = sourceCtx.getImageData(0, 0, scanWidth, clampedScanHeight)
  const square = findOpaqueSquare(imageData.data, scanWidth, clampedScanHeight) ?? new Rectangle(0, 0, scanWidth, clampedScanHeight)
  square.width = Math.min(square.width, source.width, source.height)
  square.height = square.width
  square.x = Math.max(0, Math.min(square.x, source.width - square.width))
  square.y = Math.max(0, Math.min(square.y, source.height - square.height))

  const ctx = canvas.getContext('2d')
  if (!ctx) return false
  ctx.imageSmoothingEnabled = false
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  ctx.drawImage(source, square.x, square.y, square.width, square.height, 0, 0, canvas.width, canvas.height)
  recolorCanvasPixels(canvas, color, sourceColors)
  return true
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

function getAgeSheetOverride(
  overrides: UnitAppearanceLayerConfig['ageSheetOverrides'] | undefined,
  ownerAge: number,
  sheet: string
): string | undefined {
  if (!overrides) return undefined
  const exact = overrides[String(ownerAge)]?.[sheet]
  if (exact) return exact
  const fallbackAge = Object.keys(overrides)
    .map(Number)
    .filter(age => age <= ownerAge)
    .sort((a, b) => b - a)[0]
  return fallbackAge == null ? undefined : overrides[String(fallbackAge)]?.[sheet]
}

function getPortraitLayerTexture(unit: PortraitSource, layer: UnitAppearanceLayerConfig): Texture | null {
  const level = getUnitEquipmentLevel(unit as UnitEntity)
  if (level < (layer.minLevel ?? 0) || level > (layer.maxLevel ?? Number.POSITIVE_INFINITY)) return null
  if (layer.workTypes?.length && (!unit.work || !layer.workTypes.includes(unit.work))) return null

  const sheetKey = SHEET_TYPES.walking
  const ownerAge = Math.max(0, Math.floor(unit.owner?.age ?? 0))
  const baseSheetId =
    getAgeSheetOverride(layer.ageSheetOverrides, ownerAge, sheetKey) ??
    (layer[sheetKey as keyof UnitAppearanceLayerConfig] as string | undefined)
  if (!baseSheetId) return null

  const playerColorVariant = unit.owner?.color ? layer.playerColorVariants?.[unit.owner.color] : undefined
  const appearanceVariant = layer.appearanceVariantKey ? unit.appearanceVariants?.[layer.appearanceVariantKey] : undefined
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
    .filter((entry): entry is { layer: UnitAppearanceLayerConfig; index: number; texture: Texture } => Boolean(entry.texture))
    .sort((a, b) => a.layer.zIndex - b.layer.zIndex || a.index - b.index)

  if (!layers?.length) return false

  const composed = document.createElement('canvas')
  composed.width = baseTexture.width
  composed.height = baseTexture.height
  const ctx = composed.getContext('2d')
  if (!ctx) return false
  ctx.imageSmoothingEnabled = false

  const drawTexture = (texture: Texture) => {
    ctx.drawImage(app.renderer.extract.canvas(texture) as unknown as CanvasImageSource, 0, 0)
  }

  for (const { layer, texture } of layers) {
    if (layer.zIndex >= MAIN_SPRITE_LAYER_Z_INDEX) continue
    drawTexture(texture)
  }
  drawTexture(baseTexture)
  for (const { layer, texture } of layers) {
    if (layer.zIndex < MAIN_SPRITE_LAYER_Z_INDEX) continue
    drawTexture(texture)
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

// Same idea as getUnitFacePortraitTexture, but for a unit TYPE with no live
// instance yet (e.g. a training-button preview) — resolves the baked sheet
// straight from the civ, rather than reading a UnitEntity's own appearance.
export function getUnitTypePortraitTexture(type: string, owner: Pick<PlayerLike, 'civ' | 'label'>): Texture | null {
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
export function getAnimalPortraitTexture(animal: AnimalPortraitSource): Texture | null {
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

export function getResourcePortraitTexture(resource: ResourcePortraitSource): Texture | null {
  return (resource.sprite as Sprite | undefined)?.texture ?? null
}

// Renders a resource's current appearance into `canvas` — trees/stone/gold
// are static single textures (or a plain looping animation with no direction
// split), no team color involved, so this just reads the live sprite texture.
export function renderResourceAvatar(app: Application, resource: ResourcePortraitSource, canvas: HTMLCanvasElement): boolean {
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
const EQUIPMENT_LAYERS = ['back', 'front'] as const
const EQUIPMENT_SHEETS = ['walking', 'action'] as const
const MIN_EQUIPMENT_OPAQUE_PIXELS = 30

function getEquipmentLayerTexture(equipment: string, layer: string, sheet: string): Texture | null {
  const sheetId = `lpc-equipment/${equipment}/${layer}/${sheet}`
  const sheetData = Assets.cache.has(sheetId) ? (Assets.cache.get(sheetId) as SpritesheetLike | undefined) : undefined
  if (!sheetData?.textures) return null

  const frames = getAnimationFrames(sheetData.textures, 'south', 3, null) as Texture[]
  return frames[0] ?? null
}

function countOpaquePixels(pixels: Uint8ClampedArray): number {
  let count = 0
  for (let i = 3; i < pixels.length; i += 4) {
    if (pixels[i] > ALPHA_THRESHOLD) count++
  }
  return count
}

// Renders the weapon/tool an inventory slot equips into `canvas` — composites
// its back+front layers (both drawn at once; some equipment splits its shape
// across both, e.g. a halberd's shaft going behind the arm), then crops
// tightly to whatever's actually drawn.
export function renderEquipmentAvatar(app: Application, equipment: DynamicEquipmentKey, canvas: HTMLCanvasElement): boolean {
  for (const sheet of EQUIPMENT_SHEETS) {
    const layerTextures = EQUIPMENT_LAYERS.map(layer => getEquipmentLayerTexture(equipment, layer, sheet)).filter(
      (texture): texture is Texture => Boolean(texture)
    )
    if (!layerTextures.length) continue

    const size = layerTextures[0]
    const composed = document.createElement('canvas')
    composed.width = size.width
    composed.height = size.height
    const ctx = composed.getContext('2d')
    if (!ctx) continue
    ctx.imageSmoothingEnabled = false
    for (const texture of layerTextures) {
      ctx.drawImage(app.renderer.extract.canvas(texture) as unknown as CanvasImageSource, 0, 0)
    }

    const imageData = ctx.getImageData(0, 0, composed.width, composed.height)
    if (countOpaquePixels(imageData.data) < MIN_EQUIPMENT_OPAQUE_PIXELS) continue

    const square = findOpaqueSquare(imageData.data, composed.width, composed.height)
    if (!square) continue
    square.width = Math.min(square.width, composed.width, composed.height)
    square.height = square.width
    square.x = Math.max(0, Math.min(square.x, composed.width - square.width))
    square.y = Math.max(0, Math.min(square.y, composed.height - square.height))

    const outCtx = canvas.getContext('2d')
    if (!outCtx) return false
    outCtx.imageSmoothingEnabled = false
    outCtx.clearRect(0, 0, canvas.width, canvas.height)
    outCtx.drawImage(composed, square.x, square.y, square.width, square.height, 0, 0, canvas.width, canvas.height)
    return true
  }
  return false
}
