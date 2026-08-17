export {
  aiInfo,
  performanceReport,
  toggleCoordsDebug,
  toggleFreeCamera,
  toggleGridDebug,
  toggleHeroAimDebug,
  toggleHeroCollisionDebug,
  togglePathDebug,
  togglePerfDebug,
  togglePlayerStatsDebug,
  toggleSolidDebug,
  toggleTerrainFrameDebug,
  toggleVisionDebug,
  refreshEntityBars,
  toggleEntityBars,
} from './actions/debug'

export {
  toggleFog,
  toggleResourcesVisibility,
  teleportHeroToPortal,
  highlightInstances,
  killResources,
} from './actions/map'

export {
  addResources,
  applyAllTechnologies,
  applyTechnology,
  healAll,
  killEntities,
  setAge,
  setCiv,
  setGameSpeed,
  setPopMax,
  toggleInstantMode,
} from './actions/player'

export { spawnAnimal, spawnBuilding, spawnFloatingItem, spawnUnits } from './actions/spawn'

export { forceNextDay, setWeatherPhase, showTimeState, WEATHER_PHASES } from './actions/world'
