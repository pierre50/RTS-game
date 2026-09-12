import { UNIT_TYPES } from '../../constants'
import { normalizeCivilization } from '../civilizationAlias'
import { hashLpcAppearanceSeed } from '../lpc/appearance'
import { bakedUnitForType, forcedGenderForBakedUnit, type BakedGender } from '../lpc/bakedAliases'

type IdentityUnit = {
  type?: string
  controlMode?: string
  label?: string
  gender?: string
  assetCiv?: string
  appearanceVariants?: Record<string, string>
  owner?: { civ?: string; gender?: string } | null
}

function validGender(value: string | undefined): BakedGender | null {
  return value === 'male' || value === 'female' ? value : null
}

/** Existing visual identity wins for legacy saves whose two gender fields disagree. */
export function getUnitGender(unit?: IdentityUnit | null): BakedGender | null {
  if (!unit) return null
  const bakedType = unit.controlMode === 'hero' ? 'hero' : bakedUnitForType(unit.type ?? '')
  return (
    (bakedType ? forcedGenderForBakedUnit(bakedType) : null) ??
    validGender(unit.appearanceVariants?.gender) ??
    validGender(unit.gender) ??
    (unit.controlMode === 'hero' || unit.type === UNIT_TYPES.hero ? validGender(unit.owner?.gender) : null)
  )
}

export function resolveUnitIdentity(unit: IdentityUnit): { civ: string; gender: BakedGender } {
  return {
    civ: normalizeCivilization(unit.assetCiv || unit.owner?.civ),
    // Resolve once at creation and persist; movement and ownership never enter this seed.
    gender: getUnitGender(unit) ?? (Math.abs(hashLpcAppearanceSeed(unit.label ?? '')) % 2 ? 'female' : 'male'),
  }
}
