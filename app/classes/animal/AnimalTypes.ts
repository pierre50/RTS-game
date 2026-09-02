import type { AnimalEntity, RuntimeEntity } from '../../types/entities'
import type { Point } from '../../types/grid'
import type { GameContextLike, SchedulerTaskId } from '../../types/context'
import type { RuntimeCell } from '../../types/map'
import type { PlayerLike } from '../../types/player'
import type { InteractiveSprite, SpritesheetLike } from '../../types/pixi'
import type { UnitSounds } from '../../types/sounds'

export const FLYING_ALTITUDE = 20

export type AnimalDestination = RuntimeEntity | RuntimeCell

export type AnimalMoveOptions = {
  forceRepath?: boolean
  movementSheet?: string
}

export type AnimalControllerHost = AnimalEntity & {
  ambientWalkDelayMax?: number
  ambientWalkDelayMin?: number
  ambientMovement?: boolean
  ambientWalkRange?: number
  altitude: number
  animalBehavior: { stop(): void }
  attackRecoveryAnimationTaskId?: SchedulerTaskId | null
  attackRecoveryTaskId?: SchedulerTaskId | null
  attackImpactFrame?: number
  context: GameContextLike
  currentFrame: number
  currentCell: RuntimeCell
  degree: number
  dest: AnimalDestination | null
  flyingAltitude?: number
  flyingSheet?: SpritesheetLike | null
  flyingSpeed?: number
  huntRange?: number
  loop?: boolean
  movementSheet?: string
  owner: PlayerLike
  path: RuntimeCell[]
  previousDest: AnimalDestination | null
  quantity: number
  realDest: Pick<AnimalDestination, 'i' | 'j'> | null
  runningSheet?: SpritesheetLike | null
  runningSpeed?: number
  sight: number
  sounds?: UnitSounds
  speed: number
  sprite: InteractiveSprite
  strategy?: string
  timeoutId?: SchedulerTaskId | null
  totalQuantity: number
  zIndex: number
  applyReliefLift(level: number, immediate?: boolean): void
  affectNewDest(): void
  clear(): void
  death(): void
  decompose(): void
  destroy(options?: unknown): void
  destHasMoved(): boolean
  drawHealthBar(): void
  getAction(name: string): void
  getActionCondition(target: object | null | undefined, action?: string): boolean
  getReaction(instance: RuntimeEntity, hitDirection?: Point): void
  removeHealthBar(): void
  runaway(instance: RuntimeEntity, hitDirection?: Point): void
  sendTo(dest: AnimalDestination | null, action?: string | null, options?: AnimalMoveOptions): void
  setAltitude(altitude: number): void
  setDest(dest: AnimalDestination | null): void
  setPath(path: RuntimeCell[], sheet?: string): void
  setTextures(sheet: string): void
  startInterval(callback: () => void, time: number, immediate?: boolean, name?: string): void
  stop(): void
  stopInterval(): void
  stopTimeout(): void
  syncShadow(): void
  step(): void
  updateTexture(): void
}
