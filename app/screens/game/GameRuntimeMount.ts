import { type ContainerChild } from 'pixi.js'
import {
  activateBuildingInteriorSpace,
  getBuildingInteriorSpaceForUnit,
} from '../../services/BuildingInteriorSpaceSystem'
import type Game from '../Game'
import { addRuntimeServiceLayers, createRuntimeServices } from './runtimeServices'
export function mountGameRuntime(game: Game, dayNightElapsedMs: number | null | undefined = null): void {
  const { map, controls } = game.context
  if (!map || !controls) return
  game.addChild(map as unknown as ContainerChild)
  game._runtimeServices = createRuntimeServices(
    game._gameContext(),
    map,
    () => game._getScreenRect(),
    dayNightElapsedMs,
    game
  )
  addRuntimeServiceLayers(game, game._runtimeServices)
  game.addChild(controls)
  game.applyZoom()
  game._attachWindowListeners()
  const hero = controls.heroUnit
  const interiorSpace = hero && getBuildingInteriorSpaceForUnit(hero)
  if (hero && interiorSpace?.building.cave) {
    activateBuildingInteriorSpace(game._gameContext(), interiorSpace)
    game._activeBuildingInteriorSpace = interiorSpace
    controls.focusHeroCamera()
    controls.updateVisibleCells?.()
    game.context.menu?.refreshMiniMap?.()
  }
}
