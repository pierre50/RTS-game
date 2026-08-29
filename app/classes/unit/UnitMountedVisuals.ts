import { AnimatedSprite, Graphics, type Texture } from 'pixi.js'
import { LABEL_TYPES, SHEET_TYPES } from '../../constants'
import { attachEntityShadowsToMapSpace, bindAnimatedSpriteToTicker, degreeToDirection, getSpriteFrameSelection } from '../../lib'
import { recolorHorseTextures, type HorseColor } from '../../lib/horses/horseColors'
import {
  MOUNTED_HORSE_BOB,
  MOUNTED_RIDER_CUT_Y,
  MOUNTED_RIDER_LEGS_SHEET,
  MOUNTED_RIDER_Y_OFFSET,
  mountedRiderBaseDirection,
  mountedRiderLegOffset,
  mountedRiderXOffset,
} from '../../lib/hero/mountedRider'
import type { UnitEntity } from '../../types/entities'
import type { GameContextLike } from '../../types/context'
import type { SpritesheetLike } from '../../types/pixi'

const MAIN_SPRITE_LAYER_Z_INDEX = 10
const MOUNTED_HORSE_BEHIND_Z_INDEX = 0
const MOUNTED_HORSE_FRONT_Z_INDEX = 13
const MOUNTED_HORSE_STANDING_SHEET = 'animals/horse/standing'
const MOUNTED_HORSE_WALKING_SHEET = 'animals/horse/walking'
const MOUNTED_HORSE_DIRECTIONS_IN_FRONT = new Set(['south', 'southwest', 'southeast'])

type MountedVisualHost = UnitEntity & {
  context: GameContextLike
  currentSheet?: string
  degree?: number
  appearanceLayerSprites: Map<number, AnimatedSprite>
  horseShadow: AnimatedSprite | null
  horseSprite: AnimatedSprite | null
  horseColor?: HorseColor
  isDirectMoving?: boolean
  mountedRiderLegsSprite: AnimatedSprite | null
  mountedRiderMask: Graphics | null
  reliefLift?: number
  sprite: AnimatedSprite
  spriteScale?: number
  addChild: (child: AnimatedSprite | Graphics) => unknown
  createShadow: (source?: AnimatedSprite, label?: string) => AnimatedSprite
  getChildByLabel: (label: string) => { position: { y: number } } | null
  syncShadow: (shadow?: AnimatedSprite | null, source?: AnimatedSprite | null) => void
}

type CachedSpritesheetGetter = (id: string) => SpritesheetLike | undefined

export function getMountedHorseBob(unit: MountedVisualHost): number {
  if (!unit.mountedOnHorse || !unit.horseSprite) return 0
  const direction = degreeToDirection(unit.degree ?? 0) ?? 'south'
  const bobDirection = mountedRiderBaseDirection(direction)
  const bob = MOUNTED_HORSE_BOB[bobDirection]
  return bob[unit.horseSprite.currentFrame % bob.length] ?? 0
}

export function getMountedRiderY(unit: MountedVisualHost): number {
  const reliefLift = unit.reliefLift ?? 0
  if (!unit.mountedOnHorse) return reliefLift
  return reliefLift + MOUNTED_RIDER_Y_OFFSET + getMountedHorseBob(unit)
}

export function getMountedRiderX(unit: MountedVisualHost): number {
  if (!unit.mountedOnHorse) return 0
  const direction = degreeToDirection(unit.degree ?? 0) ?? 'south'
  return mountedRiderXOffset(direction)
}

export function setupMountedHorseSprite(unit: MountedVisualHost, getCachedSpritesheet: CachedSpritesheetGetter): void {
  if (!unit.mountedOnHorse || unit.horseSprite) return
  const horseSheet = getCachedSpritesheet(MOUNTED_HORSE_STANDING_SHEET)
  if (!horseSheet?.textures) return

  const { textures } = getSpriteFrameSelection(horseSheet.textures, unit.degree ?? 0, 3, null)
  unit.horseSprite = new AnimatedSprite(recolorHorseTextures(textures as Texture[], unit.horseColor))
  bindAnimatedSpriteToTicker(unit.horseSprite, unit.context.app)
  unit.horseSprite.label = `${LABEL_TYPES.sprite}-horse`
  unit.horseSprite.eventMode = 'none'
  unit.horseSprite.roundPixels = true
  unit.horseSprite.loop = true
  unit.horseSprite.updateAnchor = true
  unit.horseSprite.onFrameChange = () => syncMountedRiderPosition(unit, getCachedSpritesheet)
  unit.addChild(unit.horseSprite)
  unit.horseShadow = unit.createShadow(unit.horseSprite, `${LABEL_TYPES.shadow}-horse`)
  attachEntityShadowsToMapSpace(unit.context.map, unit)
  setupMountedRiderLegsSprite(unit, getCachedSpritesheet)
  syncMountedHorseSprite(unit, getCachedSpritesheet)
}

export function setupMountedRiderLegsSprite(
  unit: MountedVisualHost,
  getCachedSpritesheet: CachedSpritesheetGetter
): void {
  if (!unit.mountedOnHorse || unit.mountedRiderLegsSprite) return
  const legsSheet = getCachedSpritesheet(MOUNTED_RIDER_LEGS_SHEET)
  if (!legsSheet?.textures) return

  const { textures } = getSpriteFrameSelection(legsSheet.textures, unit.degree ?? 0, 3, null)
  unit.mountedRiderLegsSprite = new AnimatedSprite(textures as Texture[])
  bindAnimatedSpriteToTicker(unit.mountedRiderLegsSprite, unit.context.app)
  unit.mountedRiderLegsSprite.label = `${LABEL_TYPES.sprite}-mounted-rider-legs`
  unit.mountedRiderLegsSprite.eventMode = 'none'
  unit.mountedRiderLegsSprite.roundPixels = true
  unit.mountedRiderLegsSprite.loop = false
  unit.mountedRiderLegsSprite.updateAnchor = true
  unit.mountedRiderLegsSprite.zIndex = MAIN_SPRITE_LAYER_Z_INDEX - 1
  unit.addChild(unit.mountedRiderLegsSprite)
  syncMountedRiderLegsSprite(unit, getCachedSpritesheet)
}

export function syncMountedRiderPosition(unit: MountedVisualHost, getCachedSpritesheet: CachedSpritesheetGetter): void {
  if (!unit.sprite) return
  const riderX = getMountedRiderX(unit)
  const riderY = getMountedRiderY(unit)
  unit.sprite.position.x = riderX
  unit.sprite.position.y = riderY
  for (const layerSprite of unit.appearanceLayerSprites.values()) {
    layerSprite.position.x = riderX
    layerSprite.position.y = riderY
  }
  syncMountedRiderLegsSprite(unit, getCachedSpritesheet)
  updateMountedRiderMask(unit, unit.currentSheet)
  const healthBar = unit.getChildByLabel(LABEL_TYPES.healthBar)
  if (healthBar) healthBar.position.y = riderY
  const powerBar = unit.getChildByLabel(LABEL_TYPES.powerBar)
  if (powerBar) powerBar.position.y = riderY
  const energyBar = unit.getChildByLabel(LABEL_TYPES.energyBar)
  if (energyBar) energyBar.position.y = riderY
}

export function shouldUseMountedRiderCut(unit: MountedVisualHost, sheet = unit.currentSheet): boolean {
  return Boolean(
    unit.mountedOnHorse && sheet && [SHEET_TYPES.standing, SHEET_TYPES.walking, SHEET_TYPES.action].includes(sheet)
  )
}

export function updateMountedRiderMask(unit: MountedVisualHost, sheet = unit.currentSheet): void {
  if (!shouldUseMountedRiderCut(unit, sheet) || !unit.sprite?.textures?.length) {
    clearMountedRiderMask(unit)
    return
  }

  const texture = unit.sprite.textures[0] as Texture
  const frameHeight = texture.height || 64
  const scaleY = Math.max(0.001, Math.abs(unit.sprite.scale.y || 1))
  const topY = unit.sprite.position.y - unit.sprite.anchor.y * frameHeight * scaleY
  const cutHeight = Math.min(MOUNTED_RIDER_CUT_Y, frameHeight) * scaleY

  if (!unit.mountedRiderMask) {
    unit.mountedRiderMask = new Graphics()
    unit.mountedRiderMask.label = `${LABEL_TYPES.sprite}-mounted-rider-mask`
    unit.mountedRiderMask.eventMode = 'none'
    unit.addChild(unit.mountedRiderMask)
  }

  unit.mountedRiderMask.clear()
  unit.mountedRiderMask.rect(-512, topY, 1024, cutHeight).fill({ color: 0xffffff })
  unit.sprite.mask = unit.mountedRiderMask
  for (const [spriteKey, layerSprite] of unit.appearanceLayerSprites.entries()) {
    const layer = unit.appearance?.layers[spriteKey]
    layerSprite.mask = layer?.mountedCut === false ? null : unit.mountedRiderMask
  }
}

export function clearMountedRiderMask(unit: MountedVisualHost): void {
  if (unit.sprite) unit.sprite.mask = null
  for (const layerSprite of unit.appearanceLayerSprites.values()) {
    layerSprite.mask = null
  }
  if (!unit.mountedRiderMask) return
  unit.mountedRiderMask.parent?.removeChild(unit.mountedRiderMask)
  unit.mountedRiderMask.destroy()
  unit.mountedRiderMask = null
}

export function getMountedRiderBodyTopLeft(unit: MountedVisualHost): {
  x: number
  y: number
  width: number
  scale: number
} {
  const texture = (unit.sprite.textures[0] as Texture | undefined) ?? null
  const width = texture?.width || 64
  const height = texture?.height || 64
  const scale = Math.max(0.001, Math.abs(unit.sprite.scale.y || unit.spriteScale || 1))
  const mirrored = unit.sprite.scale.x < 0
  const x = mirrored
    ? unit.sprite.position.x - (1 - unit.sprite.anchor.x) * width * scale
    : unit.sprite.position.x - unit.sprite.anchor.x * width * scale
  const y = unit.sprite.position.y - unit.sprite.anchor.y * height * scale
  return { x, y, width, scale }
}

export function syncMountedRiderLegsSprite(
  unit: MountedVisualHost,
  getCachedSpritesheet: CachedSpritesheetGetter
): void {
  if (!unit.mountedOnHorse) {
    removeMountedRiderLegsSprite(unit)
    return
  }
  if (!unit.mountedRiderLegsSprite) setupMountedRiderLegsSprite(unit, getCachedSpritesheet)
  if (!unit.mountedRiderLegsSprite) return

  const legsSheet = getCachedSpritesheet(MOUNTED_RIDER_LEGS_SHEET)
  if (!legsSheet?.textures) return

  const { textures, mirrored } = getSpriteFrameSelection(legsSheet.textures, unit.degree ?? 0, 3, null)
  const body = getMountedRiderBodyTopLeft(unit)
  const direction = degreeToDirection(unit.degree ?? 0) ?? 'south'
  const legOffset = mountedRiderLegOffset(direction, body.scale)

  unit.mountedRiderLegsSprite.textures = textures as Texture[]
  unit.mountedRiderLegsSprite.anchor.set(0, 0)
  unit.mountedRiderLegsSprite.scale.x = mirrored ? -body.scale : body.scale
  unit.mountedRiderLegsSprite.scale.y = body.scale
  unit.mountedRiderLegsSprite.position.x = body.x + (mirrored ? body.width * body.scale - legOffset.x : legOffset.x)
  unit.mountedRiderLegsSprite.position.y = body.y + legOffset.y
  unit.mountedRiderLegsSprite.animationSpeed = 0
  unit.mountedRiderLegsSprite.gotoAndStop(0)
}

export function removeMountedRiderLegsSprite(unit: MountedVisualHost): void {
  if (!unit.mountedRiderLegsSprite) return
  unit.mountedRiderLegsSprite.parent?.removeChild(unit.mountedRiderLegsSprite)
  unit.mountedRiderLegsSprite.destroy({ children: true, texture: false })
  unit.mountedRiderLegsSprite = null
}

export function syncMountedHorseSprite(unit: MountedVisualHost, getCachedSpritesheet: CachedSpritesheetGetter): void {
  if (!unit.mountedOnHorse) {
    removeMountedHorseSprite(unit)
    return
  }
  if (!unit.horseSprite) setupMountedHorseSprite(unit, getCachedSpritesheet)
  if (!unit.mountedRiderLegsSprite) setupMountedRiderLegsSprite(unit, getCachedSpritesheet)
  if (!unit.horseSprite) return

  const horseShouldMove = unit.currentSheet === SHEET_TYPES.walking || unit.isDirectMoving
  const sheetId = horseShouldMove ? MOUNTED_HORSE_WALKING_SHEET : MOUNTED_HORSE_STANDING_SHEET
  const horseSheet = getCachedSpritesheet(sheetId)
  if (!horseSheet?.textures) return

  const frame = Math.min(unit.horseSprite.currentFrame, Math.max(unit.horseSprite.textures.length - 1, 0))
  const { textures, mirrored } = getSpriteFrameSelection(horseSheet.textures, unit.degree ?? 0, 3, null)
  const spriteScale = unit.spriteScale ?? 1
  unit.horseSprite.textures = recolorHorseTextures(textures as Texture[], unit.horseColor)
  unit.horseSprite.scale.x = mirrored ? -spriteScale : spriteScale
  unit.horseSprite.scale.y = spriteScale
  unit.horseSprite.animationSpeed = horseSheet.data?.animationSpeed ?? 0.3
  unit.horseSprite.position.y = unit.reliefLift ?? 0
  const defaultAnchor = (unit.horseSprite.textures[0] as Texture & { defaultAnchor?: { x: number; y: number } })
    .defaultAnchor
  if (defaultAnchor) {
    unit.horseSprite.anchor.set(defaultAnchor.x, defaultAnchor.y)
  }

  const direction = degreeToDirection(unit.degree ?? 0) ?? 'south'
  const horseInFront = MOUNTED_HORSE_DIRECTIONS_IN_FRONT.has(direction)
  unit.horseSprite.zIndex = horseInFront ? MOUNTED_HORSE_FRONT_Z_INDEX : MOUNTED_HORSE_BEHIND_Z_INDEX

  if (unit.context.paused) {
    unit.horseSprite.gotoAndStop(Math.min(frame, unit.horseSprite.textures.length - 1))
  } else {
    unit.horseSprite.gotoAndPlay(Math.min(frame, unit.horseSprite.textures.length - 1))
  }
  syncMountedRiderLegsSprite(unit, getCachedSpritesheet)
  unit.syncShadow(unit.horseShadow, unit.horseSprite)
}

export function removeMountedHorseSprite(unit: MountedVisualHost): void {
  clearMountedRiderMask(unit)
  removeMountedRiderLegsSprite(unit)
  if (unit.horseShadow) {
    unit.horseShadow.parent?.removeChild(unit.horseShadow)
    unit.horseShadow.destroy({ children: true, texture: false })
    unit.horseShadow = null
  }
  if (!unit.horseSprite) return
  unit.horseSprite.parent?.removeChild(unit.horseSprite)
  unit.horseSprite.destroy({ children: true, texture: false })
  unit.horseSprite = null
}
