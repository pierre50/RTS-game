import { Assets } from 'pixi.js'
import type { Filter, Texture } from 'pixi.js'
import { BUILDING_TYPES, LABEL_TYPES } from '../../constants'
import { getBuildingAsset, getTexture, changeSpriteColorDirectly } from '../index'
import type { BuildingConfig } from '../../types/config'
import type { RecolorableSprite } from '../graphics/colors'

type TowerBuildingConfig = BuildingConfig & Partial<TowerBuilding>

type TowerOwner = {
  age: number
  civ?: string
  color?: string
  config?: {
    buildings: Record<string, TowerBuildingConfig>
  }
  technologies?: string[]
}

type TowerBuilding = {
  getChildByLabel?: (label: string) => { destroy?: () => void } | null | unknown
  hitPoints: number
  isBuilt?: boolean
  isDestroyed?: boolean
  owner: TowerOwner
  pierceAttack?: number
  projectile?: string
  range?: number
  rateOfFire?: number
  sight?: number
  sprite?: {
    anchor: { set: (x: number, y: number) => void }
    filters: readonly Filter[] | null
    texture: Texture
    [key: string]: unknown
  }
  totalHitPoints: number
  type?: string
}

export function getTowerType(owner?: TowerOwner | null): string {
  if (owner?.technologies?.includes('ResearchBallistaTower')) return 'BallistaTower'
  if (owner?.technologies?.includes('ResearchGuardTower')) return 'GuardTower'
  if (owner?.technologies?.includes('ResearchSentryTower')) return 'SentryTower'
  return 'WatchTower'
}

export function isTower(instance?: { type?: string } | null): instance is TowerBuilding {
  return instance?.type === BUILDING_TYPES.watchTower
}

function isTowerCandidate(instance: unknown): instance is { type?: string } {
  return typeof instance === 'object' && instance !== null
}

function refreshTower(tower?: TowerBuilding | null): void {
  if (!isTower(tower) || tower.isDestroyed) return

  const effectiveType = getTowerType(tower.owner)
  const data = tower.owner.config?.buildings[effectiveType]
  if (!data || data.totalHitPoints == null) return

  const ratio = tower.totalHitPoints > 0 ? tower.hitPoints / tower.totalHitPoints : 1
  tower.sight = data.sight
  tower.range = data.range
  tower.projectile = data.projectile
  tower.pierceAttack = data.pierceAttack
  tower.rateOfFire = data.rateOfFire
  tower.totalHitPoints = data.totalHitPoints
  tower.hitPoints = Math.min(Math.round(ratio * data.totalHitPoints), data.totalHitPoints)

  if (!tower.sprite || !tower.isBuilt) return

  const assets = getBuildingAsset(effectiveType, { ...tower.owner, civ: tower.owner.civ || '' }, Assets)
  if (!assets.images?.final) return
  tower.sprite.texture = getTexture(assets.images.final, Assets)
  tower.sprite.anchor.set(tower.sprite.texture.defaultAnchor?.x ?? 0, tower.sprite.texture.defaultAnchor?.y ?? 0)

  const color = tower.getChildByLabel?.(LABEL_TYPES.color)
  if (color && typeof color === 'object' && 'destroy' in color && typeof color.destroy === 'function') color.destroy()
  changeSpriteColorDirectly(tower.sprite as RecolorableSprite, tower.owner.color ?? 'blue')
}

export function refreshOwnerTowers(owner?: (TowerOwner & { buildings?: unknown[] }) | null): void {
  owner?.buildings
    ?.filter((building): building is TowerBuilding => isTowerCandidate(building) && isTower(building))
    .forEach(refreshTower)
}
