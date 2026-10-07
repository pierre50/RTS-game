import { buildSelectRow, buildRangeRow, buildCheckboxRow } from '../utils/formUtils'
import { Modal } from '../../lib'
import { getLang, setLang, SUPPORTED_LANGS, t } from '../../lib/lang'
import {
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
} from '../../lib/audio/settings'
import { getVirtualKeyboardLayout, setVirtualKeyboardLayout } from '../../lib/input/virtualKeyboardSettings'
import { ModalTabs } from '../Tabs'
import { buildControlsPages } from './controlsSettings'

type SettingsTab = 'game' | 'graphics' | 'keyboard' | 'gamepad'
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
  const contentOptions = {
    ...options,
    onLangChange: () => {
      const active = modalTabs.activeId
      const previous = modalTabs
      modalTabs = createSettingsTabs(contentOptions)
      modalTabs.setActive(active)
      previous.tabs.element.remove()
      previous.element.replaceWith(modalTabs.element)
      modalTabs.mountHeader(modal._panel, 'settings-topbar')
      modal._panel?.setAttribute('aria-label', t('settings'))
      options.onLangChange?.()
      queueMicrotask(() => modal._panel?.querySelector<HTMLElement>('.is-window-selected')?.focus())
    },
  }
  let modalTabs = createSettingsTabs(contentOptions)
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
  gamePanel.className = 'config-form'
  const graphicsPanel = document.createElement('div')
  graphicsPanel.className = 'config-form'

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
      t('virtualKeyboardLayout'),
      [
        { value: 'auto', label: t('virtualKeyboardLayoutAuto') },
        { value: 'azerty', label: 'AZERTY' },
        { value: 'qwerty', label: 'QWERTY' },
      ],
      getVirtualKeyboardLayout(),
      setVirtualKeyboardLayout
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

  const { keyboard, gamepad } = buildControlsPages()

  return new ModalTabs<SettingsTab>(
    [
      { id: 'game', label: t('settingsTabGame'), page: gamePanel },
      { id: 'graphics', label: t('settingsTabGraphics'), page: graphicsPanel },
      { id: 'keyboard', label: t('controlsKeyboardMouse'), page: keyboard },
      { id: 'gamepad', label: t('controlsGroupGamepad'), page: gamepad },
    ],
    'game'
  )
}
