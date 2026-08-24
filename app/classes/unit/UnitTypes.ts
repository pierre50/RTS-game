import type { AnimatedSprite, Container, Graphics } from 'pixi.js'
import type { HorseColor } from '../../lib/horseColors'
import type { GameContextLike } from '../../types/context'
import type { RuntimeEntity, UnitEntity } from '../../types/entities'
import type { RuntimeCell } from '../../types/map'
import type { PlayerLike, UnitRestoreReferences } from '../../types/player'

export type UnitSpawnOptions = Omit<Partial<UnitEntity>, keyof UnitRestoreReferences> &
  UnitRestoreReferences & { i: number; j: number; type: string; owner?: PlayerLike; suppressCreateSound?: boolean }

export type UnitRuntimeHost = Omit<
  UnitEntity,
  | 'context'
  | 'owner'
  | 'sprite'
  | 'reliefLift'
  | 'currentCell'
  | 'path'
  | 'quantity'
  | 'experience'
  | 'controlMode'
  | 'inactif'
  | 'loading'
  | 'currentSheet'
  | 'currentFrame'
  | 'sendTo'
> &
  Container & {
    context: GameContextLike
    owner: PlayerLike
    sprite: AnimatedSprite
    shadow: AnimatedSprite | null
    horseSprite: AnimatedSprite | null
    horseShadow: AnimatedSprite | null
    mountedRiderLegsSprite: AnimatedSprite | null
    mountedRiderMask: Graphics | null
    appearanceLayerSprites: Map<number, AnimatedSprite>
    reliefLift: number
    controlMode: NonNullable<UnitEntity['controlMode']>
    inactif: boolean
    loading: UnitEntity['loading']
    loadingType: UnitEntity['loadingType']
    currentSheet: NonNullable<UnitEntity['currentSheet']>
    currentFrame: NonNullable<UnitEntity['currentFrame']>
    degree: number
    currentCell: NonNullable<UnitEntity['currentCell']>
    visibleCells: NonNullable<UnitEntity['visibleCells']>
    path: NonNullable<UnitEntity['path']>
    buildQueue: NonNullable<UnitEntity['buildQueue']>
    quantity: number
    experience: NonNullable<UnitEntity['experience']>
    horseColor?: HorseColor
    visualSettingsCleanup: (() => void) | null
    unitInterface: unknown
    unitCommands: unknown
    unitLifecycle: unknown
    unitCombat: unknown
    unitActions: unknown
    unitMovement: unknown
    sendTo(target: RuntimeCell | RuntimeEntity, action?: string): void
    setDefaultInterface?(element: HTMLElement, data: unknown, options?: unknown): void
    getLoadingElement?(): HTMLDivElement
    createShadow?(): AnimatedSprite | null
    setupMountedHorseSprite?(): void
    syncVisualSettings?(): void
    getMountedRiderX(): number
    getMountedRiderY(): number
    syncMountedRiderPosition(): void
    syncSelectionMarkersToRelief(): void
    syncShadow(shadow?: AnimatedSprite | null, source?: AnimatedSprite | null): void
    getChildByLabel(label: string): Container | AnimatedSprite | null
    death?(): void
    decompose?(): void
  }
