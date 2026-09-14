import { migrateTutorialVillageOwner } from '../../services/tutorial/TutorialVillageMigration'
import type { NewGameBootOptions } from './GameWorldBoot'
import { TutorialPrologue } from '../../ui/TutorialPrologue'
import { tutorialVillageConfig } from '../../services/tutorial/TutorialVillage'
import type { Application } from 'pixi.js'
import { t } from '../../lib/lang'
import { Modal } from '../../lib'
import { validateSaveData } from '../../serialization/SaveValidator'
import { createInitialCampaignSave, getCurrentWorldState, isCampaignSave } from '../../serialization/CampaignSave'
import { getGameSpeed } from '../../lib/audio/settings'
import { GameLoadingScreen } from '../../ui/GameLoadingScreen'
import { playBuildingInteriorDoorTransition } from '../../ui/BuildingInteriorTransition'
import type { SchedulerLike } from '../../types/context'
import type { CampaignSave, GameConfig, SaveRecord, SerializedSave } from '../../types/save'
import type { UnitEntity } from '../../types/entities'
import { ensureCampaignPlayerRoster, worldStateWithCampaignClock, saveConfig } from './GameStateHelpers'

type BootFlowContext = {
  defeat?: boolean
  paused?: boolean
  app: Application
  controls?: { focusHeroCamera?(): void } | null
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
  _loadingScreen?: LoadingScreenLike | null
  _lastSavedRecord?: SaveRecord | null
  _restartSaveData: SaveRecord | null
  config: GameConfig | null
  context: BootFlowContext
  _prepareIntroduction?(): Promise<void>
  _prepareTutorial?(): Promise<void>
  _restoreTutorial?(): Promise<void>
  _showTutorial?(): void
  _startTutorial?(): void
  _showIntroduction?(): void
  _startIntroduction?(): void
  _acquireWakeLock(): Promise<void>
  _bootFromConfig(config: GameConfig, options?: NewGameBootOptions): Promise<void>
  _bootFromSave(json: SerializedSave): Promise<void>
  _destroyRuntime(): void
  _measure<T>(name: string, callback: () => T): T
  _runtimeHeroUnit(): UnitEntity | null
  _yieldToBrowser(): Promise<void>
  togglePause?(paused: boolean, options?: { silent?: boolean }): void
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
  const state = worldStateWithCampaignClock(
    structuredClone(getCurrentWorldState(game._restartSaveData)),
    game._campaignSave?.clock?.dayNightElapsedMs
  )
  if (game._campaignSave) migrateTutorialVillageOwner(game._campaignSave, state)
  return state
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

async function finishBoot(game: GameBootFlowHost, booted: boolean, protectHero = false, reveal?: () => Promise<void>): Promise<void> {
  if (booted) await game._restoreTutorial?.()
  const hero = booted && protectHero ? game._runtimeHeroUnit() : null
  const previousDevInvincible = hero?.devInvincible
  if (hero) hero.devInvincible = true
  if (booted) game._showIntroduction?.()
  if (booted) game._showTutorial?.()
  const showGame = (): void => {
    game._measure('loading.destroy', () => game._loadingScreen?.destroy())
    game._loadingScreen = null
    if (booted) game._measure('menu.show', () => game.context.menu?.show?.())
  }
  try {
    if (booted && reveal) {
      showGame()
      game.context.controls?.focusHeroCamera?.()
      game.context.app.render()
      await game._yieldToBrowser()
      await reveal()
    } else if (booted)
      await playBuildingInteriorDoorTransition(showGame, {
        blockInput: true,
        beforeReveal: () => {
          game.context.controls?.focusHeroCamera?.()
          game.context.app.render()
        },
      })
    else showGame()
  } finally {
    if (hero) restoreHeroInvincibility(hero, previousDevInvincible)
  }
  if (booted) game._startIntroduction?.()
  if (booted) game._startTutorial?.()
}

export async function startGameRuntime(game: GameBootFlowHost): Promise<void> {
  game._acquireWakeLock()
  applyConfiguredSpeed(game)
  const prologue = game._prepareTutorial ? new TutorialPrologue() : null
  let booted = false
  try {
    if (!game.config) throw new Error(t('corruptSave'))
    const choice = prologue?.chooseSkip() ?? Promise.resolve(false)
    if (prologue) {
      // Prologue owns presentation; loading reports remain exclusive to loading screens.
      game._loadingScreen = null
      await game._yieldToBrowser()
    } else await showLoadingScreen(game, 'generatingWorld')
    // Terrain and unit assets load during narration; only village setup waits for the choice.
    const startingSetup = prologue ? choice.then(skip => skip
      ? { heroOnlyStart: true, villageStarts: undefined }
      : tutorialVillageConfig(game.config!)) : undefined
    await game._bootFromConfig(prologue ? { ...game.config, heroStartVillage: undefined } : game.config, { startingSetup, startPaused: Boolean(prologue) })
    const skipTutorial = await choice
    if (game._prepareTutorial && !skipTutorial) await game._prepareTutorial()
    else await game._prepareIntroduction?.()
    booted = true
    await finishBoot(game, true, true, prologue ? () => prologue.reveal() : undefined)
  } finally {
    prologue?.destroy()
    if (!booted) await finishBoot(game, false)
  }
}

export async function loadGameRuntime(game: GameBootFlowHost, json: SaveRecord): Promise<void> {
  let booted = false
  try {
    const saveData = validateSaveData(json)
    game._campaignSave = ensureCampaignPlayerRoster(
      isCampaignSave(saveData) ? structuredClone(saveData) : createInitialCampaignSave(structuredClone(saveData))
    )
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
    await finishBoot(game, booted)
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
    try {
      await finishBoot(game, booted)
    } finally {
      game._isRestarting = false
    }
  }
}

/** One transition for both checkpoint recovery and the scripted tutorial ending. */
export async function recoverGameAfterDefeat(game: GameBootFlowHost, tutorialEnding = false): Promise<void> {
  const checkpoint = tutorialEnding ? null : structuredClone(game._lastSavedRecord ?? game._restartSaveData)
  if (!tutorialEnding && !checkpoint) throw new Error(t('corruptSave'))
  const config = game.config ?? (game._campaignSave
    ? saveConfig(getCurrentWorldState(game._campaignSave).config)
    : null)
  if (tutorialEnding && !config) throw new Error(t('corruptSave'))
  game.togglePause?.(true, { silent: true })
  await playBuildingInteriorDoorTransition(async () => {
    game.context.defeat = false
    game.togglePause?.(false, { silent: true })
    game._destroyRuntime()
    applyConfiguredSpeed(game)
    if (tutorialEnding) {
      game._campaignSave = null
      game._lastSavedRecord = null
      game._restartSaveData = null
      await game._bootFromConfig({ ...config!, heroOnlyStart: true, heroStartVillage: undefined, villageStarts: undefined }, { startPaused: true })
      await game._prepareIntroduction?.()
    } else {
      const save = validateSaveData(checkpoint!)
      game._campaignSave = ensureCampaignPlayerRoster(
        isCampaignSave(save) ? structuredClone(save) : createInitialCampaignSave(structuredClone(save))
      )
      game._restartSaveData = structuredClone(game._campaignSave)
      game.context.paused = true
      await game._bootFromSave(currentCampaignWorld(game))
      await game._restoreTutorial?.()
    }
    game._showIntroduction?.()
    game._showTutorial?.()
    game.context.menu?.show?.()
    game.context.controls?.focusHeroCamera?.()
    game.context.app.render()
  }, { blockInput: true })
  game.togglePause?.(false, { silent: true })
  game._startIntroduction?.()
  game._startTutorial?.()
}
