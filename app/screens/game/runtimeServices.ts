import type { ContainerChild } from 'pixi.js'
import { BuildingInteriorEntryMarkerSystem } from '../../services/BuildingInteriorEntryMarkerSystem'
import { CampPatrolSystem } from '../../services/CampPatrolSystem'
import { DailyWorldEventSystem } from '../../services/DailyWorldEventSystem'
import { DayNightSystem } from '../../services/DayNightSystem'
import { InteriorExitMarkerSystem } from '../../services/InteriorExitMarkerSystem'
import { HeroFollowerPatrolSystem } from '../../services/HeroFollowerPatrolSystem'
import { IdleUnitPatrolSystem } from '../../services/IdleUnitPatrolSystem'
import { LightSystem } from '../../services/LightSystem'
import { ShadowSystem } from '../../services/ShadowSystem'
import { TimeSkipSystem } from '../../services/TimeSkipSystem'
import { TributeRaidSystem } from '../../services/TributeRaidSystem'
import { UnitEnergyRegenSystem } from '../../services/UnitEnergyRegenSystem'
import { UnitRestSystem } from '../../services/rest/UnitRestSystem'
import { WeatherSystem } from '../../services/WeatherSystem'
import { ResourceDeliverySystem } from './GameResourceDelivery'
import type { GameContextLike } from '../../types/context'
import type { RuntimeMap } from '../../types/map'

type ScreenRect = { height: number; width: number; x: number; y: number }
type LayerHost = { addChild(child: ContainerChild): unknown }
type RuntimeServiceContext = Pick<GameContextLike, 'dayNight' | 'timeSkip' | 'tributeRaids' | 'unitRest' | 'weather'>

export type RuntimeServices = {
  buildingInteriorEntryMarker: BuildingInteriorEntryMarkerSystem | null
  campPatrols: CampPatrolSystem | null
  dailyWorldEvents: DailyWorldEventSystem | null
  dayNight: DayNightSystem | null
  heroFollowerPatrols: HeroFollowerPatrolSystem | null
  idleUnitPatrols: IdleUnitPatrolSystem | null
  interiorExitMarker: InteriorExitMarkerSystem | null
  lights: LightSystem | null
  resourceDelivery: ResourceDeliverySystem | null
  shadows: ShadowSystem | null
  timeSkip: TimeSkipSystem | null
  tributeRaids: TributeRaidSystem | null
  unitEnergyRegen: UnitEnergyRegenSystem | null
  unitRest: UnitRestSystem | null
  weather: WeatherSystem | null
}

export function createEmptyRuntimeServices(): RuntimeServices {
  return {
    buildingInteriorEntryMarker: null,
    campPatrols: null,
    dailyWorldEvents: null,
    dayNight: null,
    heroFollowerPatrols: null,
    idleUnitPatrols: null,
    interiorExitMarker: null,
    lights: null,
    resourceDelivery: null,
    shadows: null,
    timeSkip: null,
    tributeRaids: null,
    unitEnergyRegen: null,
    unitRest: null,
    weather: null,
  }
}

export function createRuntimeServices(
  context: GameContextLike,
  map: RuntimeMap,
  getScreenRect: () => ScreenRect,
  dayNightElapsedMs: number | null | undefined = null
): RuntimeServices {
  const isInterior = map.mapType === 'interior'
  const timeSkip = new TimeSkipSystem(context)
  context.timeSkip = timeSkip

  const dayNight = new DayNightSystem(context, { elapsedMs: dayNightElapsedMs })
  context.dayNight = dayNight

  const dailyWorldEvents = new DailyWorldEventSystem(context)
  const unitRest = new UnitRestSystem(context)
  context.unitRest = unitRest

  const tributeRaids = new TributeRaidSystem(context)
  context.tributeRaids = tributeRaids
  dailyWorldEvents.register(tributeRaids)

  const campPatrols = new CampPatrolSystem(context)
  const heroFollowerPatrols = new HeroFollowerPatrolSystem(context)
  const idleUnitPatrols = new IdleUnitPatrolSystem(context)
  const unitEnergyRegen = new UnitEnergyRegenSystem(context)
  const resourceDelivery = new ResourceDeliverySystem(context)
  const shadows = new ShadowSystem(context, map)
  const buildingInteriorEntryMarker = isInterior ? null : new BuildingInteriorEntryMarkerSystem(context, map)
  const interiorExitMarker = isInterior ? new InteriorExitMarkerSystem(context, map) : null
  const weather = isInterior ? null : new WeatherSystem(context, map, getScreenRect)
  context.weather = weather

  const lights = new LightSystem(context, getScreenRect, () => dayNight.getDarknessLevel())
  const services = {
    buildingInteriorEntryMarker,
    campPatrols,
    dailyWorldEvents,
    dayNight,
    heroFollowerPatrols,
    idleUnitPatrols,
    interiorExitMarker,
    lights,
    resourceDelivery,
    shadows,
    timeSkip,
    tributeRaids,
    unitEnergyRegen,
    unitRest,
    weather,
  }

  exposeRuntimeServiceDebugGlobals(services)
  return services
}

export function addRuntimeServiceLayers(host: LayerHost, services: RuntimeServices): void {
  if (services.lights) host.addChild(services.lights.layer)
  if (services.weather) host.addChild(services.weather.layer)
}

export function destroyRuntimeServices(services: RuntimeServices, context: RuntimeServiceContext): RuntimeServices {
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
  services.unitEnergyRegen?.destroy()
  services.resourceDelivery?.destroy()
  services.dayNight?.destroy()
  services.weather?.destroy()

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
