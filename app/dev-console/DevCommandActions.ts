export {
  aiInfo,
  performanceReport,
  toggleCoordsDebug,
  toggleFreeCamera,
  toggleGridDebug,
  toggleHeroCollisionDebug,
  togglePathDebug,
  togglePerfDebug,
  togglePlayerStatsDebug,
  toggleSolidDebug,
  toggleTerrainFrameDebug,
  toggleVisionDebug,
} from './actions/debug'

export {
  toggleFog,
  toggleResourcesVisibility,
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
