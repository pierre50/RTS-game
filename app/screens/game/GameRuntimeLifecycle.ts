import { sound } from '@pixi/sound'
import { t } from '../../lib/lang'
import { debounce, isPlayedHeroDefeated } from '../../lib'
import { clearAllCombatFeedback } from '../../lib/combat/combatFeedback'
import { stopAllUiSounds } from '../../lib/audio/uiSound'
import { getCameraZoom, getControlActionForKeyboardEvent } from '../../lib/audio/settings'
import { collectPausableInstances } from './pausableRuntime'
import type { Application, Container } from 'pixi.js'
import type { RuntimeMap } from '../../types/map'
import type { PlayerLike } from '../../types/player'
import type { UnitEntity } from '../../types/entities'

type LifecycleContext = {
  app: Application
  controls?: { heroUnit?: UnitEntity | null; updateVisibleCells?: () => void } | null
  defeat?: boolean
  devConsoleOpen?: boolean
  map?: RuntimeMap | null
  menu?: { pauseMenu?: { open: () => void }; updateCameraMiniMap?: () => void; isMiniMapActive?: () => boolean } | null
  paused?: boolean
  player?: PlayerLike | null
  players?: PlayerLike[]
  pause: () => void
  resume: () => void
}

export type GameRuntimeLifecycleHost = Container & {
  _loadingScreen?: { destroy(): void } | null
  _onDocumentVisibilityChange?: () => void
  _onKeydown?: (evt: KeyboardEvent) => void
  _onResize?: () => void
  _onVisibilityChange?: () => void
  _pausedByOrientation: boolean
  _pausedByVisibility: boolean
  _wakeLock?: WakeLockSentinel | null
  applyZoom(): void
  context: LifecycleContext
  quit(): void
  togglePause(pause: boolean, options?: { silent?: boolean }): void
}

export async function acquireGameWakeLock(game: GameRuntimeLifecycleHost): Promise<void> {
  if (!navigator.wakeLock) return
  try {
    game._wakeLock = await navigator.wakeLock.request('screen')
    document.addEventListener(
      'visibilitychange',
      (game._onVisibilityChange = async () => {
        if (game._wakeLock && document.visibilityState === 'visible') {
          game._wakeLock = await navigator.wakeLock.request('screen').catch(() => null)
        }
      })
    )
  } catch {
    // silently ignored: wake lock is a hint, not a requirement
  }
}

export function attachGameWindowListeners(game: GameRuntimeLifecycleHost): void {
  game._onKeydown = evt => handleGameKeydown(game, evt)
  game._onResize = debounce(() => {
    game.applyZoom()
    game.context.controls?.updateVisibleCells?.()
    if (game.context.menu?.isMiniMapActive?.() !== false) game.context.menu?.updateCameraMiniMap?.()
  }, 100)
  game._onDocumentVisibilityChange = () => {
    if (document.visibilityState === 'hidden') {
      handleGameDocumentHidden(game)
      return
    }
    handleGameDocumentVisible(game)
  }
  window.addEventListener('keydown', game._onKeydown)
  window.addEventListener('resize', game._onResize)
  document.addEventListener('visibilitychange', game._onDocumentVisibilityChange)
}

function handleGameKeydown(game: GameRuntimeLifecycleHost, evt: KeyboardEvent): void {
  if (evt.defaultPrevented) return
  if (game.context.devConsoleOpen) return
  if (evt.key === 'Escape') {
    if (game.context.defeat) return
    if (document.querySelector('.modal')) return
    evt.preventDefault()
    game.context.menu?.pauseMenu?.open()
    return
  }
  if (getControlActionForKeyboardEvent(evt) !== 'pause') return
  if (game.context.defeat) return
  if (document.querySelector('.modal')) return
  game.context.paused ? game.context.resume() : game.context.pause()
}

export function removeGameWindowListeners(game: GameRuntimeLifecycleHost): void {
  window.removeEventListener('keydown', game._onKeydown as EventListener)
  window.removeEventListener('resize', game._onResize as EventListener)
  document.removeEventListener('visibilitychange', game._onDocumentVisibilityChange as EventListener)
}

export function handleGameDocumentHidden(game: GameRuntimeLifecycleHost): void {
  if (!game.context.paused && !game.context.defeat) {
    game._pausedByVisibility = true
    game.togglePause(true, { silent: true })
  }
  sound.stopAll()
  stopAllUiSounds()
}

export function handleGameDocumentVisible(game: GameRuntimeLifecycleHost): void {
  if (!game._pausedByVisibility) return
  if (game._pausedByOrientation) return
  game._pausedByVisibility = false
  if (!game.context.defeat) {
    game.togglePause(false, { silent: true })
  }
}

export function setGameOrientationBlocked(game: GameRuntimeLifecycleHost, blocked: boolean): void {
  if (blocked) {
    if (!game.context.paused && !game.context.defeat) {
      game._pausedByOrientation = true
      game.togglePause(true, { silent: true })
    }
    return
  }

  if (!game._pausedByOrientation) return
  game._pausedByOrientation = false
  if (!game._pausedByVisibility && !game.context.defeat) {
    game.togglePause(false, { silent: true })
  }
}

export function applyGameZoom(game: GameRuntimeLifecycleHost): void {
  const zoom = getCameraZoom()
  game.scale.set(zoom)
  game.position.set((game.context.app.screen.width * (1 - zoom)) / 2, (game.context.app.screen.height * (1 - zoom)) / 2)
}

export function checkGameDefeat(game: GameRuntimeLifecycleHost): boolean {
  const { player } = game.context
  if (game.context.defeat || !player) return false

  if (!isPlayedHeroDefeated(player, game.context.controls?.heroUnit)) return false

  game.context.defeat = true
  clearAllCombatFeedback()
  const div = document.createElement('div')
  div.id = 'defeat'
  div.className = 'game-overlay'
  div.innerText = t('defeat')
  document.body.appendChild(div)
  return true
}

export function toggleGamePause(
  game: GameRuntimeLifecycleHost,
  pause: boolean,
  options: { silent?: boolean } = {}
): void {
  if (game.context.defeat && !pause) return
  const { map, players = [] } = game.context
  if (!map) return
  if (pause) {
    document.getElementById('pause')?.remove()
    if (!options.silent && !game.context.defeat) {
      const div = document.createElement('div')
      div.id = 'pause'
      div.className = 'game-overlay'
      div.innerText = t('pause')
      document.body.appendChild(div)
    }
  } else {
    document.getElementById('pause')?.remove()
  }
  for (const instance of collectPausableInstances(map, players)) {
    pause ? instance.pause?.() : instance.resume?.()
  }
  game.context.paused = pause
}
