import type { AssetAge } from '../../types/pixi'
import type { ConfigValue } from '../../types/config'

export type BuildingAsset = {
  images?: {
    final?: string
    [key: string]: string | undefined
  }
  [key: string]: ConfigValue | { final?: string; [key: string]: string | undefined }
}

type CivAssets = {
  buildings: Array<Record<string, BuildingAsset> | undefined>
}

type AssetCacheLike = {
  cache: {
    get: (id: string) => CivAssets
  }
}

export type AssetOwner = {
  age: number
  civ?: string
}

export type BuildingWithAssetOwner = {
  assetAge?: AssetAge
  assetCiv?: string
  owner: {
    age: number
    civ?: string
  }
}

export function getIconPath(name: string): string {
  const id = name.split('_')[1]
  const index = name.split('_')[0]
  return `assets/interface/${id}/${index}_${id}.png`
}

export function getBuildingTextureNameWithSize(size: number): string | undefined {
  switch (size) {
    case 1:
      return '000_256'
    case 2:
      return '000_258'
    case 3:
      return '000_261'
  }
}

export function getBuildingRubbleTextureNameWithSize(size: number): string | undefined {
  switch (size) {
    case 1:
      return '000_153'
    case 2:
      return '000_154'
    case 3:
      return '000_155'
  }
}

export function getBuildingAsset(type: string, owner: AssetOwner, assets: AssetCacheLike): BuildingAsset {
  const path = assets.cache.get((owner.civ || '').toLowerCase()).buildings
  const assetAt = (age: number) => path[age]?.[type]
  const fallbackAges = [owner.age, owner.age - 1, owner.age - 2, 0, owner.age + 1, owner.age + 2, owner.age + 3]

  for (const age of fallbackAges) {
    if (age < 0) continue
    const asset = assetAt(age)
    if (asset) return asset
  }

  throw new Error(`Missing building asset for ${owner.civ || 'default'} ${type} at age ${owner.age}`)
}

export function getBuildingAssetOwner(building: BuildingWithAssetOwner): AssetOwner {
  const age = typeof building.assetAge === 'number' ? building.assetAge : building.owner.age
  return {
    civ: building.assetCiv || building.owner.civ || '',
    age,
  }
}
