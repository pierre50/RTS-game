import { getHouseResidents } from '../../lib/housing/households'
import { FAMILY_TYPES } from '../../constants'
import { t } from '../../lib/lang'
import type { BuildingEntity, RuntimeEntity } from '../../types/entities'

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

function getBuildingDisplayType(building: BuildingEntity): string {
  return building.type || building.assetType || ''
}

export function getBuildingDisplayName(building: BuildingEntity): string {
  const typeName = translateTypeKey(getBuildingDisplayType(building))
  const title =
    building.type === 'TownCenter' && building.settlementName ? `${building.settlementName} — ${typeName}` : typeName
  if (!building.isBuilt) return t('constructionSiteName', { building: title })
  if (building.type === 'TownCenter') return title
  if (building.type === 'House') {
    const names = getHouseResidents(building.owner, building).map(unit => unit.name || t(unit.type ?? 'Villager'))
    if (names.length === 1) return t('houseOfOne', { name: names[0] })
    if (names.length > 1) return t('houseOfTwo', { first: names[0], second: names[1] })
    return t('houseUnoccupied')
  }
  return translateTypeKey(getBuildingDisplayType(building))
}

export function getEntityDisplayName(entity: RuntimeEntity): string {
  if (entity.family === FAMILY_TYPES.building) return getBuildingDisplayName(entity as BuildingEntity)
  if (entity.family === FAMILY_TYPES.resource) return translateTypeKey(entity.type)
  if (entity.family === FAMILY_TYPES.animal) return translateTypeKey(entity.type)
  if (entity.name) return entity.name
  return translateTypeKey((entity as { assetType?: string }).assetType || entity.type)
}
