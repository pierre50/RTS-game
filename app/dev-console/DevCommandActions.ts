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
