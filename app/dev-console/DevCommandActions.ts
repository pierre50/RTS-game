export {
  aiInfo,
  performanceReport,
  setFpsCapDebug,
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
  applyAllTechnologies,
  applyTechnology,
  healAll,
  killEntities,
  listGlobalPlayers,
  setAge,
  setCiv,
  setGameSpeed,
  setPopMax,
  toggleHeroInvincible,
  toggleInstantMode,
} from './actions/player'

export { spawnAnimal, spawnBuilding, spawnUnits, DECO_BUILDING_COMPLETIONS } from './actions/spawn'

export { addHeroInventoryEquipment, addHeroInventoryResources } from './actions/heroInventory'

export { advanceTime } from './actions/timeSkip'
export { forceNextDay, setWeatherPhase, WEATHER_PHASES } from './actions/world'
