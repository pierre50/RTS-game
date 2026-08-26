import type { RuntimeEntity } from '../../types/entities'
import type { Point } from '../../types/grid'

type WildHorseRuntime = RuntimeEntity & {
  strategy?: string
  ambientMovement?: boolean
  animalBehavior?: {
    start?: () => void
  }
}

function restoreWildHorseBehavior(horse: WildHorseRuntime): void {
  horse.strategy = 'runaway'
  horse.ambientMovement = true
  horse.animalBehavior?.start?.()
}

export function spookWildHorse(horse: WildHorseRuntime, threat?: RuntimeEntity, hitDirection?: Point): void {
  restoreWildHorseBehavior(horse)
  if (threat) horse.isAttacked?.(threat, hitDirection)
}
