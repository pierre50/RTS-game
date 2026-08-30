import { Assets } from 'pixi.js'
import { dynamicEquipmentAliases, dynamicEquipmentAsset } from './equipment'
import { lpcAnimationSpeedForAlias, lpcAnimationSpeedForSheet } from './animationSpeeds'
import {
  bakedLogicalAliases,
  bakedVariantAtlasAlias,
  bakedVariantAtlasSrc,
  type BakedUnitType,
} from './bakedAliases'
import type { SpritesheetLike } from '../../types/pixi'
import type { DynamicEquipmentKey } from './equipmentData'

const BAKED_MELEE_ACTION_UNITS = ['/infantry/', '/chief/', '/bandit_chief/', '/bandit_sword/'] as const

export function isAssetCached(alias: string): boolean {
  return Assets.cache.has(alias)
}

function bakedFrameSuffix(alias: string): string {
  return `_graphics_${alias.split('/').join('_')}.png`
}

function bakedSheetAnimationSpeed(alias: string): number {
  if (alias.endsWith('/action')) {
    return lpcAnimationSpeedForSheet('action', {
      slashAction: BAKED_MELEE_ACTION_UNITS.some(unitPath => alias.includes(unitPath)),
    })
  }
  return lpcAnimationSpeedForAlias(alias)
}

function registerAliasFromAtlas(alias: string, atlasAlias: string): void {
  if (isAssetCached(alias)) return
  const atlas = Assets.cache.get(atlasAlias) as SpritesheetLike | undefined
  if (!atlas?.textures) return
  const frameSuffix = bakedFrameSuffix(alias)
  const textures = Object.fromEntries(
    Object.entries(atlas.textures).filter(([frameName]) => frameName.endsWith(frameSuffix))
  )
  if (!Object.keys(textures).length) return
  const frames = Object.fromEntries(
    Object.entries(atlas.data?.frames ?? {}).filter(([frameName]) => frameName.endsWith(frameSuffix))
  )
  Assets.cache.set(alias, {
    ...atlas,
    data: {
      ...atlas.data,
      animationSpeed: bakedSheetAnimationSpeed(alias),
      frames,
    },
    textures,
  })
}

function registerBakedUnitVariantAliases(unit: BakedUnitType, variant: string): void {
  const atlasAlias = bakedVariantAtlasAlias(unit, variant)
  for (const alias of bakedLogicalAliases(unit, variant)) {
    registerAliasFromAtlas(alias, atlasAlias)
  }
}

export function registerDynamicEquipmentAliases(atlasAliases?: ReadonlySet<string>): void {
  for (const { alias, atlasAlias, animationSpeed, frameSuffix } of dynamicEquipmentAliases()) {
    if (atlasAliases && !atlasAliases.has(atlasAlias)) continue
    if (isAssetCached(alias)) continue
    const atlas = Assets.cache.get(atlasAlias) as SpritesheetLike | undefined
    if (!atlas?.textures) continue
    const textures = Object.fromEntries(
      Object.entries(atlas.textures).filter(([frameName]) => frameName.endsWith(frameSuffix))
    )
    if (!Object.keys(textures).length) continue
    const frames = Object.fromEntries(
      Object.entries(atlas.data?.frames ?? {}).filter(([frameName]) => frameName.endsWith(frameSuffix))
    )
    Assets.cache.set(alias, {
      ...atlas,
      data: {
        ...atlas.data,
        animationSpeed,
        frames,
      },
      textures,
    })
  }
}

export async function loadDynamicEquipmentAsset(equipment: DynamicEquipmentKey): Promise<void> {
  const asset = dynamicEquipmentAsset(equipment)
  if (!isAssetCached(asset.alias)) {
    await Assets.load(asset)
  }
  registerDynamicEquipmentAliases(new Set([asset.alias]))
}

export async function loadBakedUnitVariant(unit: BakedUnitType, variant: string): Promise<void> {
  const atlasAlias = bakedVariantAtlasAlias(unit, variant)
  if (!isAssetCached(atlasAlias)) {
    await Assets.load({
      alias: atlasAlias,
      src: bakedVariantAtlasSrc(unit, variant),
    })
  }
  registerBakedUnitVariantAliases(unit, variant)
}
