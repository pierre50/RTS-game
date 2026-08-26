import type { Application } from 'pixi.js'
import { t } from '../../lib/lang'
import { Modal } from '../../lib'
import { validateSaveData } from '../../serialization/SaveValidator'
import { createInitialCampaignSave, getCurrentWorldState, isCampaignSave } from '../../serialization/CampaignSave'
import { getGameSpeed } from '../../lib/audio/settings'
import { GameLoadingScreen } from '../../ui/GameLoadingScreen'
import {
  WorldRevealTransition,
  type PortalRevealPoint,
  type PortalTravelTransition,
} from '../../ui/PortalTravelTransition'
import type { SchedulerLike } from '../../types/context'
import type { CampaignSave, GameConfig, SaveRecord, SerializedSave } from '../../types/save'
import type { UnitEntity } from '../../types/entities'
import { worldStateWithCampaignClock } from './GameStateHelpers'

type BootFlowContext = {
  app: Application
  menu?: { show?(): void } | null
  scheduler?: SchedulerLike | null
}

type LoadingScreenLike = {
  destroy(): void
  update(messageKey: string, progress: number): void
}

export type GameBootFlowHost = {
  _campaignSave: CampaignSave | null
  _isRestarting: boolean
  _loadingScreen?: LoadingScreenLike | PortalTravelTransition | null
  _restartSaveData: SaveRecord | null
  config: GameConfig | null
  context: BootFlowContext
  _acquireWakeLock(): Promise<void>
  _bootFromConfig(config: GameConfig): Promise<void>
  _bootFromSave(json: SerializedSave): Promise<void>
  _destroyRuntime(): void
  _getHeroRevealPoint(): PortalRevealPoint | null
  _measure<T>(name: string, callback: () => T): T
  _runtimeHeroUnit(): UnitEntity | null
  _yieldToBrowser(): Promise<void>
  quit(): void
}

function applyConfiguredSpeed(game: GameBootFlowHost): void {
  const speed = getGameSpeed()
  game.context.app.ticker.speed = speed
  if (game.context.scheduler) game.context.scheduler.timeScale = speed
}

async function showLoadingScreen(game: GameBootFlowHost, messageKey: string): Promise<void> {
  game._loadingScreen = new GameLoadingScreen()
  game._loadingScreen.update(messageKey, 0.02)
  await game._yieldToBrowser()
}

function currentCampaignWorld(game: GameBootFlowHost): SerializedSave {
  if (!game._restartSaveData) throw new Error(t('corruptSave'))
  return worldStateWithCampaignClock(
    structuredClone(getCurrentWorldState(game._restartSaveData)),
    game._campaignSave?.clock?.dayNightElapsedMs
  )
}

function showInvalidSaveModal(message: string): void {
  const content = document.createElement('div')
  content.className = 'modal-menu'
  const paragraph = document.createElement('p')
  paragraph.className = 'save-list-confirm-message'
  paragraph.textContent = message
  content.appendChild(paragraph)
  new Modal({ title: t('invalidSaveFile'), content })
}

function restoreHeroInvincibility(hero: UnitEntity, previousDevInvincible: boolean | undefined): void {
  if (previousDevInvincible === undefined) {
    delete hero.devInvincible
  } else {
    hero.devInvincible = previousDevInvincible
  }
}

async function finishInitialBoot(game: GameBootFlowHost, booted: boolean): Promise<void> {
  const revealPoint = booted ? game._getHeroRevealPoint() : null
  const initialReveal = booted ? new WorldRevealTransition(revealPoint) : null
  const hero = booted ? game._runtimeHeroUnit() : null
  const previousDevInvincible = hero?.devInvincible
  if (hero) hero.devInvincible = true
  game._measure('loading.destroy', () => game._loadingScreen?.destroy())
  game._loadingScreen = null
  if (!booted) {
    initialReveal?.destroy()
    return
  }
  game._measure('menu.show', () => game.context.menu?.show?.())
  try {
    await initialReveal?.revealFrom(game._getHeroRevealPoint() ?? revealPoint)
  } finally {
    if (hero) restoreHeroInvincibility(hero, previousDevInvincible)
  }
}

function finishBoot(game: GameBootFlowHost, booted: boolean): void {
  game._measure('loading.destroy', () => game._loadingScreen?.destroy())
  game._loadingScreen = null
  if (booted) game._measure('menu.show', () => game.context.menu?.show?.())
}

export async function startGameRuntime(game: GameBootFlowHost): Promise<void> {
  game._acquireWakeLock()
  applyConfiguredSpeed(game)
  await showLoadingScreen(game, 'generatingWorld')
  let booted = false
  try {
    if (!game.config) throw new Error(t('corruptSave'))
    await game._bootFromConfig(game.config)
    booted = true
  } finally {
    await finishInitialBoot(game, booted)
  }
}

export async function loadGameRuntime(game: GameBootFlowHost, json: SaveRecord): Promise<void> {
  let booted = false
  try {
    const saveData = validateSaveData(json)
    game._campaignSave = isCampaignSave(saveData)
      ? structuredClone(saveData)
      : createInitialCampaignSave(structuredClone(saveData))
    game._restartSaveData = structuredClone(game._campaignSave)
    game._destroyRuntime()
    applyConfiguredSpeed(game)
    await showLoadingScreen(game, 'generatingTerrain')
    await game._bootFromSave(currentCampaignWorld(game))
    booted = true
  } catch (error) {
    const message = error instanceof Error ? error.message : t('corruptSave')
    game.quit()
    showInvalidSaveModal(message)
  } finally {
    finishBoot(game, booted)
  }
}

export async function restartGameRuntime(game: GameBootFlowHost): Promise<void> {
  if (game._isRestarting || !game._restartSaveData) return
  game._isRestarting = true
  game._destroyRuntime()
  applyConfiguredSpeed(game)
  await showLoadingScreen(game, 'generatingTerrain')
  let booted = false
  try {
    await game._bootFromSave(currentCampaignWorld(game))
    booted = true
  } finally {
    finishBoot(game, booted)
    game._isRestarting = false
  }
}
