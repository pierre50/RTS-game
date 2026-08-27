import type { Application } from 'pixi.js'
import Controls from '../../classes/Controls'
import Menu from '../../classes/Menu'
import { DevConsole } from '../../dev-console/DevConsole'
import { ActionScheduler } from '../../lib/actionScheduler'
import { t } from '../../lib/lang'
import { PerformanceMonitor } from '../../services/PerformanceMonitor'
import type { DevConsoleRuntimeContext } from '../../dev-console/types'
import type { GameContextLike, PerformanceMonitorLike, SchedulerLike } from '../../types/context'
import type { BuildingEntity, ResourceEntity } from '../../types/entities'
import type { PlayerLike } from '../../types/player'
import type { CampaignSave, SaveRecord } from '../../types/save'
import type { RuntimeMap } from '../../types/map'

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
  applyZoom(): void
  checkDefeat(): boolean
  load(evt: SaveRecord): Promise<void>
  quit(): void
  restart(): Promise<void>
  save(): { key: string; name: string }
  togglePause(pause: boolean): void
  travelIntoBuildingInterior(building: BuildingEntity): Promise<void>
  travelOutOfBuildingInterior(): Promise<void>
  travelThroughPortal(portal: ResourceEntity, color: 'blue' | 'yellow' | 'red'): Promise<void>
}

export function createGameRuntimeContext(
  host: GameRuntimeContextHost,
  app: Application,
  gamebox: HTMLElement
): GameRuntimeContext {
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
    villagerShelter: null,
    devConsole: null,
    devConsoleOpen: false,
    paused: false,
    defeat: false,
    scheduler: null,
    performance: null,
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
    getWorldGraph: () => host._campaignSave?.worldGraph ?? null,
    getCampaignFactions: () => host._campaignSave?.factions ?? null,
    changeFactionRelation: (factionId: string, delta: number) => host._changeFactionRelation(factionId, delta),
    getCurrentWorldId: () => host._campaignSave?.currentWorldId ?? null,
    travelThroughPortal: (portal: ResourceEntity, color: 'blue' | 'yellow' | 'red') => {
      host.travelThroughPortal(portal, color).catch(error => {
        console.error('Unable to travel through portal', error)
        context.menu?.showMessage(t('corruptSave'))
      })
    },
    travelIntoBuildingInterior: (building: BuildingEntity) => {
      host.travelIntoBuildingInterior(building).catch(error => {
        console.error('Unable to travel into building interior', error)
        context.menu?.showMessage(t('corruptSave'))
      })
    },
    travelOutOfBuildingInterior: () => {
      host.travelOutOfBuildingInterior().catch(error => {
        console.error('Unable to travel out of building interior', error)
        context.menu?.showMessage(t('corruptSave'))
      })
    },
  }

  context.performance = new PerformanceMonitor(app)
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
