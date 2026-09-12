import { createQuestJournal } from '../../services/quests/QuestSystem'
import type { Application } from 'pixi.js'
import Controls from '../../classes/Controls'
import Menu from '../../classes/Menu'
import { DevConsole } from '../../dev-console/DevConsole'
import { ActionScheduler } from '../../lib/ActionScheduler'
import { t } from '../../lib/lang'
import { PerformanceMonitor } from '../../services/PerformanceMonitor'
import type { DevConsoleRuntimeContext } from '../../dev-console/types'
import type { GameContextLike, PerformanceMonitorLike, SchedulerLike, VisionChangeEvent } from '../../types/context'
import type { BuildingEntity, UnitEntity, UnitResourceDeliveryReturnTask } from '../../types/entities'
import type { PlayerLike } from '../../types/player'
import type { CampaignSave, SaveRecord } from '../../types/save'
import type { RuntimeCell, RuntimeMap } from '../../types/map'
import { getRealWorldGraph } from '../../serialization/CampaignSave'
import { updateWorldEconomy } from '../../services/world/WorldEconomyRuntime'

type DestroyableRuntimeMap = RuntimeMap & {
  destroy(options?: unknown): void
}

export type GameRuntimeContext = Omit<
  GameContextLike,
  'map' | 'player' | 'controls' | 'menu' | 'scheduler' | 'performance'
> & {
  map: DestroyableRuntimeMap | null
  player: PlayerLike | null
  players: PlayerLike[]
  controls: Controls | null
  menu: Menu | null
  scheduler: SchedulerLike | null
  performance: PerformanceMonitorLike | null
  devConsole: DevConsole | null
  checkDefeat: () => boolean
}

export type GameRuntimeContextHost = {
  _campaignSave: CampaignSave | null
  _changeFactionRelation(factionId: string, delta: number): void
  _autosaveCampaign(): void
  autosave(): { key: string; name: string } | null
  applyZoom(): void
  checkDefeat(): boolean
  load(evt: SaveRecord): Promise<void>
  quit(): void
  restart(): Promise<void>
  save(): { key: string; name: string }
  togglePause(pause: boolean): void
  travelIntoBuildingInterior(building: BuildingEntity): Promise<void>
  getBuildingInteriorEntryTargetForCell(cell: RuntimeCell): BuildingEntity | null
  routeUnitIntoBuildingInterior(unit: UnitEntity, building: BuildingEntity): boolean
  travelOutOfBuildingInterior(): Promise<void>
  routeUnitResourceDelivery(unit: UnitEntity, building: BuildingEntity): Promise<boolean>
  debugTeleportWorldMap(target: { worldI: number; worldJ: number; worldRegionId: string }): Promise<void>
  routeInteriorUnitToExit(unit: UnitEntity, returnTask?: UnitResourceDeliveryReturnTask | null): void
  synchronizeBuildingInteriorAfterTimeJump(): void
  syncStableInteriorHorses(building: BuildingEntity): void
}

export function createGameRuntimeContext(
  host: GameRuntimeContextHost,
  app: Application,
  gamebox: HTMLElement
): GameRuntimeContext {
  const visionChangeListeners = new Set<(event: VisionChangeEvent) => void>()
  const context: GameRuntimeContext = {
    app,
    gamebox,
    menu: null,
    player: null,
    players: [],
    map: null,
    controls: null,
    dayNight: null,
    weather: null,
    tributeRaids: null,
    unitRest: null,
    devConsole: null,
    devConsoleOpen: false,
    paused: false,
    defeat: false,
    scheduler: null,
    performance: null,
    autosave: () => host.autosave(),
    save: () => host.save(),
    load: (evt: object) => host.load(evt as SaveRecord),
    pause: () => host.togglePause(true),
    resume: () => {
      if (!context.defeat) host.togglePause(false)
    },
    restart: () => host.restart(),
    quit: () => host.quit(),
    checkDefeat: () => host.checkDefeat(),
    applyZoom: () => host.applyZoom(),
    getWorldGraph: () => (host._campaignSave ? getRealWorldGraph(host._campaignSave) : null),
    getCampaignWorldState: worldId => host._campaignSave?.worlds?.[worldId]?.state ?? null,
    getCampaignFactions: () => host._campaignSave?.factions ?? null,
    getQuestJournal: () => (host._campaignSave ? (host._campaignSave.quests ??= createQuestJournal()) : null),
    getCampaignEconomy: () => host._campaignSave?.economy ?? null,
    updateWorldEconomy: () => {
      if (host._campaignSave?.economy && context.map && context.scheduler)
        updateWorldEconomy(host._campaignSave, context as GameContextLike)
    },
    changeFactionRelation: (factionId: string, delta: number) => host._changeFactionRelation(factionId, delta),
    debugTeleportWorldMap: target => {
      host.debugTeleportWorldMap(target).catch(error => {
        console.error('Unable to debug teleport on world map', error)
        context.menu?.showMessage(t('corruptSave'))
      })
    },
    notifyVisionChange: event => {
      for (const listener of visionChangeListeners) listener(event)
    },
    onVisionChange: callback => {
      visionChangeListeners.add(callback)
      return () => {
        visionChangeListeners.delete(callback)
      }
    },
    getCurrentWorldId: () => host._campaignSave?.currentWorldId ?? null,
    travelIntoBuildingInterior: (building: BuildingEntity) => {
      host.travelIntoBuildingInterior(building).catch(error => {
        console.error('Unable to travel into building interior', error)
        context.menu?.showMessage(t('corruptSave'))
      })
    },
    getBuildingInteriorEntryTargetForCell: (cell: RuntimeCell) => host.getBuildingInteriorEntryTargetForCell(cell),
    routeUnitIntoBuildingInterior: (unit: UnitEntity, building: BuildingEntity) =>
      host.routeUnitIntoBuildingInterior(unit, building),
    travelOutOfBuildingInterior: () => {
      host.travelOutOfBuildingInterior().catch(error => {
        console.error('Unable to travel out of building interior', error)
        context.menu?.showMessage(t('corruptSave'))
      })
    },
    routeUnitResourceDelivery: (unit: UnitEntity, building: BuildingEntity) => {
      host.routeUnitResourceDelivery(unit, building).catch(error => {
        console.error('Unable to route unit resource delivery', error)
      })
    },
    routeInteriorUnitToExit: (unit: UnitEntity, returnTask?: UnitResourceDeliveryReturnTask | null) =>
      host.routeInteriorUnitToExit(unit, returnTask),
    synchronizeBuildingInteriorAfterTimeJump: () => host.synchronizeBuildingInteriorAfterTimeJump(),
    syncStableInteriorHorses: (building: BuildingEntity) => host.syncStableInteriorHorses(building),
  }

  context.performance = new PerformanceMonitor(app)
  context.restTransitionsEnabled = true
  context.scheduler = new ActionScheduler(
    app,
    () => context.paused ?? false,
    () => context.performance ?? null
  )
  exposeGameDebugContext(context)
  return context
}

export function createGameUiRuntime(context: GameRuntimeContext): void {
  const gameContext = context as GameContextLike
  context.controls = new Controls(gameContext)
  context.menu = new Menu(gameContext)
  context.devConsole = new DevConsole(context as DevConsoleRuntimeContext)
  exposeGameDebugContext(context)
}

function exposeGameDebugContext(context: GameRuntimeContext): void {
  ;(window as unknown as { __debugContext?: unknown }).__debugContext = context
}
