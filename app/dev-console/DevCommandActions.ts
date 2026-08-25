export {
  aiInfo,
  performanceReport,
  toggleCoordsDebug,
  toggleFreeCamera,
  toggleGridDebug,
  toggleHeroAimDebug,
  togglePathDebug,
  togglePerfDebug,
  togglePlayerStatsDebug,
  toggleSolidDebug,
  toggleTerrainFrameDebug,
  toggleVisionDebug,
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
  toggleHeroInvincible,
  toggleInstantMode,
} from './actions/player'

export { spawnAnimal, spawnBuilding, spawnUnits, TRIBAL_BUILDING_COMPLETIONS } from './actions/spawn'

export { addHeroInventoryEquipment } from './actions/heroInventory'

export { forceNextDay, setTime, setWeatherPhase, showTimeState, WEATHER_PHASES } from './actions/world'
