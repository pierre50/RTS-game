import { BUILDING_TYPES, UNIT_TYPES } from '../../constants/entities'
import { prepareHouseBedPlans, getHouseBedLabels } from './householdBeds'

export type HouseholdUnit = {
  label?: string
  type?: string
  name?: string
  gender?: 'male' | 'female'
  controlMode?: string
  isDead?: boolean
  isDestroyed?: boolean
  i?: number
  j?: number
  homeHouseLabel?: string
  homeBedLabel?: string
  partnerLabel?: string
}
export type HouseholdBuilding = {
  type: string
  label?: string
  i?: number
  j?: number
  isBuilt?: boolean
  isDead?: boolean
  isDestroyed?: boolean
  buildingUpgrade?: unknown
  spaceId?: string | null
  interiorPortalId?: string
  interiorOwner?: string
  interiorUnfurnished?: boolean
  interiorBuildings?: HouseholdBuilding[]
  heroHomeResident?: { label: string; name?: string }
  plannedBedLabels?: string[]
  trainingQueue?: { trainee?: HouseholdUnit | null }[]
}
export type HouseholdOwner = {
  label?: string
  factionId?: string | null
  name?: string
  type?: string
  isPlayed?: boolean
  units?: HouseholdUnit[]
  buildings?: HouseholdBuilding[]
  context?: { map?: { spaces?: Map<string, unknown> } }
}
const living = (entity: { isDead?: boolean; isDestroyed?: boolean }) => !entity.isDead && !entity.isDestroyed
const hero = (unit: HouseholdUnit) => unit.type === UNIT_TYPES.hero || unit.controlMode === 'hero'
export function getHouseholdUnits(owner: HouseholdOwner | undefined): HouseholdUnit[] {
  const units = [
    ...(owner?.units ?? []),
    ...(owner?.buildings ?? []).flatMap(b =>
      (b.trainingQueue ?? []).flatMap(entry => (entry.trainee ? [entry.trainee] : []))
    ),
  ]
  // Completion briefly exposes both the new unit and its queued portable state.
  const seen = new Set<string | HouseholdUnit>()
  return units.filter(unit => {
    const key = unit.label || unit
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

export function getHouseResidents(owner: HouseholdOwner | undefined, house: HouseholdBuilding): HouseholdUnit[] {
  const residents = getHouseholdUnits(owner).filter(
    unit => living(unit) && !!house.label && unit.homeHouseLabel === house.label
  )
  if (house.heroHomeResident && !residents.some(u => u.label === house.heroHomeResident!.label))
    residents.push({ ...house.heroHomeResident, type: UNIT_TYPES.hero, homeHouseLabel: house.label })
  return residents.sort((a, b) => (a.label ?? '').localeCompare(b.label ?? ''))
}

/** Establish relationships once for a newly generated settlement, never on daily arrivals. */
export function createInitialHouseholdPartners(owner: HouseholdOwner): void {
  const candidates = getHouseholdUnits(owner)
    .filter(u => living(u) && u.label && !hero(u) && !u.partnerLabel)
    .sort((a, b) => a.label!.localeCompare(b.label!))
  const women = candidates.filter(u => u.gender === 'female')
  const men = candidates.filter(u => u.gender === 'male')
  for (let i = 0; i < Math.min(women.length, men.length); i++) {
    women[i].partnerLabel = men[i].label
    men[i].partnerLabel = women[i].label
  }
}

export function countResidentHouseholds(owner: HouseholdOwner): number {
  const residents = getHouseholdUnits(owner).filter(u => living(u) && !hero(u))
  const byLabel = new Map(residents.map(u => [u.label, u]))
  const paired = residents.filter(u => u.partnerLabel && byLabel.get(u.partnerLabel)?.partnerLabel === u.label).length
  return residents.length - paired / 2
}

/** Shared by map generation, live play and detached simulation. Existing homes always win. */
export function reconcileHouseholds(owner: HouseholdOwner | undefined): void {
  if (!owner) return
  prepareHouseBedPlans(owner)
  const residents = getHouseholdUnits(owner).filter(living)
  const byLabel = new Map(residents.filter(u => u.label).map(u => [u.label!, u]))
  const houses = (owner.buildings ?? []).filter(
    h => h.type === BUILDING_TYPES.house && h.label && h.isBuilt && living(h)
  )
  const houseByLabel = new Map(houses.map(h => [h.label!, h]))
  for (const house of houses) {
    const resident =
      house.heroHomeResident && getHouseholdUnits(owner).find(u => u.label === house.heroHomeResident!.label)
    if (resident && (!living(resident) || resident.homeHouseLabel !== house.label)) delete house.heroHomeResident
  }
  const claimedBeds = new Set<string>()
  const claimedHomes = new Map<string, HouseholdUnit[]>()
  for (const unit of residents) {
    if (unit.partnerLabel && byLabel.get(unit.partnerLabel)?.partnerLabel !== unit.label) delete unit.partnerLabel
    const house = unit.homeHouseLabel ? houseByLabel.get(unit.homeHouseLabel) : null
    if (!house) {
      if (!hero(unit) || owner.buildings?.some(b => b.label === unit.homeHouseLabel)) {
        delete unit.homeHouseLabel
        delete unit.homeBedLabel
      }
      continue
    }
    const occupants = claimedHomes.get(house.label!) ?? []
    if (
      occupants.length &&
      !(occupants.length === 1 && occupants[0].partnerLabel === unit.label && unit.partnerLabel === occupants[0].label)
    ) {
      delete unit.homeHouseLabel
      delete unit.homeBedLabel
      continue
    }
    occupants.push(unit)
    claimedHomes.set(house.label!, occupants)
    const beds = getHouseBedLabels(owner, house)
    if (!unit.homeBedLabel || !beds.includes(unit.homeBedLabel) || claimedBeds.has(unit.homeBedLabel)) {
      unit.homeBedLabel = beds.find(label => !claimedBeds.has(label))
    }
    if (unit.homeBedLabel) claimedBeds.add(unit.homeBedLabel)
  }
  for (const unit of residents
    .filter(u => u.label && !hero(u) && !u.homeHouseLabel)
    .sort((a, b) => a.label!.localeCompare(b.label!))) {
    if (unit.homeHouseLabel) continue
    const partner = unit.partnerLabel ? byLabel.get(unit.partnerLabel) : undefined
    const group = partner && !hero(partner) && !partner.homeHouseLabel ? [unit, partner] : [unit]
    const available = houses
      .filter(h => {
        if (h.buildingUpgrade) return false
        const occupants = getHouseResidents(owner, h)
        return (
          (occupants.length === 0 || (partner && occupants.length === 1 && occupants[0] === partner)) &&
          getHouseBedLabels(owner, h).filter(label => !claimedBeds.has(label)).length >= group.length
        )
      })
      .sort((a, b) => {
        const distance = (h: HouseholdBuilding) =>
          Math.abs((h.i ?? 0) - (unit.i ?? 0)) + Math.abs((h.j ?? 0) - (unit.j ?? 0))
        return distance(a) - distance(b) || a.label!.localeCompare(b.label!)
      })
    const house = available[0]
    if (!house) continue
    const beds = getHouseBedLabels(owner, house).filter(label => !claimedBeds.has(label))
    group.forEach((member, index) => {
      member.homeHouseLabel = house.label
      member.homeBedLabel = beds[index]
      claimedBeds.add(beds[index])
    })
  }
}

export function getVacantHomeCount(owner: HouseholdOwner): number {
  return (owner.buildings ?? []).filter(
    h =>
      h.type === BUILDING_TYPES.house &&
      h.label &&
      h.isBuilt &&
      living(h) &&
      !h.buildingUpgrade &&
      !getHouseResidents(owner, h).length &&
      getHouseBedLabels(owner, h).length > 0
  ).length
}

export function canClaimHeroHome(owner: HouseholdOwner, unit: HouseholdUnit, house: HouseholdBuilding): boolean {
  return (
    hero(unit) &&
    (owner.buildings ?? []).includes(house) &&
    house.type === BUILDING_TYPES.house &&
    !!house.label &&
    !!house.isBuilt &&
    living(house) &&
    !house.buildingUpgrade &&
    !!unit.label &&
    unit.homeHouseLabel !== house.label &&
    getHouseResidents(owner, house).length === 0
  )
}

export function claimHeroHome(owner: HouseholdOwner, unit: HouseholdUnit, house: HouseholdBuilding): boolean {
  if (!canClaimHeroHome(owner, unit, house)) return false
  for (const previous of owner.buildings ?? []) {
    if (previous.heroHomeResident?.label === unit.label) delete previous.heroHomeResident
  }
  house.heroHomeResident = { label: unit.label!, name: unit.name }
  unit.homeHouseLabel = house.label
  unit.homeBedLabel = getHouseBedLabels(owner, house)[0]
  return true
}
