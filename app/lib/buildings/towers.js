import { Assets, Sprite } from 'pixi.js'
import { BUILDING_TYPES, LABEL_TYPES } from '../../constants'
import { getBuildingAsset, getTexture, changeSpriteColorDirectly } from '../index'

export function getTowerType(owner) {
  if (owner?.technologies?.includes('ResearchBallistaTower')) return 'BallistaTower'
  if (owner?.technologies?.includes('ResearchGuardTower')) return 'GuardTower'
  if (owner?.technologies?.includes('ResearchSentryTower')) return 'SentryTower'
  return 'WatchTower'
}

export function isTower(instance) {
  return instance?.type === BUILDING_TYPES.watchTower
}

export function getTowerAssets(owner, assets = Assets) {
  return getBuildingAsset(getTowerType(owner), owner, assets)
}

export function refreshTower(tower) {
  if (!isTower(tower) || tower.isDestroyed) return

  const effectiveType = getTowerType(tower.owner)
  const data = tower.owner.config.buildings[effectiveType]
  if (!data) return

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
  tower.sprite.texture = getTexture(assets.images.final, Assets)
  tower.sprite.anchor.set(tower.sprite.texture.defaultAnchor.x, tower.sprite.texture.defaultAnchor.y)

  const color = tower.getChildByLabel(LABEL_TYPES.color)
  if (color) color.destroy()

  if (assets.images.color) {
    const spriteColor = Sprite.from(getTexture(assets.images.color, Assets))
    spriteColor.label = LABEL_TYPES.color
    changeSpriteColorDirectly(spriteColor, tower.owner.color)
    tower.addChild(spriteColor)
  } else {
    changeSpriteColorDirectly(tower.sprite, tower.owner.color)
  }
}

export function refreshOwnerTowers(owner) {
  owner?.buildings?.filter(isTower).forEach(refreshTower)
}
