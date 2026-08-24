import type { ContainerChild } from 'pixi.js'
import { CampPatrolSystem } from '../../services/CampPatrolSystem'
import { DailyWorldEventSystem } from '../../services/DailyWorldEventSystem'
import { DayNightSystem } from '../../services/DayNightSystem'
import { LightSystem } from '../../services/LightSystem'
import { ShadowSystem } from '../../services/ShadowSystem'
import { TributeRaidSystem } from '../../services/TributeRaidSystem'
import { VillagerShelterSystem } from '../../services/VillagerShelterSystem'
import { WeatherSystem } from '../../services/WeatherSystem'
import type { GameContextLike } from '../../types/context'
import type { RuntimeMap } from '../../types/map'

type ScreenRect = { height: number; width: number; x: number; y: number }
type LayerHost = { addChild(child: ContainerChild): unknown }
type RuntimeServiceContext = Pick<GameContextLike, 'dayNight' | 'tributeRaids' | 'villagerShelter' | 'weather'>

export type RuntimeServices = {
  campPatrols: CampPatrolSystem | null
  dailyWorldEvents: DailyWorldEventSystem | null
  dayNight: DayNightSystem | null
  lights: LightSystem | null
  shadows: ShadowSystem | null
  tributeRaids: TributeRaidSystem | null
  villagerShelter: VillagerShelterSystem | null
  weather: WeatherSystem | null
}

export function createEmptyRuntimeServices(): RuntimeServices {
  return {
    campPatrols: null,
    dailyWorldEvents: null,
    dayNight: null,
    lights: null,
    shadows: null,
    tributeRaids: null,
    villagerShelter: null,
    weather: null,
  }
}

export function createRuntimeServices(
  context: GameContextLike,
  map: RuntimeMap,
  getScreenRect: () => ScreenRect,
  dayNightElapsedMs: number | null | undefined = null
): RuntimeServices {
  const dayNight = new DayNightSystem(context, { elapsedMs: dayNightElapsedMs })
  context.dayNight = dayNight

  const dailyWorldEvents = new DailyWorldEventSystem(context)
  const villagerShelter = new VillagerShelterSystem(context)
  context.villagerShelter = villagerShelter

  const tributeRaids = new TributeRaidSystem(context)
  context.tributeRaids = tributeRaids
  dailyWorldEvents.register(tributeRaids)

  const campPatrols = new CampPatrolSystem(context)
  const shadows = new ShadowSystem(context, map)
  const weather = new WeatherSystem(context, map, getScreenRect)
  context.weather = weather

  const lights = new LightSystem(context, getScreenRect, () => dayNight.getDarknessLevel())
  const services = {
    campPatrols,
    dailyWorldEvents,
    dayNight,
    lights,
    shadows,
    tributeRaids,
    villagerShelter,
    weather,
  }

  exposeRuntimeServiceDebugGlobals(services)
  return services
}

export function addRuntimeServiceLayers(host: LayerHost, services: RuntimeServices): void {
  if (services.lights) host.addChild(services.lights.layer)
  if (services.weather) host.addChild(services.weather.layer)
}

export function destroyRuntimeServices(
  services: RuntimeServices,
  context: RuntimeServiceContext
): RuntimeServices {
  services.lights?.destroy()
  services.shadows?.destroy()
  services.dailyWorldEvents?.destroy()
  services.villagerShelter?.destroy()
  services.campPatrols?.destroy()
  services.dayNight?.destroy()
  services.weather?.destroy()

  context.dayNight = null
  context.weather = null
  context.tributeRaids = null
  context.villagerShelter = null
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
