import { NeutralVillageQuests } from '../../services/quests/NeutralVillageQuests'
import type { ContainerChild } from 'pixi.js'
import { BuildingInteriorEntryMarkerSystem } from '../../services/buildingInterior/BuildingInteriorEntryMarkerSystem'
import { CampPatrolSystem } from '../../services/patrol/CampPatrolSystem'
import { DailyWorldEventSystem } from '../../services/DailyWorldEventSystem'
import { DayNightSystem } from '../../services/DayNightSystem'
import { InteriorExitMarkerSystem } from '../../services/InteriorExitMarkerSystem'
import { HeroFollowerPatrolSystem } from '../../services/HeroFollowerPatrolSystem'
import { IdleUnitPatrolSystem } from '../../services/IdleUnitPatrolSystem'
import { VillagerAutonomySystem } from '../../services/VillagerAutonomySystem'
import { LightSystem } from '../../services/lighting/LightSystem'
import { ShadowSystem } from '../../services/ShadowSystem'
import { TimeSkipSystem } from '../../services/TimeSkipSystem'
import { TributeRaidSystem } from '../../services/TributeRaidSystem'
import { UnitEnergyRegenSystem } from '../../services/UnitEnergyRegenSystem'
import { UnitRestSystem } from '../../services/rest/UnitRestSystem'
import { WeatherSystem } from '../../services/weather/WeatherSystem'
import { WorldRegionTravelSystem, type RegionTravelHost } from '../../services/world/WorldRegionTravelSystem'
import { ResourceDeliverySystem } from './GameResourceDelivery'
import type { GameContextLike } from '../../types/context'
import type { RuntimeMap } from '../../types/map'

type ScreenRect = { height: number; width: number; x: number; y: number }
type LayerHost = { addChild(child: ContainerChild): unknown }
type RuntimeServiceContext = Pick<
  GameContextLike,
  'neutralQuests' | 'dayNight' | 'timeSkip' | 'tributeRaids' | 'unitRest' | 'weather' | 'worldPursuit'
>

const WEATHER_LAYER_Z_INDEX = 10
const LIGHT_LAYER_Z_INDEX = 20

export type RuntimeServices = {
  neutralQuests: NeutralVillageQuests | null
  worldPursuit: WorldPursuitSystem | null
  buildingInteriorEntryMarker: BuildingInteriorEntryMarkerSystem | null
  campPatrols: CampPatrolSystem | null
  dailyWorldEvents: DailyWorldEventSystem | null
  dayNight: DayNightSystem | null
  heroFollowerPatrols: HeroFollowerPatrolSystem | null
  idleUnitPatrols: IdleUnitPatrolSystem | null
  villagerAutonomy: VillagerAutonomySystem | null
  interiorExitMarker: InteriorExitMarkerSystem | null
  lights: LightSystem | null
  resourceDelivery: ResourceDeliverySystem | null
  shadows: ShadowSystem | null
  timeSkip: TimeSkipSystem | null
  tributeRaids: TributeRaidSystem | null
  unitEnergyRegen: UnitEnergyRegenSystem | null
  unitRest: UnitRestSystem | null
  weather: WeatherSystem | null
  worldRegionTravel: WorldRegionTravelSystem | null
}

export function createEmptyRuntimeServices(): RuntimeServices {
  return {
    neutralQuests: null,
    worldPursuit: null,
    buildingInteriorEntryMarker: null,
    campPatrols: null,
    dailyWorldEvents: null,
    dayNight: null,
    heroFollowerPatrols: null,
    idleUnitPatrols: null,
    villagerAutonomy: null,
    interiorExitMarker: null,
    lights: null,
    resourceDelivery: null,
    shadows: null,
    timeSkip: null,
    tributeRaids: null,
    unitEnergyRegen: null,
    unitRest: null,
    weather: null,
    worldRegionTravel: null,
  }
}

export function createRuntimeServices(
  context: GameContextLike,
  map: RuntimeMap,
  getScreenRect: () => ScreenRect,
  dayNightElapsedMs: number | null | undefined = null,
  worldRegionTravelHost?: RegionTravelHost | null
): RuntimeServices {
  const isInterior = map.mapType === 'interior'
  // Cross-region pursuit is disabled, including pending arrivals from older saves.
  context.worldPursuit = null
  const timeSkip = new TimeSkipSystem(context)
  context.timeSkip = timeSkip

  const dayNight = new DayNightSystem(context, { elapsedMs: dayNightElapsedMs })
  context.dayNight = dayNight
  for (const player of context.players ?? []) {
    for (const building of player.buildings ?? []) building.resumeSavedTraining?.()
    for (const unit of [...(player.units ?? [])]) {
      if (unit.trainingTargetType && unit.action === 'train' && unit.dest && !unit.isDead && !unit.isDestroyed) {
        unit.sendToEvt?.(unit.dest, 'train', { forceRepath: true, allowPassageStop: true })
      }
    }
  }

  const dailyWorldEvents = new DailyWorldEventSystem(context)
  const unitRest = new UnitRestSystem(context)
  context.unitRest = unitRest

  const tributeRaids = new TributeRaidSystem(context)
  context.tributeRaids = tributeRaids
  dailyWorldEvents.register(tributeRaids)

  const neutralQuests = new NeutralVillageQuests(context)
  context.neutralQuests = neutralQuests
  const campPatrols = new CampPatrolSystem(context)
  const heroFollowerPatrols = new HeroFollowerPatrolSystem(context)
  const idleUnitPatrols = new IdleUnitPatrolSystem(context)
  const unitEnergyRegen = new UnitEnergyRegenSystem(context)
  const resourceDelivery = new ResourceDeliverySystem(context)
  const villagerAutonomy = new VillagerAutonomySystem(context)
  const shadows = new ShadowSystem(context, map)
  const buildingInteriorEntryMarker = isInterior ? null : new BuildingInteriorEntryMarkerSystem(context, map)
  const interiorExitMarker = isInterior ? new InteriorExitMarkerSystem(context, map) : null
  const weather = isInterior ? null : new WeatherSystem(context, map, getScreenRect)
  context.weather = weather
  const worldRegionTravel =
    !isInterior && worldRegionTravelHost ? new WorldRegionTravelSystem(context, worldRegionTravelHost) : null

  const lights = new LightSystem(context, getScreenRect, () => dayNight.getDarknessLevel())
  const services = {
    neutralQuests,
    worldPursuit: null,
    buildingInteriorEntryMarker,
    campPatrols,
    dailyWorldEvents,
    dayNight,
    heroFollowerPatrols,
    idleUnitPatrols,
    villagerAutonomy,
    interiorExitMarker,
    lights,
    resourceDelivery,
    shadows,
    timeSkip,
    tributeRaids,
    unitEnergyRegen,
    unitRest,
    weather,
    worldRegionTravel,
  }

  exposeRuntimeServiceDebugGlobals(services)
  return services
}

export function addRuntimeServiceLayers(host: LayerHost, services: RuntimeServices): void {
  if (services.weather) {
    services.weather.layer.zIndex = WEATHER_LAYER_Z_INDEX
    host.addChild(services.weather.layer)
  }
  if (services.lights) {
    services.lights.layer.zIndex = LIGHT_LAYER_Z_INDEX
    host.addChild(services.lights.layer)
  }
}

export function destroyRuntimeServices(services: RuntimeServices, context: RuntimeServiceContext): RuntimeServices {
  services.neutralQuests?.destroy()
  context.neutralQuests = null
  services.worldPursuit?.destroy()
  context.worldPursuit = null
  services.buildingInteriorEntryMarker?.destroy()
  services.lights?.destroy()
  services.interiorExitMarker?.destroy()
  services.shadows?.destroy()
  services.timeSkip?.destroy()
  services.dailyWorldEvents?.destroy()
  services.unitRest?.destroy()
  services.campPatrols?.destroy()
  services.heroFollowerPatrols?.destroy()
  services.idleUnitPatrols?.destroy()
  services.villagerAutonomy?.destroy()
  services.unitEnergyRegen?.destroy()
  services.resourceDelivery?.destroy()
  services.dayNight?.destroy()
  services.weather?.destroy()
  services.worldRegionTravel?.destroy()

  context.dayNight = null
  context.weather = null
  context.timeSkip = null
  context.tributeRaids = null
  context.unitRest = null
  clearRuntimeServiceDebugGlobals()
  return createEmptyRuntimeServices()
}

function exposeRuntimeServiceDebugGlobals(services: RuntimeServices): void {
  const runtimeWindow = window as unknown as {
    __dayNightSystem?: DayNightSystem | null
    __lightSystem?: LightSystem | null
    __weatherSystem?: WeatherSystem | null
  }
  runtimeWindow.__dayNightSystem = services.dayNight
  runtimeWindow.__weatherSystem = services.weather
  runtimeWindow.__lightSystem = services.lights
}

function clearRuntimeServiceDebugGlobals(): void {
  const runtimeWindow = window as unknown as {
    __dayNightSystem?: DayNightSystem | null
    __lightSystem?: LightSystem | null
    __weatherSystem?: WeatherSystem | null
  }
  runtimeWindow.__dayNightSystem = null
  runtimeWindow.__weatherSystem = null
  runtimeWindow.__lightSystem = null
}
import type { WorldPursuitSystem } from '../../services/world/WorldPursuitSystem'
