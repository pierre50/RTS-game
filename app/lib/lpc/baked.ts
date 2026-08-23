import { Assets } from 'pixi.js'
import { hashLpcAppearanceSeed } from './appearance'
import {
  dynamicEquipmentAliases,
  dynamicEquipmentAssets,
  dynamicEquipmentLayersForEquipment,
  dynamicEquipmentLayersForUnit,
  dynamicEquipmentLayersForVillager,
} from './equipment'
import { isChiefUnit } from '../chief'
import { getUnitEquipmentLevel } from '../unitExperience'
import { SHEET_TYPES, UNIT_TYPES, WORK_TYPES } from '../../constants'
import type { UnitAppearanceLayerConfig } from '../../types/config'
import type { UnitEntity } from '../../types/entities'
import type { PlayerLike } from '../../types/player'
import type { SpritesheetLike } from '../../types/pixi'

const BAKED_LPC_BASE_URL = 'assets/graphics/lpc-baked'
const BAKED_LPC_ALIAS_PREFIX = 'lpc-baked'
const BAKED_GENDERS = ['male', 'female'] as const
type BakedGender = (typeof BAKED_GENDERS)[number]

const UNIT_SHEETS = ['walking', 'action', 'dying', 'corpse'] as const
const VILLAGER_BODY_SHEETS = ['walking', 'dying', 'corpse'] as const
const VILLAGER_ACTION_SHEETS = ['slash', 'shoot'] as const
const HERO_BASE_ACTION_SHEETS = ['slash', 'shoot'] as const
const RANGED_INFANTRY_ACTION_SHEETS = ['shoot'] as const

type BakedUnitType =
  | 'villager'
  | 'infantry'
  | 'infantry_nohair'
  | 'priest'
  | 'chief'
  | 'hero'
  | 'bandit_chief'
  | 'bandit_sword'
  | 'bandit_archer'

const INFANTRY_HELMET_MIN_LEVEL = 6

function isEquipmentKey(value: string | null | undefined): value is string {
  return typeof value === 'string' && value.length > 0
}

function getInventoryAppearanceEquipment(unit: UnitEntity): string[] {
  const { offhand, arrow, ...equippedWithoutOffhand } = unit.inventory?.equipped ?? {}
  const equipped = Object.values(equippedWithoutOffhand).filter(isEquipmentKey)
  const activeWeapons = unit.inventory?.activeWeapons ?? {}
  if (unit.work === 'heroSword') {
    return [...equipped, offhand, activeWeapons.melee, activeWeapons.offhand].filter(isEquipmentKey)
  }
  if (unit.work === WORK_TYPES.hunter) {
    return [...equipped, activeWeapons.ranged, activeWeapons.quiver, arrow].filter(isEquipmentKey)
  }
  return equipped
}

function usesAssignableHeroWeapons(unit: UnitEntity): boolean {
  return unit.controlMode === 'hero' || unit.type === UNIT_TYPES.hero || Boolean(unit.inventory)
}

function isLayerReplacedByActiveWeapon(layer: UnitAppearanceLayerConfig, unit: UnitEntity): boolean {
  const activeWeapons = unit.inventory?.activeWeapons
  if (!activeWeapons || !layer.equipmentKey) return false
  if (activeWeapons.melee && layer.workTypes?.includes('heroSword')) return true
  if (!layer.workTypes?.includes(WORK_TYPES.hunter)) return false
  if (activeWeapons.ranged && (layer.equipmentKey.startsWith('bow') || layer.equipmentKey.startsWith('arrow_'))) {
    return true
  }
  return Boolean(activeWeapons.quiver && layer.equipmentKey === 'quiver')
}

function isDefaultHeroWeaponLayer(layer: UnitAppearanceLayerConfig, unit: UnitEntity): boolean {
  if (!usesAssignableHeroWeapons(unit) || !layer.equipmentKey) return false
  if (layer.workTypes?.includes('heroSword')) return true
  if (!layer.workTypes?.includes(WORK_TYPES.hunter)) return false
  return layer.equipmentKey === 'quiver' || layer.equipmentKey.startsWith('bow') || layer.equipmentKey.startsWith('arrow_')
}

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

function isHelmetEquipmentKey(equipment: string): boolean {
  return equipment.startsWith('helmet_') || equipment.includes('_hood_')
}

function getCorpseAppearanceEquipment(unit: UnitEntity): readonly string[] | null {
  if (!unit.isDead) return null
  if (Array.isArray(unit.lootEquipment)) return unit.lootEquipment
  if (Array.isArray(unit.equipment)) return unit.equipment
  return null
}

function civKey(civilization: string | null | undefined): string {
  return (civilization || 'Greek').toLowerCase()
}

function genderKey(seed: string, preferredGender?: string | null): string {
  if (preferredGender === 'male' || preferredGender === 'female') return preferredGender
  return BAKED_GENDERS[Math.abs(hashLpcAppearanceSeed(seed)) % BAKED_GENDERS.length]
}

function gendersForBakedUnit(unit: BakedUnitType): readonly BakedGender[] {
  return BAKED_UNIT_GENDERS[unit] ?? BAKED_GENDERS
}

function forcedGenderForBakedUnit(unit: BakedUnitType): BakedGender | null {
  const genders = gendersForBakedUnit(unit)
  return genders.length === 1 ? genders[0] : null
}

// Every recolorable piece is baked in the same "blue" team-color convention (see
// scripts/lpc/build.py) and repainted at runtime by changeSpriteColor, so the baked
// variant only depends on civ, never on the player's color.
function bakedVariantKey(
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
  return `${BAKED_LPC_ALIAS_PREFIX}/${unit}/${variant}/${job}/${sheet}`
}

function bakedVariantAtlasAlias(unit: BakedUnitType, variant: string): string {
  return `${BAKED_LPC_ALIAS_PREFIX}/${unit}/${variant}`
}

function bakedVariantAtlasSrc(unit: BakedUnitType, variant: string): string {
  return `${BAKED_LPC_BASE_URL}/${unit}/${variant}/texture.json`
}

function bakedUnitAlias(unit: BakedUnitType, variant: string, sheet: string): string {
  return `${BAKED_LPC_ALIAS_PREFIX}/${unit}/${variant}/${sheet}`
}

function bakedUnitActionAlias(unit: BakedUnitType, variant: string, animation: string): string {
  return `${bakedUnitAlias(unit, variant, 'action')}/${animation}`
}

function villagerBodyAlias(variant: string, sheet: string): string {
  return bakedAlias('villager', variant, 'body', sheet)
}

function villagerActionAlias(variant: string, animation: string): string {
  return bakedAlias('villager', variant, 'action', animation)
}

// The hero bakes the villager-style "body" layout, plus the action poses it can still use directly.
function heroBodyAlias(variant: string, sheet: string): string {
  return bakedAlias('hero', variant, 'body', sheet)
}

function heroActionAlias(variant: string, animation: string): string {
  return bakedAlias('hero', variant, 'action', animation)
}

// Resolves the baked walking/standing sheet alias for a unit TYPE (not a live
// instance) — used for previews (e.g. training-button portraits) where there's
// no UnitEntity yet to read appearance off of.
export function getBakedUnitStandingSheetAlias(
  type: string,
  owner: Pick<PlayerLike, 'civ' | 'gender' | 'label'>
): string | null {
  const bakedUnit = UNIT_TYPE_TO_BAKED_UNIT[type]
  if (!bakedUnit) return null

  const variant = bakedVariantKey(bakedUnit, owner, type, forcedGenderForBakedUnit(bakedUnit))
  const isVillagerLike = bakedUnit === 'villager' || bakedUnit === 'hero'
  if (isVillagerLike) {
    const bodyAlias = bakedUnit === 'hero' ? heroBodyAlias : villagerBodyAlias
    return bodyAlias(variant, 'walking')
  }
  return bakedUnitAlias(bakedUnit, variant, 'walking')
}

function isAssetCached(alias: string): boolean {
  return Assets.cache.has(alias)
}

function bakedFrameSuffix(alias: string): string {
  return `_graphics_${alias.split('/').join('_')}.png`
}

function bakedSheetAnimationSpeed(alias: string): number {
  return alias.endsWith('/corpse') ? 0 : 0.2
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

function bakedLogicalAliases(unit: BakedUnitType, variant: string): string[] {
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

function registerBakedUnitVariantAliases(unit: BakedUnitType, variant: string): void {
  const atlasAlias = bakedVariantAtlasAlias(unit, variant)
  for (const alias of bakedLogicalAliases(unit, variant)) {
    registerAliasFromAtlas(alias, atlasAlias)
  }
}

function registerDynamicEquipmentAliases(): void {
  for (const { alias, atlasAlias, animationSpeed, frameSuffix } of dynamicEquipmentAliases()) {
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

async function loadBakedUnitVariant(unit: BakedUnitType, variant: string): Promise<void> {
  const atlasAlias = bakedVariantAtlasAlias(unit, variant)
  if (!isAssetCached(atlasAlias)) {
    await Assets.load({
      alias: atlasAlias,
      src: bakedVariantAtlasSrc(unit, variant),
    })
  }
  registerBakedUnitVariantAliases(unit, variant)
}

// 'hero' isn't in UNIT_TYPE_TO_BAKED_UNIT (it's not selected by unit.type — see
// applyBakedLpcUnitAssets), so it's added here explicitly to still get preloaded.
const BAKED_UNITS: readonly BakedUnitType[] = [
  ...new Set(Object.values(UNIT_TYPE_TO_BAKED_UNIT)),
  'infantry_nohair',
  'hero',
] as BakedUnitType[]

function resolveBakedUnitForRuntime(unit: UnitEntity): BakedUnitType | undefined {
  const bakedUnit: BakedUnitType | undefined =
    unit.controlMode === 'hero' ? 'hero' : isChiefUnit(unit) ? 'chief' : UNIT_TYPE_TO_BAKED_UNIT[unit.type]
  if (bakedUnit !== 'infantry' || ![UNIT_TYPES.infantry, UNIT_TYPES.bowman].includes(unit.type)) return bakedUnit
  const corpseEquipment = getCorpseAppearanceEquipment(unit)
  if (corpseEquipment) return corpseEquipment.some(isHelmetEquipmentKey) ? 'infantry_nohair' : 'infantry'
  return getUnitEquipmentLevel(unit) >= INFANTRY_HELMET_MIN_LEVEL ? 'infantry_nohair' : 'infantry'
}

function resolveBakedRuntimeVariant(unit: UnitEntity, bakedUnit: BakedUnitType): string | null {
  if (!unit.owner) return null
  const preferredGender =
    unit.appearanceVariants?.gender ??
    forcedGenderForBakedUnit(bakedUnit) ??
    (bakedUnit === 'hero' ? unit.owner.gender : null)
  return bakedVariantKey(
    bakedUnit,
    unit.owner,
    `${unit.owner.label}:${unit.label}:${unit.i}:${unit.j}`,
    preferredGender
  )
}

export async function preloadBakedLpcUnitsForPlayers(
  players: Pick<PlayerLike, 'civ' | 'gender' | 'label'>[]
): Promise<void> {
  const variants = new Set<string>()
  for (const player of players) {
    for (const bakedUnit of BAKED_UNITS) {
      for (const gender of gendersForBakedUnit(bakedUnit)) {
        const variant = bakedVariantKey(bakedUnit, player, `${bakedUnit}:${gender}`, gender)
        variants.add(`${bakedUnit}:${variant}`)
      }
    }
  }

  await Promise.all(
    [...variants].map(entry => {
      const separator = entry.indexOf(':')
      const unit = entry.slice(0, separator) as BakedUnitType
      const variant = entry.slice(separator + 1)
      return loadBakedUnitVariant(unit, variant)
    })
  )

  const equipmentAssets = dynamicEquipmentAssets().filter(asset => !isAssetCached(asset.alias))
  if (equipmentAssets.length) {
    await Assets.load(equipmentAssets)
  }
  registerDynamicEquipmentAliases()
}

export function applyBakedLpcUnitAssets(unit: UnitEntity): boolean {
  // The player-controlled hero has its own config, but controlMode still wins here
  // because a promoted chief and a controlled hero can both be isChief units.
  const resolvedBakedUnit = resolveBakedUnitForRuntime(unit)
  const variant = resolvedBakedUnit ? resolveBakedRuntimeVariant(unit, resolvedBakedUnit) : null
  if (!resolvedBakedUnit || !variant) return false

  // Player setup gender only drives the controlled hero/avatar. Regular units
  // keep a spawn-time mix so a batch like "spawn villager 10" is visually varied.
  const gender = variant.endsWith('female') ? 'female' : 'male'
  const isVillagerLike = resolvedBakedUnit === 'villager' || resolvedBakedUnit === 'hero'
  const bodyAlias = resolvedBakedUnit === 'hero' ? heroBodyAlias : villagerBodyAlias
  const walking = isVillagerLike ? bodyAlias(variant, 'walking') : bakedUnitAlias(resolvedBakedUnit, variant, 'walking')
  if (!isAssetCached(walking)) return false

  unit.appearance = undefined
  unit.appearanceVariants = { gender }
  unit.sheetDirectionCounts = {
    standingSheet: 3,
    walkingSheet: 3,
    actionSheet: 3,
    harvestSheet: 3,
    loadedSheet: 3,
    dyingSheet: 1,
    corpseSheet: 1,
  }

  // The hero keeps swapping tools (axe/pickaxe/bow/...) exactly like a villager
  // does — that's driven by unit.work, not by unit.type — so it reuses the same
  // work-keyed equipment layers instead of the fixed per-unit-type set. A
  // promoted chief looks up equipment by 'Chief' rather than its original
  // unit.type, since that's the only place it still carries its old type.
  const corpseEquipment = getCorpseAppearanceEquipment(unit)
  const baseLayers = (
    corpseEquipment
      ? dynamicEquipmentLayersForEquipment(corpseEquipment)
      : isVillagerLike
        ? dynamicEquipmentLayersForVillager()
        : dynamicEquipmentLayersForUnit(resolvedBakedUnit === 'chief' ? UNIT_TYPES.chief : unit.type, unit.owner?.civ)
  ).filter(layer => !isDefaultHeroWeaponLayer(layer, unit) && !isLayerReplacedByActiveWeapon(layer, unit))
  const equippedLayers = dynamicEquipmentLayersForEquipment(getInventoryAppearanceEquipment(unit))
  const dynamicLayers = [
    ...baseLayers,
    ...equippedLayers,
  ]
  unit.appearance = dynamicLayers.length ? { layers: dynamicLayers } : undefined

  if (!isVillagerLike) {
    const actionSheet =
      unit.type === UNIT_TYPES.bowman
        ? bakedUnitActionAlias(resolvedBakedUnit, variant, 'shoot')
        : bakedUnitAlias(resolvedBakedUnit, variant, 'action')
    unit.assets = {
      standingSheet: walking,
      walkingSheet: walking,
      actionSheet,
      dyingSheet: bakedUnitAlias(resolvedBakedUnit, variant, 'dying'),
      corpseSheet: bakedUnitAlias(resolvedBakedUnit, variant, 'corpse'),
    }
    return true
  }

  const actionAlias = resolvedBakedUnit === 'hero' ? heroActionAlias : villagerActionAlias
  const villagerSheets = (actionAnimation: 'slash' | 'shoot') => {
    const bodyWalking = bodyAlias(variant, 'walking')
    const bodyDying = bodyAlias(variant, 'dying')
    const bodyCorpse = bodyAlias(variant, 'corpse')
    const sheets = {
      standingSheet: bodyWalking,
      walkingSheet: bodyWalking,
      actionSheet: actionAlias(variant, actionAnimation),
      dyingSheet: bodyDying,
      corpseSheet: bodyCorpse,
    }
    return sheets
  }

  unit.allAssets = {
    default: villagerSheets('slash'),
    attacker: villagerSheets('slash'),
    heroSword: villagerSheets('slash'),
    hunter: {
      ...villagerSheets('shoot'),
      harvestSheet: actionAlias(variant, 'slash'),
      loadedSheet: bodyAlias(variant, 'walking'),
    },
    horseCapture: {
      ...villagerSheets('slash'),
      harvestSheet: actionAlias(variant, 'slash'),
      loadedSheet: bodyAlias(variant, 'walking'),
    },
    farmer: { ...villagerSheets('slash'), loadedSheet: bodyAlias(variant, 'walking') },
    forager: { ...villagerSheets('slash'), loadedSheet: bodyAlias(variant, 'walking') },
    stoneminer: { ...villagerSheets('slash'), loadedSheet: bodyAlias(variant, 'walking') },
    goldminer: { ...villagerSheets('slash'), loadedSheet: bodyAlias(variant, 'walking') },
    woodcutter: { ...villagerSheets('slash'), loadedSheet: bodyAlias(variant, 'walking') },
    builder: villagerSheets('slash'),
  }
  unit.assets = unit.allAssets.default
  return true
}

export function refreshBakedLpcUnitAssets(unit: UnitEntity): boolean {
  if (!applyBakedLpcUnitAssets(unit)) return false
  Object.assign(
    unit,
    Object.fromEntries(Object.entries(unit.assets ?? {}).map(([key, value]) => [key, Assets.cache.get(value)]))
  )
  unit.setTextures?.(unit.currentSheet ?? SHEET_TYPES.standing)
  return true
}

export async function ensureAndRefreshBakedLpcUnitAssets(unit: UnitEntity): Promise<boolean> {
  const resolvedBakedUnit = resolveBakedUnitForRuntime(unit)
  const variant = resolvedBakedUnit ? resolveBakedRuntimeVariant(unit, resolvedBakedUnit) : null
  if (!resolvedBakedUnit || !variant) return false
  await loadBakedUnitVariant(resolvedBakedUnit, variant)
  return refreshBakedLpcUnitAssets(unit)
}
