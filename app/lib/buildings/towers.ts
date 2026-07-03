import { Assets, Texture } from 'pixi.js'
import { BUILDING_TYPES, LABEL_TYPES } from '../../constants'
import { getBuildingAsset, getTexture, changeSpriteColorDirectly } from '../index'

type TowerOwner = {
  age: number
  civ: string
  color?: string
  config?: {
    buildings: Record<string, Partial<TowerBuilding>>
  }
  technologies?: string[]
}

type TowerBuilding = {
  getChildByLabel: (label: string) => { destroy: () => void } | null
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
    _baseColorTextureKey?: string
    anchor: { set: (x: number, y: number) => void }
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

export function getTowerAssets(owner: TowerOwner, assets = Assets) {
  return getBuildingAsset(getTowerType(owner), owner, assets)
}

export function refreshTower(tower?: TowerBuilding | null): void {
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

  const assets = getBuildingAsset(effectiveType, tower.owner, Assets)
  if (!assets.images?.final) return
  tower.sprite.texture = getTexture(assets.images.final, Assets)
  tower.sprite.anchor.set(tower.sprite.texture.defaultAnchor?.x ?? 0, tower.sprite.texture.defaultAnchor?.y ?? 0)

  const color = tower.getChildByLabel(LABEL_TYPES.color)
  if (color) color.destroy()
  delete tower.sprite._baseColorTextureKey
  changeSpriteColorDirectly(tower.sprite as never, tower.owner.color ?? 'blue')
}

export function refreshOwnerTowers(owner?: (TowerOwner & { buildings?: TowerBuilding[] }) | null): void {
  owner?.buildings?.filter(isTower).forEach(refreshTower)
}
