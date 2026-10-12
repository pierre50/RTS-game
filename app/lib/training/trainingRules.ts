import { getBuildingLevel } from '../buildings/buildingLevel'
import {
  MILITARY_TRAINING_CAPACITY,
  ARCHERY_TRAINING_CAPACITY,
  ARCHERY_TRAINING_START_XP,
  MILITARY_TRAINING_START_XP,
  DEFAULT_TRAINING_CAPACITY,
  MILITARY_TRAINING_BUILDINGS,
  TRAINING_SPECIALTIES,
} from '../../config/militaryTraining'

type TrainingSite = { type?: string; buildingLevel?: number; assetLevel?: unknown }

export function getBuildingTrainingCapacity(building: TrainingSite): number {
  if (!MILITARY_TRAINING_BUILDINGS.some(type => type === building.type)) return DEFAULT_TRAINING_CAPACITY
  const capacities = building.type === 'ArcheryRange' ? ARCHERY_TRAINING_CAPACITY : MILITARY_TRAINING_CAPACITY
  return capacities[Math.min(getBuildingLevel(building), capacities.length - 1)]!
}

/** Captured at admission, so upgrades and reloads cannot add XP repeatedly. */
export function getTrainingStartingExperience(
  building: TrainingSite,
  unitType: string,
  previous?: Record<string, number>
): Record<string, number> {
  if (building.type === 'Stable') return { ...previous }
  const specialty = TRAINING_SPECIALTIES[building.type ?? '']
  if (!specialty || specialty.unit !== unitType) return {}
  const experience = building.type === 'ArcheryRange' ? ARCHERY_TRAINING_START_XP : MILITARY_TRAINING_START_XP
  const xp = experience[Math.min(getBuildingLevel(building), experience.length - 1)]!
  return xp ? { [specialty.skill]: xp } : {}
}

/** Calendar rules; placement, payment and UI remain the responsibility of each adapter. */
export function getTrainingDurationDays(config: { trainingDays?: number }, override?: number): number {
  return Math.max(0, Math.ceil(override ?? config.trainingDays ?? 1))
}

export function isTrainingComplete(day: number, completeDay: number | null | undefined): boolean {
  return completeDay != null && day >= completeDay
}

export function getTrainingProgress(
  day: number,
  startedDay: number | null | undefined,
  completeDay: number | null | undefined
): number {
  if (startedDay == null || completeDay == null) return 0
  if (isTrainingComplete(day, completeDay)) return 100
  return Math.min(100, Math.floor((Math.max(0, day - startedDay) / Math.max(1, completeDay - startedDay)) * 100))
}
