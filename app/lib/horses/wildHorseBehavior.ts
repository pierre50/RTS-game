import type { RuntimeEntity } from '../../types/entities'
import type { Point } from '../../types/grid'
import { HORSE_TAMING_STATUS, setHorseTamingStatus, shouldHorseFleeFromThreat } from './horseTaming'

type WildHorseRuntime = RuntimeEntity & {
  strategy?: string
  ambientMovement?: boolean
  animalBehavior?: {
    start?: () => void
  }
}

function restoreWildHorseBehavior(horse: WildHorseRuntime): void {
  setHorseTamingStatus(horse, HORSE_TAMING_STATUS.wild)
  horse.strategy = 'runaway'
  horse.ambientMovement = true
  horse.animalBehavior?.start?.()
}

export function spookWildHorse(horse: WildHorseRuntime, threat?: RuntimeEntity, hitDirection?: Point): void {
  if (!shouldHorseFleeFromThreat(horse)) return
  restoreWildHorseBehavior(horse)
  if (threat) horse.isAttacked?.(threat, hitDirection)
}
