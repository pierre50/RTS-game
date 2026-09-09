import type { AnimatedSprite, Graphics } from 'pixi.js'
import type { UnitInterface } from '../../ui/entity/UnitInterface'
import type { HorseColor } from '../../lib/horses/horseColors'
import type { GameContextLike, SchedulerLike } from '../../types/context'
import type {
  BuildingEntity,
  RuntimeEntity,
  UnitCommandOptions,
  UnitEntity,
  UnitResourceDeliveryReturnTask,
} from '../../types/entities'
import type { RuntimeCell } from '../../types/map'
import type { UnitActions } from './UnitActions'
import type { UnitCombat } from './UnitCombat'
import type { UnitCommands } from './UnitCommands'
import type { UnitLifecycle } from './UnitLifecycle'
import type { UnitMovement } from './movement/UnitMovement'

declare module './Unit' {
  interface Unit
    extends Pick<
      UnitEntity,
      | 'spaceId'
      | 'sounds'
      | 'work'
      | 'actionFrameSequence'
      | 'shelterState'
      | 'sleepVisualState'
      | 'visualAnimationToken'
      | 'restWakeLockUntilMs'
      | 'restAlertTargetLabel'
      | 'interiorExitState'
      | 'resourceDeliveryState'
      | 'dest'
      | 'realDest'
      | 'previousDest'
      | 'previousWork'
      | 'pendingOrder'
      | 'blockedGatherApproach'
      | 'isDirectMoving'
      | 'speed'
      | 'contextAction'
      | 'mountedOnHorse'
      | 'actionSheet'
      | 'walkingSheet'
      | 'standingSheet'
      | 'loop'
      | 'visibilityTimeout'
      | 'showBuildings'
      | 'assets'
      | 'allAssets'
      | 'energy'
      | 'totalEnergy'
      | 'energyRegenRate'
      | 'energyRegenDelay'
      | 'energyRegenMultiplier'
      | 'lastEnergySpentAt'
      | 'energyCosts'
      | 'waitingForEnergyAction'
      | 'waitingForEnergyTarget'
      | 'energyWaitTaskId'
      | 'attackRecoveryMs'
      | 'attackRecoveryTaskId'
      | 'attackRecoveryAnimationTaskId'
      | 'combatBehavior'
      | 'combatBehaviorPreset'
      | 'combatMode'
      | 'combatRecoveryOrbitDirection'
      | 'lastCombatRecoveryMoveAt'
      | 'contextActionEnergyCosts'
      | 'toolLevels'
      | 'inventory'
      | 'lootEquipment'
      | 'appearance'
      | 'appearanceVariants'
      | 'totalQuantity'
      | 'isChief'
      | 'handleSetDest'
      | 'handleIsAttacked'
    > {
    unitInterface: UnitInterface
    unitCommands: UnitCommands
    unitLifecycle: UnitLifecycle
    unitCombat: UnitCombat
    unitActions: UnitActions
    unitMovement: UnitMovement
    sendTo: (target: RuntimeCell | RuntimeEntity, action?: string) => void

    shadow: AnimatedSprite | null
    horseSprite: AnimatedSprite | null
    horseShadow: AnimatedSprite | null
    mountedRiderLegsSprite: AnimatedSprite | null
    mountedRiderMask: Graphics | null
    appearanceLayerSprites: Map<number, AnimatedSprite>
    reliefLift: number
    sheetDirectionCounts?: Record<string, number>
    sheetDirectionOrders?: Record<string, string[]>
    spriteScale?: number
    visualSettingsCleanup: (() => void) | null

    controlMode: NonNullable<UnitEntity['controlMode']>
    inactif: boolean

    path: NonNullable<UnitEntity['path']>
    buildQueue: NonNullable<UnitEntity['buildQueue']>
    currentCell: NonNullable<UnitEntity['currentCell']>
    visibleCells: NonNullable<UnitEntity['visibleCells']>

    actionLocked: boolean
    currentSheet: NonNullable<UnitEntity['currentSheet']>
    currentFrame: NonNullable<UnitEntity['currentFrame']>
    horseColor?: HorseColor

    quantity: number
    experience: NonNullable<UnitEntity['experience']>

    interface?: NonNullable<UnitEntity['interface']>
    context: GameContextLike & { scheduler: SchedulerLike }

    commonSendTo(
      target: RuntimeEntity,
      work: string,
      action: string | null,
      keepPrevious: boolean | UnitCommandOptions,
      immediate?: boolean,
      preserveBuildQueue?: boolean
    ): unknown
    sendToBuilding(target: BuildingEntity, preserveBuildQueue?: boolean): unknown
    sendToDelivery(target?: BuildingEntity | null, returnTaskOverride?: UnitResourceDeliveryReturnTask | null): unknown
    sendToAttack(target: RuntimeEntity, options?: UnitCommandOptions): unknown
    sendToConvert(target: RuntimeEntity): unknown
    sendToTakeMeat(target: RuntimeEntity, immediate?: boolean): unknown
    sendToHunt(target: RuntimeEntity, immediate?: boolean): unknown
    sendToFarm(target: RuntimeEntity, immediate?: boolean): unknown
  }
}
