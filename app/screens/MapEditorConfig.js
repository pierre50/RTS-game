import { Modal } from '../lib'
import { t } from '../lib/lang'
import { playClickSound } from '../lib/uiSound'
import { buildSelectRow } from '../ui/formUtils'
import { MAP_EDITOR_SIZES } from '../config/mapSizes'
import { MAP_TYPES } from '../config/mapTypes'

const MAP_PATTERNS = [{ label: () => t('editorMapPatternBlank'), value: 'blank' }, ...MAP_TYPES]

export default class MapEditorConfig {
  constructor({ onCreate }) {
    this.onCreate = onCreate
    this._onKeyDown = this._handleKeyDown.bind(this)
    this.config = {
      name: t('editorDefaultMapName'),
      size: MAP_EDITOR_SIZES[0].value,
      mapType: 'blank',
      players: [
        { name: t('you'), color: 'blue', civ: 'Greek', team: null, isHuman: true },
        { name: t('computer') + ' 1', color: 'red', civ: 'Egyptian', team: null, isHuman: false, difficulty: 'medium' },
      ],
    }

    this._modal = new Modal({
      title: t('createMap'),
      content: this._buildContent(),
    })

    document.addEventListener('keydown', this._onKeyDown)
  }

  _buildContent() {
    const content = document.createElement('div')
    const form = document.createElement('div')
    form.className = 'config-form'

    form.appendChild(
      buildSelectRow(t('mapSizeLabel'), MAP_EDITOR_SIZES, this.config.size, value => {
        this.config.size = parseInt(value)
      })
    )

    form.appendChild(
      buildSelectRow(t('editorMapPatternLabel'), MAP_PATTERNS, this.config.mapType, value => {
        this.config.mapType = value
      })
    )

    const buttons = document.createElement('div')
    buttons.className = 'button-group button-group--row'

    const createButton = document.createElement('button')
    createButton.className = 'ui-btn'
    createButton.textContent = t('createMap')
    createButton.addEventListener('pointerdown', playClickSound)
    createButton.addEventListener('click', () => this._submit())
    buttons.appendChild(createButton)

    content.appendChild(form)
    content.appendChild(buttons)

    return content
  }

  _handleKeyDown(evt) {
    if (evt.key !== 'Enter' || evt.repeat) return
    if (!document.getElementById(this._modal?._id)) return

    evt.preventDefault()
    playClickSound()
    this._submit()
  }

  _submit() {
    this.destroy()
    this.onCreate({ ...this.config })
  }

  destroy() {
    document.removeEventListener('keydown', this._onKeyDown)
    this._modal.close()
  }
}
