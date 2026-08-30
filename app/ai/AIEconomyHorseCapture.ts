import { BUILDING_TYPES } from '../constants'
import { getClosestInstance } from '../lib/grid/queries'
import { canStoreStableHorse, getStableHorseAmount, STABLE_HORSE_CAPACITY } from '../lib/horses/stableHorses'
import { isWildHorse } from '../lib/horses/horseTaming'
import type { AIBuildingLike, AIEconomyHorseCaptureContext, AIEntityLike } from './types'

export function getAvailableStableForCapture(economy: AIEconomyHorseCaptureContext): AIBuildingLike[] {
  return economy.ai
    .buildingsByTypes([BUILDING_TYPES.stable])
    .filter(
      (building: AIBuildingLike) =>
        building.isBuilt &&
        !building.isDead &&
        !building.isDestroyed &&
        canStoreStableHorse(economy.getBuildingAsRuntimeEntity(building))
    )
}

export function getAvailableHorseCaptureSlots(economy: AIEconomyHorseCaptureContext): number {
  return getAvailableStableForCapture(economy).reduce(
    (sum, stable) =>
      sum + Math.max(0, STABLE_HORSE_CAPACITY - getStableHorseAmount(economy.getBuildingAsRuntimeEntity(stable))),
    0
  )
}

export function getCapturableHorses(economy: AIEconomyHorseCaptureContext): AIEntityLike[] {
  return [...economy.ai.foundedAnimals]
    .filter((animal: AIEntityLike) => animal.type === 'Horse' && !animal.isDead && !animal.isDestroyed)
    .filter((animal: AIEntityLike) => isWildHorse(animal))
    .filter((animal: AIEntityLike) => economy.isLocationSafe(animal))
    .filter(animal => !(animal as { companionOwner?: AIEntityLike | null }).companionOwner)
    .filter(animal => !(animal as { isLassoed?: boolean }).isLassoed)
}

export function assignHorseCaptures(economy: AIEconomyHorseCaptureContext, availableVillagers: AIEntityLike[]): number {
  const stables = getAvailableStableForCapture(economy)
  if (!stables.length || !availableVillagers.length) return 0

  const horses = getCapturableHorses(economy)
  if (!horses.length) return 0

  const safeSlots = getAvailableHorseCaptureSlots(economy)
  if (!safeSlots) return 0

  let actions = 0
  const reserved: Map<AIBuildingLike, number> = new Map()
  const reservedForHorse = new Set<AIEntityLike>()

  const findNearestStable = (horse: AIEntityLike) => {
    let selected: AIBuildingLike | null = null
    let best = Infinity
    for (const stable of stables) {
      const used = reserved.get(stable) || 0
      if (getStableHorseAmount(economy.getBuildingAsRuntimeEntity(stable)) + used >= STABLE_HORSE_CAPACITY) continue
      const distance = Math.abs(stable.i - horse.i) + Math.abs(stable.j - horse.j)
      if (distance < best) {
        selected = stable
        best = distance
      }
    }
    return selected
  }

  for (let i = 0; i < safeSlots && availableVillagers.length; i++) {
    const villager = availableVillagers.shift()
    if (!villager) break
    const availableHorses = horses.filter(horse => !reservedForHorse.has(horse))
    if (!availableHorses.length) {
      availableVillagers.unshift(villager)
      break
    }
    const horse = getClosestInstance(villager, availableHorses)
    if (!horse) {
      availableVillagers.unshift(villager)
      break
    }
    const stable = findNearestStable(horse)
    if (!stable) {
      availableVillagers.unshift(villager)
      break
    }
    const captureResult = villager.sendToCaptureHorse?.(horse)
    if (captureResult === false || !villager.sendToCaptureHorse) {
      reservedForHorse.add(horse)
      availableVillagers.unshift(villager)
      continue
    }
    reserved.set(stable, (reserved.get(stable) || 0) + 1)
    reservedForHorse.add(horse)
    actions++
  }
  return actions
}
