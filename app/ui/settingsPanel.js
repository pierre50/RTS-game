import { buildSelectRow, buildRangeRow } from './formUtils'
import { getLang, setLang, SUPPORTED_LANGS, t } from '../lib/lang'
import {
  getVolume,
  setVolume,
  getGameSpeed,
  setGameSpeed,
  getCameraZoom,
  setCameraZoom,
  SPEED_PRESETS,
  CAMERA_ZOOM_PRESETS,
} from '../lib/settings'

/**
 * Builds the settings modal content element.
 * @param {object} opts
 * @param {Function} [opts.onLangChange] - called after language changes (e.g. to re-render menu)
 * @param {Function} [opts.onSpeedChange] - called with new speed value for live in-game updates
 * @param {Function} [opts.onZoomChange] - called with new zoom value for live in-game updates
 */
export function buildSettingsContent({ onLangChange, onSpeedChange, onZoomChange } = {}) {
  const content = document.createElement('div')
  content.className = 'config-form'

  content.appendChild(
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

  content.appendChild(
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

  content.appendChild(
    buildRangeRow(t('sfxVolume'), { min: 0, max: 1, step: 0.05, value: getVolume() }, setVolume)
  )

  content.appendChild(
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

  return content
}
