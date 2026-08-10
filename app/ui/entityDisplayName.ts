import { FAMILY_TYPES } from '../constants'
import { getTowerType, isTower } from '../lib/buildings/towers'
import { t } from '../lib/lang'
import type { BuildingEntity, RuntimeEntity } from '../types/entities'

function humanizeTypeKey(key: string): string {
  const leaf = key.split('/').filter(Boolean).pop() || key
  return leaf
    .replace(/[-_]+/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, char => char.toUpperCase())
}

function translateTypeKey(key: string | undefined): string {
  if (!key) return ''
  const translated = t(key)
  return translated === key ? humanizeTypeKey(key) : translated
}

export function getBuildingDisplayType(building: BuildingEntity): string {
  if (isTower(building)) return getTowerType(building.owner)
  return building.type || building.assetType || ''
}

export function getBuildingDisplayName(building: BuildingEntity): string {
  return translateTypeKey(getBuildingDisplayType(building))
}

export function getEntityDisplayName(entity: RuntimeEntity): string {
  if (entity.family === FAMILY_TYPES.building) return getBuildingDisplayName(entity as BuildingEntity)
  if (entity.family === FAMILY_TYPES.resource) return translateTypeKey(entity.type)
  if (entity.family === FAMILY_TYPES.animal) return translateTypeKey(entity.type)
  if (entity.name) return entity.name
  return translateTypeKey((entity as { assetType?: string }).assetType || entity.type)
}
