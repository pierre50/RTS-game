import { Assets } from 'pixi.js'
import { randomRange, parseTextureRef } from '../lib'
import type { ResourceConfig } from '../types/config'
import type { RuntimeEntity, UnitSounds } from '../types/entities'
import type { PlayerLike } from '../types/player'
import type { TextureRef } from '../lib'

export type ResourceAssetList = TextureRef[]
type ResourceAssetsByTerrain = Record<string, ResourceAssetList>
export type ResourceAssets = string | TextureRef | ResourceAssetList | ResourceAssetsByTerrain
export type ResourceLifecycleAsset =
  | string
  | {
      sheet: string
      frames?: number[]
    }
export type ResourceDefinition = ResourceConfig & {
  assets: ResourceAssets
  lifecycleAssets?: {
    fallen?: ResourceLifecycleAsset
    cut?: ResourceLifecycleAsset
  }
  isAnimated?: boolean
  sounds?: UnitSounds
}
export type ResourceOptions = Partial<ResourceDefinition> & {
  currentFrame?: number
  i: number
  isNaturalResource?: boolean
  j: number
  berrybushFullTextureName?: string
  type: string
  textureName?: string
  startsMature?: boolean
}
export type ResourceConfigCache = {
  resources: Record<string, ResourceDefinition>
  units: {
    Villager: {
      sounds: UnitSounds
    }
  }
}
export type PlayerWithResourceMemory = PlayerLike & Record<string, Set<RuntimeEntity> | undefined>

export const BERRYBUSH_SHEET_ID = 'resources/berrybush'
export const EMPTY_BERRYBUSH_FRAME = 0

const RESOURCE_TEXTURE_MIGRATIONS: Record<string, { sheet: string; frameOffset: number }> = {
  'resources/tree/grass-1': { sheet: 'resources/tree/grass', frameOffset: 0 },
  'resources/tree/grass-2': { sheet: 'resources/tree/grass', frameOffset: 1 },
  'resources/tree/grass-3': { sheet: 'resources/tree/grass', frameOffset: 2 },
  'resources/tree/grass-4': { sheet: 'resources/tree/grass', frameOffset: 3 },
  'resources/tree/palm-1': { sheet: 'resources/tree/palm', frameOffset: 0 },
  'resources/tree/palm-2': { sheet: 'resources/tree/palm', frameOffset: 1 },
  'resources/tree/palm-3': { sheet: 'resources/tree/palm', frameOffset: 2 },
  'resources/tree/palm-4': { sheet: 'resources/tree/palm', frameOffset: 3 },
  'resources/tree/dark-forest-1': { sheet: 'resources/tree/dark-forest', frameOffset: 0 },
  'resources/tree/dark-forest-2': { sheet: 'resources/tree/dark-forest', frameOffset: 1 },
  'resources/tree/dark-forest-3': { sheet: 'resources/tree/dark-forest', frameOffset: 2 },
  'resources/tree/dark-forest-4': { sheet: 'resources/tree/dark-forest', frameOffset: 3 },
  'resources/tree/fallen': { sheet: 'resources/tree/dead', frameOffset: 0 },
  'resources/tree/stump': { sheet: 'resources/tree/dead', frameOffset: 4 },
  'resources/gold': { sheet: 'resources/minerals', frameOffset: 0 },
  'resources/stone': { sheet: 'resources/minerals', frameOffset: 3 },
  'resources/copper': { sheet: 'resources/minerals', frameOffset: 6 },
  'resources/iron': { sheet: 'resources/minerals', frameOffset: 9 },
}

export function getResourceConfig(): ResourceConfigCache {
  return Assets.cache.get('config') as ResourceConfigCache
}

export function getTerrainAssets(
  assets: ResourceAssets | undefined,
  terrainType: string
): string | TextureRef | ResourceAssetList | undefined {
  if (!assets) return undefined
  if (typeof assets === 'string' || Array.isArray(assets)) return assets
  if ('sheet' in assets) return assets as TextureRef
  const terrainAssets = assets as ResourceAssetsByTerrain
  return terrainAssets[terrainType] || Object.values(terrainAssets).find(value => Array.isArray(value))
}

export function normalizeResourceTextureRef(ref: TextureRef): TextureRef {
  const parsed = parseTextureRef(ref)
  const migration = RESOURCE_TEXTURE_MIGRATIONS[parsed.sheet]
  if (!migration) return ref
  return {
    sheet: migration.sheet,
    frame: migration.frameOffset + Math.max(0, parsed.frame),
  }
}

export function pickLifecycleTextureRef(asset: ResourceLifecycleAsset | undefined): TextureRef | null {
  if (!asset) return null
  if (typeof asset === 'string') {
    return normalizeResourceTextureRef({ sheet: asset, frame: randomRange(0, 3) })
  }
  const frames = asset.frames?.length ? asset.frames : [0]
  return {
    sheet: asset.sheet,
    frame: frames[randomRange(0, frames.length - 1)],
  }
}
