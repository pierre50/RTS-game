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
  interface Unit {
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
    spaceId?: UnitEntity['spaceId']
    inactif: boolean
    sounds?: UnitEntity['sounds']
    work: UnitEntity['work']
    actionFrameSequence?: UnitEntity['actionFrameSequence']
    shelterState?: UnitEntity['shelterState']
    sleepVisualState?: UnitEntity['sleepVisualState']
    visualAnimationToken?: UnitEntity['visualAnimationToken']
    restWakeLockUntilMs?: UnitEntity['restWakeLockUntilMs']
    restAlertTargetLabel?: UnitEntity['restAlertTargetLabel']
    interiorExitState?: UnitEntity['interiorExitState']
    resourceDeliveryState?: UnitEntity['resourceDeliveryState']

    dest: UnitEntity['dest']
    realDest: UnitEntity['realDest']
    previousDest: UnitEntity['previousDest']
    previousWork: UnitEntity['previousWork']
    path: NonNullable<UnitEntity['path']>
    pendingOrder: UnitEntity['pendingOrder']
    blockedGatherApproach: UnitEntity['blockedGatherApproach']
    buildQueue: NonNullable<UnitEntity['buildQueue']>
    isDirectMoving?: UnitEntity['isDirectMoving']
    currentCell: NonNullable<UnitEntity['currentCell']>
    visibleCells: NonNullable<UnitEntity['visibleCells']>
    speed?: UnitEntity['speed']

    actionLocked: boolean
    contextAction?: UnitEntity['contextAction']
    currentSheet: NonNullable<UnitEntity['currentSheet']>
    currentFrame: NonNullable<UnitEntity['currentFrame']>
    mountedOnHorse?: UnitEntity['mountedOnHorse']
    horseColor?: HorseColor
    actionSheet?: UnitEntity['actionSheet']
    walkingSheet?: UnitEntity['walkingSheet']
    standingSheet?: UnitEntity['standingSheet']
    loop?: UnitEntity['loop']
    visibilityTimeout?: UnitEntity['visibilityTimeout']
    showBuildings?: UnitEntity['showBuildings']

    assets?: UnitEntity['assets']
    allAssets?: UnitEntity['allAssets']
    energy?: UnitEntity['energy']
    totalEnergy?: UnitEntity['totalEnergy']
    energyRegenRate?: UnitEntity['energyRegenRate']
    energyRegenDelay?: UnitEntity['energyRegenDelay']
    energyRegenMultiplier?: UnitEntity['energyRegenMultiplier']
    lastEnergySpentAt?: UnitEntity['lastEnergySpentAt']
    energyCosts?: UnitEntity['energyCosts']
    waitingForEnergyAction?: UnitEntity['waitingForEnergyAction']
    waitingForEnergyTarget?: UnitEntity['waitingForEnergyTarget']
    energyWaitTaskId?: UnitEntity['energyWaitTaskId']
    attackRecoveryMs?: UnitEntity['attackRecoveryMs']
    attackRecoveryTaskId?: UnitEntity['attackRecoveryTaskId']
    attackRecoveryAnimationTaskId?: UnitEntity['attackRecoveryAnimationTaskId']
    combatBehavior?: UnitEntity['combatBehavior']
    combatBehaviorPreset?: UnitEntity['combatBehaviorPreset']
    combatMode?: UnitEntity['combatMode']
    combatRecoveryOrbitDirection?: UnitEntity['combatRecoveryOrbitDirection']
    lastCombatRecoveryMoveAt?: UnitEntity['lastCombatRecoveryMoveAt']
    contextActionEnergyCosts?: UnitEntity['contextActionEnergyCosts']
    toolLevels?: UnitEntity['toolLevels']
    inventory?: UnitEntity['inventory']
    lootEquipment?: UnitEntity['lootEquipment']
    appearance?: UnitEntity['appearance']
    appearanceVariants?: UnitEntity['appearanceVariants']

    totalQuantity?: UnitEntity['totalQuantity']
    quantity: number
    experience: NonNullable<UnitEntity['experience']>
    isChief?: UnitEntity['isChief']

    interface: UnitEntity['interface']
    handleSetDest?: UnitEntity['handleSetDest']
    handleIsAttacked?: UnitEntity['handleIsAttacked']
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
