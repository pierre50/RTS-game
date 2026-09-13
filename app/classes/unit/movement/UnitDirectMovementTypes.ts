import type { getEntitySpaceMapLike } from '../../../lib/mapSpaces'
import type { UnitEntity } from '../../../types/entities'
import type { HeroDirectMoveBlocker } from './UnitHeroDirectMovementCollision'

export type DirectMoveState = {
  unit: UnitEntity
  directMoveBlocker: HeroDirectMoveBlocker | null
}
export type DirectMoveAttempt = {
  unit: UnitEntity
  contextMap: NonNullable<UnitEntity['context']>['map'] | undefined
  map: NonNullable<ReturnType<typeof getEntitySpaceMapLike>>
  dirX: number
  dirY: number
  candidateX: number
  candidateY: number
  rawI: number
  rawJ: number
  newI: number
  newJ: number
  crossingCell: boolean
  targetCell: UnitEntity['currentCell']
  heroControlled: boolean
  effectiveDistance: number
}
