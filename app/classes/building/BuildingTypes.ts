import type { AnimatedSprite, Container, Sprite } from 'pixi.js'
import type { BuildingEntity, CommandSound, RuntimeEntity, UnitEntity, UnitSounds } from '../../types/entities'
import type { TechnologyConfig } from '../../types/config'
import type { GameContextLike } from '../../types/context'
import type { RuntimeCell } from '../../types/map'
import type { PlayerLike } from '../../types/player'
import type { FireAnimation } from './BuildingFire'

type BuildingSprite = Sprite | AnimatedSprite
type BuildingSounds = UnitSounds & { burning?: CommandSound; collapse?: CommandSound }
type QueuedTechnology = { type: string; config: TechnologyConfig }

export type BuildingControllerHost = Omit<
  BuildingEntity,
  | 'context'
  | 'owner'
  | 'sprite'
  | 'size'
  | 'hitPoints'
  | 'totalHitPoints'
  | 'queue'
  | 'technology'
  | 'loading'
  | 'addChild'
  | 'setRallyPoint'
  | 'buyUnit'
  | 'cancelUnits'
  | 'buyTechnology'
  | 'cancelTechnology'
  | 'upgrade'
  | 'updateHitPoints'
  | 'placeUnit'
  | 'die'
  | 'destroy'
> &
  Container & {
    context: GameContextLike
    owner: PlayerLike
    sprite: BuildingSprite
    size: number
    hitPoints: number
    totalHitPoints: number
    queue: string[]
    technology: QueuedTechnology | null
    loading: number | null
    isBuilt?: boolean
    trainingUnit?: UnitEntity | null
    trainingType?: string | null
    isUsedBy?: RuntimeEntity | null
    rallyPoint?: { i: number; j: number; direction: number } | null
    rallyPointFlag?: AnimatedSprite | null
    shadow?: Sprite | null
    intervalId?: unknown
    attackIntervalId?: unknown
    projectile?: string
    rateOfFire: number
    range?: number
    sounds?: BuildingSounds
    hasActiveBurningSound?: boolean
    flameSoundLoop?: { stop(): void; volume: number } | null
    flameSoundTicker?: ((ticker?: { deltaMS?: number; elapsedMS?: number }) => void) | null
    flameSoundStopped?: boolean
    mountingTime?: number
    visibilityTimeout?: ReturnType<typeof setTimeout>
    populationCapacityApplied?: boolean
    visualSettingsCleanup?: (() => void) | null
    bindSpriteInteractions(): void
    startAttackInterval(callback: () => void, interval: number): void
    stopAttackInterval(): void
    startInterval(callback: () => void, interval: number, immediateOrName?: boolean | string, name?: string): void
    stopInterval(): void
    startTimeout(callback: () => void, interval: number): void
    scanForInitialTarget(): void
    detect(instance: RuntimeEntity): void
    updateHitPoints(action?: string): void
    updateTexture(): void
    updateInterfaceLoading?(): void
    updateShadow(shadow?: Sprite | null): void
    finalTexture(): void
    generateFire(spriteId: FireAnimation): void
    onBuilt(): void
    die(): void
    clear(): void
    clearRallyPoint(): void
    buyUnit(type: string, alreadyPaid?: boolean, force?: boolean, extra?: unknown): boolean | undefined | void
    destroy(options?: { children?: boolean; texture?: boolean }): void
    setRallyPoint?(cell?: RuntimeCell, direction?: number): boolean
  }

export type TrainingBuilding = BuildingControllerHost & {
  trainingUnit?: UnitEntity | null
  trainingType?: string | null
  mountingTime?: number
}
