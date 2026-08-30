import { Assets } from 'pixi.js'
import type { SpritesheetLike } from '../../types/pixi'

type AnimalDefinition = {
  assets?: Record<string, string>
}

export type AnimalConfigMap = Record<string, AnimalDefinition>

const ANIMAL_PREFIX = 'animals/'

function isAssetCached(alias: string): boolean {
  return Assets.cache.has(alias)
}

function registerAnimalSheetAlias(alias: string, atlasAlias: string, sheetName: string): void {
  if (isAssetCached(alias)) return

  const atlas = Assets.cache.get(atlasAlias) as SpritesheetLike | undefined
  if (!atlas?.textures) return

  const frameSuffix = `_graphics_${atlasAlias.replaceAll('/', '_')}_${sheetName}.png`
  const textures = Object.fromEntries(
    Object.entries(atlas.textures).filter(([frameName]) => frameName.endsWith(frameSuffix))
  )

  if (!Object.keys(textures).length) return

  const sourceFrames = atlas.data?.frames ?? {}
  const frames = Object.fromEntries(
    Object.entries(sourceFrames as Record<string, Record<string, unknown>>).filter(([frameName]) =>
      frameName.endsWith(frameSuffix)
    )
  )

  const sheetSpeedData = atlas.data as
    | {
        animalAnimationSpeeds?: Record<string, number>
        meta?: { animalAnimationSpeeds?: Record<string, number> }
      }
    | undefined
  const fallbackSpeed = typeof atlas.data?.animationSpeed === 'number' ? atlas.data.animationSpeed : 0.4
  const animalAnimationSpeeds = sheetSpeedData?.animalAnimationSpeeds ?? sheetSpeedData?.meta?.animalAnimationSpeeds
  const animationSpeed =
    typeof animalAnimationSpeeds?.[sheetName] === 'number' ? animalAnimationSpeeds[sheetName] : fallbackSpeed

  Assets.cache.set(alias, {
    ...atlas,
    data: {
      ...(atlas.data as Record<string, unknown>),
      animationSpeed,
      frames,
    },
    textures,
  })
}

export function registerAnimalSheetAliases(animals: AnimalConfigMap | undefined): void {
  if (!animals) return

  const registered = new Set<string>()

  for (const animalConfig of Object.values(animals)) {
    const assetRefs = animalConfig?.assets
    if (!assetRefs || typeof assetRefs !== 'object') continue

    for (const alias of Object.values(assetRefs)) {
      if (typeof alias !== 'string' || !alias.startsWith(ANIMAL_PREFIX)) continue
      if (registered.has(alias) || isAssetCached(alias)) {
        registered.add(alias)
        continue
      }

      const parts = alias.split('/')
      if (parts.length !== 3) continue

      const atlasAlias = `${parts[0]}/${parts[1]}`
      const sheetName = parts[2]
      registerAnimalSheetAlias(alias, atlasAlias, sheetName)
      registered.add(alias)
    }
  }
}
