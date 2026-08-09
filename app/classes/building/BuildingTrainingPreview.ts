import { AnimatedSprite, Assets, ColorMatrixFilter, Container, Graphics } from 'pixi.js'
import {
  ACTION_TYPES,
  BUILDING_TYPES,
  LABEL_TYPES,
  SHEET_TYPES,
  TRAINING_PREVIEW_LIGHT_COLOR,
  TRAINING_PREVIEW_LIGHT_INTENSITY_MAX,
  TRAINING_PREVIEW_LIGHT_INTENSITY_MIN,
  TRAINING_PREVIEW_LIGHT_PULSE_MS,
  UNIT_TYPES,
  WORK_TYPES,
} from '../../constants'
import { bindAnimatedSpriteToTicker, getAnimationFrames } from '../../lib'
import { applyBakedLpcUnitAssets } from '../../lib/lpc'
import { getUnitEquipmentLevel } from '../../lib/unitExperience'
import {
  MOUNTED_HORSE_BOB,
  MOUNTED_RIDER_CUT_Y,
  MOUNTED_RIDER_LEGS_SHEET,
  MOUNTED_RIDER_Y_OFFSET,
  mountedRiderLegOffset,
  mountedRiderXOffset,
} from '../../lib/mountedRider'
import { getHorseColorFromSeed, recolorHorseTextures, type HorseColor } from '../../lib/horseColors'
import type { Texture } from 'pixi.js'
import type { SchedulerTaskId } from '../../types/context'
import type { UnitAppearanceLayerConfig } from '../../types/config'
import type { BuildingEntity, UnitEntity } from '../../types/entities'
import type { SpritesheetLike } from '../../types/pixi'

const TRAINING_PREVIEW_X = 41
const TRAINING_PREVIEW_Y = 110
const TRAINING_PREVIEW_SCALE = 1
const TRAINING_PREVIEW_ANIMATION_SPEED_FACTOR = 0.45
const MAIN_PREVIEW_Z_INDEX = 10
const MOUNTED_HORSE_STANDING_SHEET = 'animals/horse/standing'
const MOUNTED_PREVIEW_DIRECTION = 'south'
const TRAINING_PREVIEW_POSITIONS: Partial<Record<string, { x: number; y: number }>> = {
  [BUILDING_TYPES.barracks]: { x: TRAINING_PREVIEW_X, y: TRAINING_PREVIEW_Y },
  [BUILDING_TYPES.archeryRange]: { x: 85, y: 80 },
  [BUILDING_TYPES.temple]: { x: 50, y: 100 },
  [BUILDING_TYPES.stable]: { x: 53, y: 80 },
}

type PreviewLayer = {
  sprite: AnimatedSprite
  lightFilter: ColorMatrixFilter
  zIndex: number
}

type PreviewUnit = Pick<UnitEntity, 'owner' | 'type' | 'label' | 'i' | 'j' | 'controlMode' | 'work'> &
  Partial<UnitEntity>

function getTrainingPreviewWork(type: string): string {
  return type === UNIT_TYPES.priest ? WORK_TYPES.healer : WORK_TYPES.attacker
}

function getActionSheetId(unit: PreviewUnit): string | null {
  const work = unit.work || getTrainingPreviewWork(unit.type)
  return (
    unit.assets?.[SHEET_TYPES.action] ??
    unit.allAssets?.[work]?.[SHEET_TYPES.action] ??
    unit.allAssets?.default?.[SHEET_TYPES.action] ??
    null
  )
}

function getLayerActionSheetId(layer: UnitAppearanceLayerConfig, work: string, mounted = false): string | null {
  if (layer.workTypes?.length && !layer.workTypes.includes(work)) return null
  if (layer.hideForActions?.includes(ACTION_TYPES.attack)) return null
  if (mounted && layer.mountedSheet) return layer.mountedSheet
  return layer.actionWorkSheetOverrides?.[`${work}:${ACTION_TYPES.attack}`]?.[SHEET_TYPES.action] ?? layer.actionSheet ?? null
}

function isHorseSheet(sheetId: string): boolean {
  return sheetId === MOUNTED_HORSE_STANDING_SHEET
}

function isLayerUnlockedForPreview(layer: UnitAppearanceLayerConfig, unit: PreviewUnit): boolean {
  const level = getUnitEquipmentLevel(unit as UnitEntity)
  return level >= (layer.minLevel ?? 0) && level <= (layer.maxLevel ?? Number.POSITIVE_INFINITY)
}

function setDefaultAnchor(sprite: AnimatedSprite): void {
  const texture = sprite.textures[0] as (Texture & { defaultAnchor?: { x: number; y: number } }) | undefined
  if (texture?.defaultAnchor) {
    sprite.anchor.set(texture.defaultAnchor.x, texture.defaultAnchor.y)
  }
}

function getSpriteTopLeft(sprite: AnimatedSprite): { x: number; y: number; width: number; scale: number } {
  const texture = sprite.textures[0] as Texture | undefined
  const width = texture?.width || 64
  const height = texture?.height || 64
  const scale = Math.max(0.001, Math.abs(sprite.scale.y || 1))
  const mirrored = sprite.scale.x < 0
  const x = mirrored ? sprite.position.x - (1 - sprite.anchor.x) * width * scale : sprite.position.x - sprite.anchor.x * width * scale
  const y = sprite.position.y - sprite.anchor.y * height * scale
  return { x, y, width, scale }
}

export class BuildingTrainingPreview {
  building: BuildingEntity
  container: Container
  layers: PreviewLayer[]
  masks: Graphics[]
  currentType: string | null
  currentPreviewKey: string | null
  lightTaskId: SchedulerTaskId | null

  constructor(building: BuildingEntity) {
    this.building = building
    this.layers = []
    this.masks = []
    this.currentType = null
    this.currentPreviewKey = null
    this.lightTaskId = null
    this.container = new Container()
    this.container.label = 'building-training-preview'
    this.container.eventMode = 'none'
    this.container.sortableChildren = true
    this.container.visible = false
    building.addChild?.(this.container)
  }

  setLightIntensity(filter: ColorMatrixFilter, intensity: number): void {
    const red = ((TRAINING_PREVIEW_LIGHT_COLOR >> 16) & 0xff) / 255
    const green = ((TRAINING_PREVIEW_LIGHT_COLOR >> 8) & 0xff) / 255
    const blue = (TRAINING_PREVIEW_LIGHT_COLOR & 0xff) / 255
    filter.matrix = [
      1,
      0,
      0,
      0,
      red * intensity,
      0,
      1,
      0,
      0,
      green * intensity,
      0,
      0,
      1,
      0,
      blue * intensity,
      0,
      0,
      0,
      1,
      0,
    ]
  }

  createPreviewUnit(type: string): PreviewUnit | null {
    const config = this.building.owner?.config.units[type]
    if (!config) return null

    const unit = {
      owner: this.building.owner,
      type,
      label: `${this.building.label || this.building.type}-training-preview-${type}`,
      i: this.building.i,
      j: this.building.j,
      controlMode: 'standard',
      work: getTrainingPreviewWork(type),
    } as PreviewUnit

    Object.assign(unit, config)
    const trainee = this.building.trainingType === type ? this.building.trainingUnit : null
    if (trainee?.appearanceVariants) unit.appearanceVariants = { ...trainee.appearanceVariants }
    if (trainee?.experience) unit.experience = { ...trainee.experience }
    if (trainee?.horseColor) unit.horseColor = trainee.horseColor
    applyBakedLpcUnitAssets(unit as UnitEntity)
    return unit
  }

  createSprite(
    sheetId: string,
    directionCount: number | null,
    zIndex: number,
    scale: number,
    horseColor?: HorseColor
  ): PreviewLayer | null {
    const sheet = Assets.cache.has(sheetId) ? (Assets.cache.get(sheetId) as SpritesheetLike | undefined) : undefined
    const app = this.building.context?.app
    if (!sheet?.textures || !app) return null

    const frames = getAnimationFrames(sheet.textures, 'south', directionCount) as Texture[]
    const sprite = new AnimatedSprite(isHorseSheet(sheetId) ? recolorHorseTextures(frames, horseColor) : frames)
    bindAnimatedSpriteToTicker(sprite, app)
    sprite.label = LABEL_TYPES.sprite
    sprite.eventMode = 'none'
    sprite.roundPixels = true
    sprite.loop = true
    sprite.zIndex = zIndex
    sprite.animationSpeed = (sheet.data?.animationSpeed ?? 0.3) * TRAINING_PREVIEW_ANIMATION_SPEED_FACTOR
    sprite.scale.set(scale)
    setDefaultAnchor(sprite)
    const lightFilter = new ColorMatrixFilter()
    this.setLightIntensity(lightFilter, TRAINING_PREVIEW_LIGHT_INTENSITY_MIN)
    sprite.filters = [lightFilter]
    sprite.play()
    return { sprite, lightFilter, zIndex }
  }

  createLayers(type: string): PreviewLayer[] {
    const unit = this.createPreviewUnit(type)
    if (!unit) return []

    const actionSheetId = getActionSheetId(unit)
    const directionCount = unit.sheetDirectionCounts?.[SHEET_TYPES.action] ?? null
    const scale = unit.spriteScale ?? TRAINING_PREVIEW_SCALE
    const layers: PreviewLayer[] = []

    if (this.building.type === BUILDING_TYPES.stable) {
      return this.createMountedLayers(unit, scale, directionCount)
    }

    for (const layer of unit.appearance?.layers ?? []) {
      if (!isLayerUnlockedForPreview(layer, unit)) continue
      const layerSheetId = getLayerActionSheetId(layer, unit.work || getTrainingPreviewWork(type))
      if (!layerSheetId) continue
      const layerDirectionCount = layer.sheetDirectionCounts?.[SHEET_TYPES.action] ?? directionCount
      const previewLayer = this.createSprite(layerSheetId, layerDirectionCount, layer.zIndex, scale)
      if (previewLayer) layers.push(previewLayer)
    }

    if (actionSheetId) {
      const baseLayer = this.createSprite(actionSheetId, directionCount, MAIN_PREVIEW_Z_INDEX, scale)
      if (baseLayer) layers.push(baseLayer)
    }

    return layers.sort((a, b) => a.zIndex - b.zIndex)
  }

  createMountedLayers(unit: PreviewUnit, scale: number, directionCount: number | null): PreviewLayer[] {
    const layers: PreviewLayer[] = []
    const horseColor =
      (unit.horseColor as HorseColor | undefined) ??
      getHorseColorFromSeed(`${this.building.label}:${unit.type}:${this.building.i}:${this.building.j}`)
    const horse = this.createSprite(MOUNTED_HORSE_STANDING_SHEET, 3, MAIN_PREVIEW_Z_INDEX + 20, scale, horseColor)
    const legs = this.createSprite(MOUNTED_RIDER_LEGS_SHEET, 3, MAIN_PREVIEW_Z_INDEX - 1, scale)
    const riderSheetId = getActionSheetId(unit)
    const rider = riderSheetId ? this.createSprite(riderSheetId, directionCount, MAIN_PREVIEW_Z_INDEX, scale) : null
    const riderSprites: AnimatedSprite[] = []
    const riderX = mountedRiderXOffset(MOUNTED_PREVIEW_DIRECTION)
    const legOffset = mountedRiderLegOffset(MOUNTED_PREVIEW_DIRECTION, scale)
    const syncLegsToRider = (bob = 0) => {
      if (!legs || !rider) return
      const body = getSpriteTopLeft(rider.sprite)
      legs.sprite.position.x = body.x + legOffset.x
      legs.sprite.position.y = body.y + legOffset.y + bob
    }

    if (legs) {
      legs.sprite.anchor.set(0, 0)
      legs.sprite.position.set(riderX + legOffset.x, MOUNTED_RIDER_Y_OFFSET + legOffset.y)
      legs.sprite.gotoAndStop(0)
      layers.push(legs)
    }

    if (rider) {
      rider.sprite.position.x = riderX
      rider.sprite.position.y = MOUNTED_RIDER_Y_OFFSET
      rider.sprite.gotoAndStop(0)
      riderSprites.push(rider.sprite)
      layers.push(rider)
      syncLegsToRider()
    }

    for (const layer of unit.appearance?.layers ?? []) {
      if (!isLayerUnlockedForPreview(layer, unit)) continue
      const layerSheetId = getLayerActionSheetId(layer, unit.work || getTrainingPreviewWork(unit.type), true)
      if (!layerSheetId) continue
      const layerDirectionCount = layer.sheetDirectionCounts?.[SHEET_TYPES.action] ?? directionCount
      const previewLayer = this.createSprite(layerSheetId, layerDirectionCount, layer.zIndex, scale)
      if (!previewLayer) continue
      previewLayer.sprite.position.x = riderX
      previewLayer.sprite.position.y = MOUNTED_RIDER_Y_OFFSET
      previewLayer.sprite.gotoAndStop(0)
      if (layer.mountedCut !== false) riderSprites.push(previewLayer.sprite)
      layers.push(previewLayer)
    }

    if (riderSprites.length) {
      const reference = riderSprites[0]
      const referenceTexture = reference.textures[0] as Texture | undefined
      const frameHeight = referenceTexture?.height || 64
      const maskTop = reference.position.y - reference.anchor.y * frameHeight * Math.abs(reference.scale.y || 1)
      const mask = new Graphics()
      mask.label = 'building-training-preview-mounted-rider-mask'
      mask.eventMode = 'none'
      mask.rect(-512, maskTop, 1024, MOUNTED_RIDER_CUT_Y * Math.abs(reference.scale.y || 1)).fill({ color: 0xffffff })
      this.container.addChild(mask)
      this.masks.push(mask)
      for (const sprite of riderSprites) {
        sprite.mask = mask
      }
    }

    if (horse) {
      horse.sprite.onFrameChange = frame => {
        const bob = MOUNTED_HORSE_BOB.south[frame % MOUNTED_HORSE_BOB.south.length] ?? 0
        for (const sprite of riderSprites) {
          sprite.position.x = riderX
          sprite.position.y = MOUNTED_RIDER_Y_OFFSET + bob
        }
        if (legs) {
          syncLegsToRider(bob)
        }
      }
      layers.push(horse)
    }

    return layers.sort((a, b) => a.zIndex - b.zIndex)
  }

  syncPosition(): void {
    const sprite = this.building.sprite
    const position = TRAINING_PREVIEW_POSITIONS[this.building.type]
    if (!position) return
    if (!sprite) return

    const left = sprite.x - sprite.anchor.x * sprite.width
    const top = sprite.y - sprite.anchor.y * sprite.height
    this.container.position.set(left + position.x, top + position.y)
  }

  clear(): void {
    this.stopLightPulse()
    for (const layer of this.layers) {
      layer.sprite.mask = null
      layer.sprite.parent?.removeChild(layer.sprite)
      layer.sprite.destroy({ children: true, texture: false })
    }
    for (const mask of this.masks) {
      mask.parent?.removeChild(mask)
      mask.destroy()
    }
    this.layers = []
    this.masks = []
    this.currentType = null
    this.currentPreviewKey = null
    this.container.visible = false
  }

  startLightPulse(): void {
    if (this.lightTaskId != null) return
    const scheduler = this.building.context?.scheduler
    if (!scheduler) {
      for (const layer of this.layers) {
        this.setLightIntensity(layer.lightFilter, TRAINING_PREVIEW_LIGHT_INTENSITY_MAX)
      }
      return
    }
    this.lightTaskId = scheduler.add(
      () => {
        const progress = (scheduler.elapsedMs % TRAINING_PREVIEW_LIGHT_PULSE_MS) / TRAINING_PREVIEW_LIGHT_PULSE_MS
        const wave = (Math.sin(progress * Math.PI * 2 - Math.PI / 2) + 1) / 2
        const intensity =
          TRAINING_PREVIEW_LIGHT_INTENSITY_MIN +
          (TRAINING_PREVIEW_LIGHT_INTENSITY_MAX - TRAINING_PREVIEW_LIGHT_INTENSITY_MIN) * wave
        for (const layer of this.layers) {
          this.setLightIntensity(layer.lightFilter, intensity)
        }
      },
      50,
      'building.trainingPreviewLight'
    )
  }

  stopLightPulse(): void {
    if (this.lightTaskId != null) {
      this.building.context?.scheduler?.remove(this.lightTaskId)
      this.lightTaskId = null
    }
  }

  update(): void {
    if (!TRAINING_PREVIEW_POSITIONS[this.building.type] || !this.building.owner?.isPlayed) {
      this.clear()
      return
    }

    const type = this.building.loading !== null ? (this.building.queue?.[0] ?? null) : null
    if (!type) {
      this.clear()
      return
    }
    const trainee = this.building.trainingType === type ? this.building.trainingUnit : null
    const previewKey = [
      type,
      trainee?.label ?? '',
      trainee?.appearanceVariants?.gender ?? '',
      JSON.stringify(trainee?.experience ?? {}),
    ].join(':')

    this.syncPosition()
    if (this.currentType === type && this.currentPreviewKey === previewKey) {
      this.container.visible = true
      this.startLightPulse()
      return
    }

    this.clear()
    this.currentType = type
    this.currentPreviewKey = previewKey
    this.layers = this.createLayers(type)
    for (const layer of this.layers) {
      this.container.addChild(layer.sprite)
    }
    this.container.visible = this.layers.length > 0
    if (this.layers.length) this.startLightPulse()
  }

  destroy(): void {
    this.clear()
    this.container.parent?.removeChild(this.container)
    this.container.destroy({ children: true })
  }
}
