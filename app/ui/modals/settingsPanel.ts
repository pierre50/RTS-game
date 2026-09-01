import { buildSelectRow, buildRangeRow, buildCheckboxRow } from '../utils/formUtils'
import { Modal } from '../../lib'
import { getLang, setLang, SUPPORTED_LANGS, t } from '../../lib/lang'
import {
  CONTROL_BINDING_GROUPS,
  type ControlBindingAction,
  getVolume,
  setVolume,
  getGameSpeed,
  setGameSpeed,
  getCameraZoom,
  setCameraZoom,
  getScreenBrightness,
  setScreenBrightness,
  getShadowsEnabled,
  setShadowsEnabled,
  getResourceWindAnimationEnabled,
  setResourceWindAnimationEnabled,
  getBloodEffectsEnabled,
  setBloodEffectsEnabled,
  SPEED_PRESETS,
  CAMERA_ZOOM_PRESETS,
  getControlKeyLabel,
  getKeyBindings,
  getGamepadButtonLabel,
  getGamepadBindings,
  resetKeyBindings,
  resetGamepadBindings,
  setKeyBindingFromKeyboardEvent,
  setGamepadBindingFromButtonIndex,
  getGamepadEnabled,
  setGamepadEnabled,
  type GamepadBindingAction,
} from '../../lib/audio/settings'
import { ModalTabs } from '../Tabs'

type SettingsTab = 'game' | 'graphics' | 'controls'
type SettingsContentOptions = {
  onLangChange?: () => void
  onSpeedChange?: (v: number) => void
  onZoomChange?: (v: number) => void
}

type SettingsModalOptions = SettingsContentOptions & {
  onClose?: () => void
}

/**
 * Builds the settings modal content element.
 * @param {object} opts
 * @param {Function} [opts.onLangChange] - called after language changes (e.g. to re-render menu)
 * @param {Function} [opts.onSpeedChange] - called with new speed value for live in-game updates
 * @param {Function} [opts.onZoomChange] - called with new zoom value for live in-game updates
 */
export function openSettingsModal(options: SettingsModalOptions = {}): Modal {
  const modalTabs = createSettingsTabs(options)
  const modal = new Modal({ content: modalTabs.element, onClose: options.onClose })
  modal._panel?.classList.add('settings-panel')
  modal._panel?.setAttribute('aria-label', t('settings'))
  modalTabs.mountHeader(modal._panel, 'settings-topbar')
  return modal
}

function createSettingsTabs({
  onLangChange,
  onSpeedChange,
  onZoomChange,
}: SettingsContentOptions): ModalTabs<SettingsTab> {
  const gamePanel = document.createElement('div')
  gamePanel.className = 'config-form settings-page'
  const graphicsPanel = document.createElement('div')
  graphicsPanel.className = 'config-form settings-page'
  const controlsPanel = document.createElement('div')
  controlsPanel.className = 'config-form settings-page'

  gamePanel.appendChild(
    buildSelectRow(
      t('language'),
      SUPPORTED_LANGS.map(({ code, label }) => ({ value: code, label })),
      getLang(),
      val => {
        setLang(val)
        if (onLangChange) onLangChange()
      }
    )
  )

  gamePanel.appendChild(
    buildSelectRow(
      t('gameSpeed'),
      SPEED_PRESETS.map(({ key, value }) => ({ value, label: t(key) })),
      getGameSpeed(),
      val => {
        const v = parseFloat(val)
        setGameSpeed(v)
        if (onSpeedChange) onSpeedChange(v)
      }
    )
  )

  gamePanel.appendChild(buildRangeRow(t('sfxVolume'), { min: 0, max: 1, step: 0.05, value: getVolume() }, setVolume))

  graphicsPanel.appendChild(
    buildSelectRow(
      t('cameraZoom'),
      CAMERA_ZOOM_PRESETS.map(({ key, value }) => ({ value, label: t(key) })),
      getCameraZoom(),
      val => {
        const v = parseFloat(val)
        setCameraZoom(v)
        if (onZoomChange) onZoomChange(v)
      }
    )
  )

  graphicsPanel.appendChild(
    buildRangeRow(
      t('screenBrightness'),
      { min: 0.5, max: 1.5, step: 0.05, value: getScreenBrightness() },
      setScreenBrightness
    )
  )

  graphicsPanel.appendChild(buildCheckboxRow(t('graphicsShadows'), getShadowsEnabled(), setShadowsEnabled))

  graphicsPanel.appendChild(
    buildCheckboxRow(t('resourceWindAnimation'), getResourceWindAnimationEnabled(), setResourceWindAnimationEnabled)
  )

  graphicsPanel.appendChild(buildCheckboxRow(t('bloodEffects'), getBloodEffectsEnabled(), setBloodEffectsEnabled))

  buildControlsPage(controlsPanel)

  return new ModalTabs<SettingsTab>(
    [
      { id: 'game', label: t('settingsTabGame'), page: gamePanel },
      { id: 'graphics', label: t('settingsTabGraphics'), page: graphicsPanel },
      { id: 'controls', label: t('settingsTabControls'), page: controlsPanel },
    ],
    'game'
  )
}

function buildControlsPage(panel: HTMLDivElement): void {
  const gamepadSection = document.createElement('div')
  gamepadSection.className = 'settings-controls-group'
  const gamepadTitle = document.createElement('h3')
  gamepadTitle.textContent = t('controlsGroupGamepad')
  gamepadSection.appendChild(gamepadTitle)
  gamepadSection.appendChild(buildCheckboxRow(t('gamepadEnabled'), getGamepadEnabled(), setGamepadEnabled))
  buildGamepadBindings(gamepadSection)
  panel.appendChild(gamepadSection)

  const bindings = getKeyBindings()
  const buttons = new Map<ControlBindingAction, HTMLButtonElement>()
  const conflictText = document.createElement('div')
  conflictText.className = 'settings-controls-conflict'

  function refresh(): void {
    const current = getKeyBindings()
    const used = new Map<string, ControlBindingAction[]>()
    for (const action of Object.keys(current) as ControlBindingAction[]) {
      buttons.get(action)!.textContent = getControlKeyLabel(current[action])
      const list = used.get(current[action]) || []
      list.push(action)
      used.set(current[action], list)
    }
    const conflicts = [...used.values()].filter(actions => actions.length > 1).flat()
    for (const [action, button] of buttons) {
      button.classList.toggle('is-conflict', conflicts.includes(action))
    }
    conflictText.textContent = conflicts.length ? t('controlsConflict') : ''
  }

  for (const group of CONTROL_BINDING_GROUPS) {
    const section = document.createElement('div')
    section.className = 'settings-controls-group'
    const title = document.createElement('h3')
    title.textContent = t(group.key)
    section.appendChild(title)

    for (const action of group.actions) {
      const row = document.createElement('div')
      row.className = 'config-row settings-key-row'
      const label = document.createElement('label')
      label.textContent = t(`controlAction_${action}`)
      row.appendChild(label)

      const button = document.createElement('button')
      button.type = 'button'
      button.className = 'settings-key-button ui-btn'
      button.textContent = getControlKeyLabel(bindings[action])
      button.addEventListener('click', () => {
        button.textContent = t('controlsPressKey')
        button.classList.add('is-listening')
        button.focus()
      })
      button.addEventListener('blur', () => {
        if (!button.classList.contains('is-listening')) return
        button.classList.remove('is-listening')
        refresh()
      })
      button.addEventListener(
        'keydown',
        evt => {
          if (!button.classList.contains('is-listening')) return
          evt.preventDefault()
          evt.stopPropagation()
          if (evt.key === 'Escape') {
            button.classList.remove('is-listening')
            refresh()
            return
          }
          setKeyBindingFromKeyboardEvent(action, evt)
          button.classList.remove('is-listening')
          refresh()
        },
        true
      )
      buttons.set(action, button)
      row.appendChild(button)
      section.appendChild(row)
    }

    panel.appendChild(section)
  }

  const reset = document.createElement('button')
  reset.type = 'button'
  reset.className = 'settings-reset-button ui-btn'
  reset.textContent = t('controlsReset')
  reset.addEventListener('click', () => {
    resetKeyBindings()
    resetGamepadBindings()
    refresh()
  })

  panel.appendChild(conflictText)
  panel.appendChild(reset)
  refresh()
}

function buildGamepadBindings(section: HTMLDivElement): void {
  const actions: GamepadBindingAction[] = ['inventoryTransferOne', 'inventoryTransferAll']
  const buttons = new Map<GamepadBindingAction, HTMLButtonElement>()
  let listeningAction: GamepadBindingAction | null = null
  let listeningFrame = 0

  function refresh(): void {
    const bindings = getGamepadBindings()
    const used = new Map<string, GamepadBindingAction[]>()
    for (const action of actions) {
      buttons.get(action)!.textContent = getGamepadButtonLabel(bindings[action])
      const list = used.get(bindings[action]) || []
      list.push(action)
      used.set(bindings[action], list)
    }
    const conflicts = [...used.values()].filter(list => list.length > 1).flat()
    for (const [action, button] of buttons) {
      button.classList.toggle('is-conflict', conflicts.includes(action))
    }
  }

  function stopListening(button: HTMLButtonElement): void {
    listeningAction = null
    button.classList.remove('is-listening')
    cancelAnimationFrame(listeningFrame)
    refresh()
  }

  function listenForButton(action: GamepadBindingAction, button: HTMLButtonElement): void {
    listeningAction = action
    button.textContent = t('controlsPressButton')
    button.classList.add('is-listening')
    const poll = () => {
      if (listeningAction !== action) return
      const pads = navigator.getGamepads?.() ?? []
      for (const pad of pads) {
        const index = pad?.buttons.findIndex(gamepadButton => gamepadButton.pressed)
        if (index != null && index >= 0) {
          setGamepadBindingFromButtonIndex(action, index)
          stopListening(button)
          return
        }
      }
      listeningFrame = requestAnimationFrame(poll)
    }
    poll()
  }

  for (const action of actions) {
    const row = document.createElement('div')
    row.className = 'config-row settings-key-row'
    const label = document.createElement('label')
    label.textContent = t(`controlAction_${action}`)
    row.appendChild(label)

    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'settings-key-button ui-btn'
    button.textContent = getGamepadButtonLabel(getGamepadBindings()[action])
    button.addEventListener('click', () => listenForButton(action, button))
    button.addEventListener('blur', () => {
      if (listeningAction === action) stopListening(button)
    })
    buttons.set(action, button)
    row.appendChild(button)
    section.appendChild(row)
  }

  refresh()
}
