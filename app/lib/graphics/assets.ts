import type { AssetAge } from '../../types/pixi'
import type { ConfigValue } from '../../types/config'
import type { TextureRef } from './textures'

export type BuildingAsset = {
  images?: {
    final?: TextureRef
    [key: string]: TextureRef | undefined
  }
  [key: string]: ConfigValue | { final?: TextureRef; [key: string]: TextureRef | undefined }
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

const INTERFACE_ICON_SHEETS: Record<string, string> = {
  '50704': 'building-icons/egyptian',
  '50705': 'building-icons/greek',
  '50706': 'building-icons/babylonian',
  '50707': 'building-icons/asian',
  '50721': 'command-icons',
  '50729': 'technology-icons',
  '50730': 'unit-icons',
  '50731': 'attribute-icons',
  '50732': 'commodity-icons',
  '50733': 'animal-icons',
  '51000': 'pointers/main',
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
  const sheet = INTERFACE_ICON_SHEETS[id] || id
  return `assets/interface/${sheet}/${index}.png`
}

export function getBuildingTextureNameWithSize(size: number): TextureRef | undefined {
  switch (size) {
    case 1:
      return { sheet: 'buildings/construction/size-1', frame: 0 }
    case 2:
      return { sheet: 'buildings/construction/size-2', frame: 0 }
    default:
      // No dedicated construction art beyond a 3-cell footprint yet; reuse the largest available.
      return { sheet: 'buildings/construction/size-3', frame: 0 }
  }
}

export function getBuildingRubbleTextureNameWithSize(size: number): TextureRef | undefined {
  switch (size) {
    case 1:
      return { sheet: 'buildings/rubble/size-1', frame: 0 }
    case 2:
      return { sheet: 'buildings/rubble/size-2', frame: 0 }
    default:
      // No dedicated rubble art beyond a 3-cell footprint yet; reuse the largest available.
      return { sheet: 'buildings/rubble/size-3', frame: 0 }
  }
}

export function getBuildingAsset(type: string, owner: AssetOwner, assets: AssetCacheLike): BuildingAsset {
  const path = assets.cache.get((owner.civ || '').toLowerCase())?.buildings ?? assets.cache.get('greek').buildings
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
