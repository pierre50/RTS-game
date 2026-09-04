import { hashLpcAppearanceSeed } from './appearance'
import { UNIT_TYPES } from '../../constants'
import { civilizationAssetSlug } from '../civilizationAlias'
import type { PlayerLike } from '../../types/player'

const BAKED_UNITS_BASE_URL = 'assets/graphics/units'
const BAKED_UNITS_ALIAS_PREFIX = 'units'
const BAKED_GENDERS = ['male', 'female'] as const
export type BakedGender = (typeof BAKED_GENDERS)[number]

const UNIT_SHEETS = ['walking', 'action', 'dying', 'corpse'] as const
const VILLAGER_BODY_SHEETS = ['walking', 'dying', 'corpse'] as const
const VILLAGER_ACTION_SHEETS = ['slash', 'shoot'] as const
const HERO_BASE_ACTION_SHEETS = ['slash', 'shoot'] as const
const RANGED_INFANTRY_ACTION_SHEETS = ['shoot'] as const

export type BakedUnitType =
  | 'villager'
  | 'infantry'
  | 'infantry_nohair'
  | 'priest'
  | 'chief'
  | 'hero'
  | 'bandit_chief'
  | 'bandit_sword'
  | 'bandit_archer'

const UNIT_TYPE_TO_BAKED_UNIT: Partial<Record<string, BakedUnitType>> = {
  Hero: 'hero',
  Villager: 'villager',
  Chief: 'chief',
  Fantassin: 'infantry',
  Bowman: 'infantry',
  Priest: 'priest',
  BanditChief: 'bandit_chief',
  BanditSword: 'bandit_sword',
  BanditArcher: 'bandit_archer',
}

const BAKED_UNIT_GENDERS: Partial<Record<BakedUnitType, readonly BakedGender[]>> = {
  bandit_chief: ['male'],
  bandit_sword: ['male'],
  bandit_archer: ['male'],
}

const BAKED_UNIT_VARIANT_ROOTS: Partial<Record<BakedUnitType, string>> = {
  bandit_chief: '',
  bandit_sword: '',
  bandit_archer: '',
}

export const BAKED_UNITS: readonly BakedUnitType[] = [
  ...new Set(Object.values(UNIT_TYPE_TO_BAKED_UNIT)),
  'infantry_nohair',
  'hero',
] as BakedUnitType[]

function civKey(civilization: string | null | undefined): string {
  return civilizationAssetSlug(civilization)
}

function genderKey(seed: string, preferredGender?: string | null): string {
  if (preferredGender === 'male' || preferredGender === 'female') return preferredGender
  return BAKED_GENDERS[Math.abs(hashLpcAppearanceSeed(seed)) % BAKED_GENDERS.length]
}

export function gendersForBakedUnit(unit: BakedUnitType): readonly BakedGender[] {
  return BAKED_UNIT_GENDERS[unit] ?? BAKED_GENDERS
}

export function forcedGenderForBakedUnit(unit: BakedUnitType): BakedGender | null {
  const genders = gendersForBakedUnit(unit)
  return genders.length === 1 ? genders[0] : null
}

export function bakedVariantKey(
  unit: BakedUnitType,
  owner: Pick<PlayerLike, 'civ' | 'gender' | 'label'>,
  seed: string,
  preferredGender?: string | null
): string {
  const gender = genderKey(seed, preferredGender)
  const fixedRoot = BAKED_UNIT_VARIANT_ROOTS[unit]
  if (fixedRoot != null) return fixedRoot ? `${fixedRoot}/${gender}` : gender
  return `${civKey(owner.civ)}/${gender}`
}

function bakedAlias(unit: BakedUnitType, variant: string, job: string, sheet: string): string {
  return `${BAKED_UNITS_ALIAS_PREFIX}/${unit}/${variant}/${job}/${sheet}`
}

export function bakedVariantAtlasAlias(unit: BakedUnitType, variant: string): string {
  return `${BAKED_UNITS_ALIAS_PREFIX}/${unit}/${variant}`
}

export function bakedVariantAtlasSrc(unit: BakedUnitType, variant: string): string {
  return `${BAKED_UNITS_BASE_URL}/${unit}/${variant}/texture.json`
}

export function bakedUnitAlias(unit: BakedUnitType, variant: string, sheet: string): string {
  return `${BAKED_UNITS_ALIAS_PREFIX}/${unit}/${variant}/${sheet}`
}

export function bakedUnitActionAlias(unit: BakedUnitType, variant: string, animation: string): string {
  return `${bakedUnitAlias(unit, variant, 'action')}/${animation}`
}

export function villagerBodyAlias(variant: string, sheet: string): string {
  return bakedAlias('villager', variant, 'body', sheet)
}

export function villagerActionAlias(variant: string, animation: string): string {
  return bakedAlias('villager', variant, 'action', animation)
}

export function heroBodyAlias(variant: string, sheet: string): string {
  return bakedAlias('hero', variant, 'body', sheet)
}

export function heroActionAlias(variant: string, animation: string): string {
  return bakedAlias('hero', variant, 'action', animation)
}

export function bakedLogicalAliases(unit: BakedUnitType, variant: string): string[] {
  if (unit === 'villager' || unit === 'hero') {
    const bodyAlias = unit === 'hero' ? heroBodyAlias : villagerBodyAlias
    const actionAlias = unit === 'hero' ? heroActionAlias : villagerActionAlias
    const actionSheets: readonly string[] = unit === 'hero' ? HERO_BASE_ACTION_SHEETS : VILLAGER_ACTION_SHEETS
    return [
      ...VILLAGER_BODY_SHEETS.map(sheet => bodyAlias(variant, sheet)),
      ...actionSheets.map(sheet => actionAlias(variant, sheet)),
    ]
  }

  return [
    ...UNIT_SHEETS.map(sheet => bakedUnitAlias(unit, variant, sheet)),
    ...(unit === 'infantry' || unit === 'infantry_nohair'
      ? RANGED_INFANTRY_ACTION_SHEETS.map(sheet => bakedUnitActionAlias(unit, variant, sheet))
      : []),
  ]
}

export function isVillagerLikeBakedUnit(unit: BakedUnitType): boolean {
  return unit === 'villager' || unit === 'hero'
}

export function bakedUnitForType(type: string): BakedUnitType | undefined {
  return UNIT_TYPE_TO_BAKED_UNIT[type]
}

export function isBakedInfantryRuntimeType(type: string): boolean {
  return [UNIT_TYPES.infantry, UNIT_TYPES.bowman].includes(type)
}
