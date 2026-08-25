import { Assets } from 'pixi.js'
import type { UnitAppearanceLayerConfig } from '../../types/config'
import type { PlayerLike } from '../../types/player'
import type { SpritesheetLike } from '../../types/pixi'

const HERO_APPEARANCE_BASE_URL = 'assets/graphics/lpc-hero'
const HERO_APPEARANCE_ALIAS_PREFIX = 'lpc-hero'
const HERO_HAIR_SOURCE_PALETTE = 'brown_hair'

export type HeroHairColor = 'black' | 'dark_brown' | 'brown_hair' | 'light_brown' | 'blond' | 'white'
export type HeroAppearanceGender = 'male' | 'female'

export type HeroAppearanceConfig = {
  hairStyle: string
  hairColor: HeroHairColor
}

export const HERO_HAIR_COLOR_OPTIONS: readonly HeroHairColor[] = [
  'black',
  'dark_brown',
  'brown_hair',
  'light_brown',
  'blond',
  'white',
]

export const HERO_HAIR_STYLE_OPTIONS: Record<HeroAppearanceGender, readonly string[]> = {
  male: [
    'plain',
    'buzzcut',
    'page2',
    'swoop',
    'bob',
    'bob_side_part',
    'long_messy',
    'ponytail',
    'curly_short',
    'jewfro',
    'cornrows',
    'dreadlocks_short',
  ],
  female: [
    'plain',
    'braid',
    'long_center_part',
    'long_tied',
    'wavy',
    'ponytail',
    'ponytail2',
    'half_up',
    'curly_long',
    'dreadlocks_long',
    'xlong',
  ],
}

const HERO_CIV_DEFAULT_HAIR: Record<string, Record<HeroAppearanceGender, HeroAppearanceConfig>> = {
  greek: {
    male: { hairStyle: 'page2', hairColor: 'dark_brown' },
    female: { hairStyle: 'braid', hairColor: 'dark_brown' },
  },
  roman: {
    male: { hairStyle: 'buzzcut', hairColor: 'dark_brown' },
    female: { hairStyle: 'long_center_part', hairColor: 'dark_brown' },
  },
  egyptian: {
    male: { hairStyle: 'bob', hairColor: 'black' },
    female: { hairStyle: 'long_center_part', hairColor: 'black' },
  },
  babylonian: {
    male: { hairStyle: 'jewfro', hairColor: 'black' },
    female: { hairStyle: 'long_center_part', hairColor: 'black' },
  },
  asian: {
    male: { hairStyle: 'ponytail', hairColor: 'black' },
    female: { hairStyle: 'long_tied', hairColor: 'black' },
  },
  celtic: {
    male: { hairStyle: 'swoop', hairColor: 'brown_hair' },
    female: { hairStyle: 'wavy', hairColor: 'brown_hair' },
  },
  nordic: {
    male: { hairStyle: 'bob_side_part', hairColor: 'blond' },
    female: { hairStyle: 'braid', hairColor: 'blond' },
  },
  nubian: {
    male: { hairStyle: 'cornrows', hairColor: 'black' },
    female: { hairStyle: 'xlong', hairColor: 'black' },
  },
}

function normalizeCiv(civ?: string | null): string {
  return (civ || 'Greek').toLowerCase()
}

export function normalizeHeroAppearanceGender(gender?: string | null): HeroAppearanceGender {
  return gender === 'female' ? 'female' : 'male'
}

export function defaultHeroAppearance(civ?: string | null, gender?: string | null): HeroAppearanceConfig {
  const normalizedGender = normalizeHeroAppearanceGender(gender)
  const defaults = HERO_CIV_DEFAULT_HAIR[normalizeCiv(civ)]?.[normalizedGender]
  return { ...(defaults ?? HERO_CIV_DEFAULT_HAIR.greek[normalizedGender]) }
}

export function normalizeHeroAppearance(
  appearance: HeroAppearanceConfig | null | undefined,
  civ?: string | null,
  gender?: string | null
): HeroAppearanceConfig {
  const normalizedGender = normalizeHeroAppearanceGender(gender)
  const defaults = defaultHeroAppearance(civ, normalizedGender)
  const styles = HERO_HAIR_STYLE_OPTIONS[normalizedGender]
  const hairStyle = appearance?.hairStyle && styles.includes(appearance.hairStyle) ? appearance.hairStyle : defaults.hairStyle
  const hairColor =
    appearance?.hairColor && HERO_HAIR_COLOR_OPTIONS.includes(appearance.hairColor)
      ? appearance.hairColor
      : defaults.hairColor
  return { hairStyle, hairColor }
}

function hairAtlasAlias(appearance: HeroAppearanceConfig, gender: HeroAppearanceGender): string {
  return `${HERO_APPEARANCE_ALIAS_PREFIX}/hair/${appearance.hairStyle}/${gender}`
}

function hairAtlasSrc(appearance: HeroAppearanceConfig, gender: HeroAppearanceGender): string {
  return `${HERO_APPEARANCE_BASE_URL}/hair/${appearance.hairStyle}/${gender}/texture.json`
}

function hairLayerAlias(appearance: HeroAppearanceConfig, gender: HeroAppearanceGender, layer: string, sheet: string): string {
  return `${hairAtlasAlias(appearance, gender)}/${layer}/${sheet}`
}

function frameSuffix(alias: string): string {
  return `_graphics_${alias.split('/').join('_')}.png`
}

function animationSpeedForHairAlias(alias: string): number {
  return alias.endsWith('/corpse') ? 0 : 0.2
}

function isAssetCached(alias: string): boolean {
  return Assets.cache.has(alias)
}

function registerAliasFromAtlas(alias: string, atlasAlias: string): void {
  if (isAssetCached(alias)) return
  const atlas = Assets.cache.get(atlasAlias) as SpritesheetLike | undefined
  if (!atlas?.textures) return
  const suffix = frameSuffix(alias)
  const textures = Object.fromEntries(Object.entries(atlas.textures).filter(([frameName]) => frameName.endsWith(suffix)))
  if (!Object.keys(textures).length) return
  const frames = Object.fromEntries(Object.entries(atlas.data?.frames ?? {}).filter(([frameName]) => frameName.endsWith(suffix)))
  Assets.cache.set(alias, {
    ...atlas,
    data: {
      ...atlas.data,
      animationSpeed: animationSpeedForHairAlias(alias),
      frames,
    },
    textures,
  })
}

function registerHeroHairAliases(appearance: HeroAppearanceConfig, gender: HeroAppearanceGender): void {
  const atlasAlias = hairAtlasAlias(appearance, gender)
  for (const layer of ['back', 'front']) {
    for (const sheet of ['walking', 'dying', 'corpse', 'action/slash', 'action/shoot']) {
      registerAliasFromAtlas(hairLayerAlias(appearance, gender, layer, sheet), atlasAlias)
    }
  }
}

export function heroAppearanceAssetsForPlayers(players: Pick<PlayerLike, 'civ' | 'gender' | 'heroAppearance'>[]): Array<{ alias: string; src: string }> {
  const seen = new Set<string>()
  const assets: Array<{ alias: string; src: string }> = []
  for (const player of players) {
    const gender = normalizeHeroAppearanceGender(player.gender)
    const appearance = normalizeHeroAppearance(player.heroAppearance, player.civ, gender)
    const alias = hairAtlasAlias(appearance, gender)
    if (seen.has(alias) || isAssetCached(alias)) continue
    seen.add(alias)
    assets.push({ alias, src: hairAtlasSrc(appearance, gender) })
  }
  return assets
}

export function registerHeroAppearanceAliasesForPlayers(players: Pick<PlayerLike, 'civ' | 'gender' | 'heroAppearance'>[]): void {
  for (const player of players) {
    const gender = normalizeHeroAppearanceGender(player.gender)
    registerHeroHairAliases(normalizeHeroAppearance(player.heroAppearance, player.civ, gender), gender)
  }
}

export function heroAppearanceLayersForPlayer(player: Pick<PlayerLike, 'civ' | 'gender' | 'heroAppearance'>): UnitAppearanceLayerConfig[] {
  const gender = normalizeHeroAppearanceGender(player.gender)
  const appearance = normalizeHeroAppearance(player.heroAppearance, player.civ, gender)
  const shared = {
    palette: `hair:${appearance.hairColor}`,
    paletteSource: HERO_HAIR_SOURCE_PALETTE,
    hideWhenEquippedSlots: ['helmet'] as const,
    sheetDirectionCounts: {
      standingSheet: 3,
      walkingSheet: 3,
      actionSheet: 3,
      harvestSheet: 3,
      dyingSheet: 1,
      corpseSheet: 1,
    },
  }
  return [
    {
      ...shared,
      zIndex: 9,
      standingSheet: hairLayerAlias(appearance, gender, 'back', 'walking'),
      walkingSheet: hairLayerAlias(appearance, gender, 'back', 'walking'),
      actionSheet: hairLayerAlias(appearance, gender, 'back', 'action/slash'),
      shootingSheet: hairLayerAlias(appearance, gender, 'back', 'action/shoot'),
      harvestSheet: hairLayerAlias(appearance, gender, 'back', 'action/slash'),
      dyingSheet: hairLayerAlias(appearance, gender, 'back', 'dying'),
      corpseSheet: hairLayerAlias(appearance, gender, 'back', 'corpse'),
    },
    {
      ...shared,
      zIndex: 11,
      standingSheet: hairLayerAlias(appearance, gender, 'front', 'walking'),
      walkingSheet: hairLayerAlias(appearance, gender, 'front', 'walking'),
      actionSheet: hairLayerAlias(appearance, gender, 'front', 'action/slash'),
      shootingSheet: hairLayerAlias(appearance, gender, 'front', 'action/shoot'),
      harvestSheet: hairLayerAlias(appearance, gender, 'front', 'action/slash'),
      dyingSheet: hairLayerAlias(appearance, gender, 'front', 'dying'),
      corpseSheet: hairLayerAlias(appearance, gender, 'front', 'corpse'),
    },
  ]
}
