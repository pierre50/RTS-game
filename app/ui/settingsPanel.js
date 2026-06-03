import { getLang, setLang, SUPPORTED_LANGS, t } from '../lib/lang'
import { getVolume, setVolume, getGameSpeed, setGameSpeed, SPEED_PRESETS } from '../lib/settings'

/**
 * Builds the settings modal content element.
 * @param {object} opts
 * @param {Function} [opts.onLangChange] - called after language changes (e.g. to re-render menu)
 * @param {Function} [opts.onSpeedChange] - called with new speed value for live in-game updates
 * @param {Array<{ key: string, value: number }>} [opts.speedPresets] - speed options to display in the UI
 */
export function buildSettingsContent({ onLangChange, onSpeedChange, speedPresets = SPEED_PRESETS } = {}) {
  const content = document.createElement('div')
  content.className = 'config-form'

  content.appendChild(_langRow(onLangChange))
  content.appendChild(_volumeRow())
  content.appendChild(_speedRow(onSpeedChange, speedPresets))

  return content
}

function _row(labelKey) {
  const row = document.createElement('div')
  row.className = 'config-row'
  const label = document.createElement('label')
  label.textContent = t(labelKey)
  row.appendChild(label)
  return row
}

function _langRow(onLangChange) {
  const row = _row('language')
  const select = document.createElement('select')
  SUPPORTED_LANGS.forEach(({ code, label }) => {
    const option = document.createElement('option')
    option.value = code
    option.textContent = label
    select.appendChild(option)
  })
  select.value = getLang()
  select.addEventListener('change', evt => {
    setLang(evt.target.value)
    if (onLangChange) onLangChange()
  })
  row.appendChild(select)
  return row
}

function _volumeRow() {
  const row = _row('sfxVolume')
  const slider = document.createElement('input')
  slider.type = 'range'
  slider.min = '0'
  slider.max = '1'
  slider.step = '0.05'
  slider.value = String(getVolume())
  slider.className = 'settings-volume-slider'
  slider.addEventListener('input', evt => setVolume(parseFloat(evt.target.value)))
  row.appendChild(slider)
  return row
}

function _speedRow(onSpeedChange, speedPresets) {
  const row = _row('gameSpeed')
  const select = document.createElement('select')
  const currentSpeed = getGameSpeed()
  const presets = speedPresets.some(({ value }) => value === currentSpeed)
    ? speedPresets
    : [...speedPresets, { key: `${currentSpeed}x`, value: currentSpeed }]

  presets.forEach(({ key, value }) => {
    const option = document.createElement('option')
    option.value = String(value)
    option.textContent = t(key)
    select.appendChild(option)
  })
  select.value = String(currentSpeed)
  select.addEventListener('change', evt => {
    const v = parseFloat(evt.target.value)
    setGameSpeed(v)
    if (onSpeedChange) onSpeedChange(v)
  })
  row.appendChild(select)
  return row
}
