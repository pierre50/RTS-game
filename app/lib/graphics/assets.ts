import { getBuildingLevel } from '../buildings/buildingLevel'
import type { AssetLevel } from '../../types/pixi'
import type { ConfigValue } from '../../types/config'
import type { TextureRef } from './textures'
import { civilizationAssetSlug } from '../civilizationAlias'

export type BuildingAsset = {
  animated?: boolean
  mirrored?: boolean
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

function staticDecoBuildingAsset(frame: number): BuildingAsset {
  return { animated: false, images: { final: { sheet: 'buildings/deco', frame } } }
}

const DECO_BUILDING_ASSETS: Record<string, BuildingAsset> = {
  FireCamp: staticDecoBuildingAsset(0),
  CampTotemPlain: staticDecoBuildingAsset(1),
  CampTotemHorns: staticDecoBuildingAsset(2),
  CampTotemSkull: staticDecoBuildingAsset(3),
  CampFencePost: staticDecoBuildingAsset(4),
  CampBoneSmall: staticDecoBuildingAsset(5),
  CampRockPile: staticDecoBuildingAsset(6),
  CampSkull: staticDecoBuildingAsset(7),
  CampAnimalBones: staticDecoBuildingAsset(8),
  CampMeatRack: staticDecoBuildingAsset(9),
  CampDryingRack: staticDecoBuildingAsset(10),
  CampBucket: staticDecoBuildingAsset(11),
  CampCrate: staticDecoBuildingAsset(12),
  CampJarSmall: staticDecoBuildingAsset(13),
  CampJarLarge: staticDecoBuildingAsset(14),
  Trap: staticDecoBuildingAsset(15),
  Chest: staticDecoBuildingAsset(16),
  InteriorMirroredChest: { ...staticDecoBuildingAsset(16), mirrored: true },
  CampHide: staticDecoBuildingAsset(17),
  CampRug: staticDecoBuildingAsset(18),
  CampFur: staticDecoBuildingAsset(41),
  CampBedroll: staticDecoBuildingAsset(19),
  CampTable: staticDecoBuildingAsset(21),
  CampWorkbench: staticDecoBuildingAsset(22),
  CampForge: staticDecoBuildingAsset(24),
  CampAlchemyTable: staticDecoBuildingAsset(25),
  CampSupplyShelf: staticDecoBuildingAsset(26),
  InteriorMirroredSupplyShelf: { ...staticDecoBuildingAsset(26), mirrored: true },
  CampBookcase: staticDecoBuildingAsset(27),
  CampArrowBasket: staticDecoBuildingAsset(28),
  CampAppleBasket: staticDecoBuildingAsset(29),
  CampBench: staticDecoBuildingAsset(31),
  CampRoundStool: staticDecoBuildingAsset(32),
  CampChair: staticDecoBuildingAsset(34),
  CampThrone: staticDecoBuildingAsset(35),
  CampBrazier: staticDecoBuildingAsset(36),
  CampBlueJar: staticDecoBuildingAsset(40),
  CampScreen: staticDecoBuildingAsset(42),
  CampWeavingTable: staticDecoBuildingAsset(23),
  CampSquareStool: staticDecoBuildingAsset(30),
  CampStumpStool: staticDecoBuildingAsset(33),
  CampMountedSkull: staticDecoBuildingAsset(37),
  CampTorchStand: staticDecoBuildingAsset(38),
  CampFruitBowl: staticDecoBuildingAsset(39),
  Cave: { animated: false, images: { final: { sheet: 'buildings/cave', frame: 0 } } },
}

export type AssetOwner = {
  level?: number
  civ?: string
}

const INTERFACE_ICON_SHEETS: Record<string, string> = {
  '50721': 'command-icons',
  '50731': 'attribute-icons',
  '50732': 'commodity-icons',
  '51000': 'pointers/main',
}

export type BuildingWithAssetOwner = {
  buildingLevel?: number
  assetLevel?: AssetLevel
  assetCiv?: string
  owner: {
    civ?: string
  }
}

export function getIconPath(name: string): string {
  const id = name.split('_')[1]
  const index = name.split('_')[0]
  const sheet = INTERFACE_ICON_SHEETS[id] || id
  return `assets/interface/${sheet}/${index}.png`
}

export function getBuildingAsset(type: string, owner: AssetOwner, assets: AssetCacheLike): BuildingAsset {
  if (type === 'Farm') return { images: { final: { sheet: 'resources/wheat', frame: 0 } } }
  const decoAsset = DECO_BUILDING_ASSETS[type]
  if (decoAsset) return decoAsset

  const path = assets.cache.get(civilizationAssetSlug(owner.civ))?.buildings ?? assets.cache.get('hellas').buildings
  const assetAt = (level: number) => path[level]?.[type]
  const level = owner.level ?? 0
  const fallbackLevels = [level, level - 1, level - 2, 0, level + 1, level + 2]

  for (const level of fallbackLevels) {
    if (level < 0) continue
    const asset = assetAt(level)
    if (asset) return asset
  }

  throw new Error(`Missing building asset for ${owner.civ || 'default'} ${type} at level ${owner.level}`)
}

export function getBuildingAssetOwner(building: BuildingWithAssetOwner): AssetOwner {
  const level = getBuildingLevel(building)
  return {
    civ: building.assetCiv || building.owner.civ || '',
    level,
  }
}
