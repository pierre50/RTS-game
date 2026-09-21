import { Assets, Sprite, type Texture } from 'pixi.js'
import { getAnimationFrames } from '../entities/spriteFrameSelection'
import type { BuildingEntity } from '../../types/entities'

type TrapPreyConfig = {
  assets?: { dyingSheet?: string }
  sheetDirectionCounts?: { dyingSheet?: number }
  spriteScale?: number
}

const TRAP_PREY_LABEL = 'trap-prey-preview'

export function clearTrapPreyVisual(building: BuildingEntity): void {
  building.getChildByLabel?.(TRAP_PREY_LABEL)?.destroy()
}

/** A decoration only: the gatherable animal is created when the trap is dismantled. */
export function syncTrapPreyVisual(building: BuildingEntity): void {
  const type = building.containedAnimalType
  if (!type || building.isDead || building.isDestroyed) {
    clearTrapPreyVisual(building)
    return
  }
  if (!building.addChildAt || !building.sprite) return
  const config = building.context?.map.gaia?.config?.animals?.[type] as TrapPreyConfig | undefined
  const sheetId = config?.assets?.dyingSheet
  if (!sheetId || !Assets.cache.has(sheetId)) return
  const sheet = Assets.cache.get(sheetId) as { textures?: Record<string, Texture> } | undefined
  if (!sheet?.textures) return
  const frames = getAnimationFrames(sheet.textures, 'south', config?.sheetDirectionCounts?.dyingSheet ?? 1)
  const texture = frames[frames.length - 1]
  if (!texture) return
  let preview = building.getChildByLabel?.(TRAP_PREY_LABEL) as Sprite | null | undefined
  if (!preview) {
    preview = new Sprite(texture)
    preview.label = TRAP_PREY_LABEL
    preview.eventMode = 'none'
    preview.roundPixels = true
    building.addChildAt(preview, 0)
  }
  preview.texture = texture
  if (texture.defaultAnchor) preview.anchor.copyFrom(texture.defaultAnchor)
  preview.scale.set(config?.spriteScale ?? 1)
  preview.position.copyFrom(building.sprite.position)
  preview.zIndex = building.sprite.zIndex - 1
}
