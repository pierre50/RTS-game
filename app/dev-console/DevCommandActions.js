export {
  toggleAiDebug,
  toggleCoordsDebug,
  toggleGridDebug,
  togglePathDebug,
  togglePerfDebug,
  toggleSolidDebug,
  toggleVisionDebug,
} from './actions/debug'

export {
  toggleFog,
  toggleResourcesVisibility,
  toggleTerrainReveal,
  highlightInstances,
  killResources,
} from './actions/map'

export {
  addResources,
  applyTechnology,
  healAll,
  killEntities,
  setAge,
  setCiv,
  setGameSpeed,
  setPopMax,
  toggleInstantMode,
} from './actions/player'

export { spawnBuilding, spawnUnits } from './actions/spawn'
