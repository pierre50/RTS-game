import { Modal } from '../lib'
import { t } from '../lib/lang'
import { playClickSound } from '../lib/uiSound'
import { buildSelectRow } from '../ui/formUtils'
import { MAP_EDITOR_SIZES } from '../config/mapSizes'

const BASE_TERRAINS = [
  { label: () => t('Grass'), value: 'Grass' },
  { label: () => t('Jungle'), value: 'Jungle' },
  { label: () => t('Desert'), value: 'Desert' },
]

export default class MapEditorConfig {
  constructor({ onCreate }) {
    this.onCreate = onCreate
    this._onKeyDown = this._handleKeyDown.bind(this)
    this.config = {
      name: t('editorDefaultMapName'),
      size: MAP_EDITOR_SIZES[0].value,
      baseTerrain: 'Grass',
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

    const nameRow = document.createElement('div')
    nameRow.className = 'config-row'

    const nameLabel = document.createElement('label')
    nameLabel.textContent = t('mapNameLabel')
    nameRow.appendChild(nameLabel)

    this.nameInput = document.createElement('input')
    this.nameInput.type = 'text'
    this.nameInput.className = 'ui-input'
    this.nameInput.value = this.config.name
    this.nameInput.maxLength = 40
    this.nameInput.addEventListener('input', evt => {
      this.config.name = evt.target.value
    })
    nameRow.appendChild(this.nameInput)
    form.appendChild(nameRow)

    form.appendChild(
      buildSelectRow(t('mapSizeLabel'), MAP_EDITOR_SIZES, this.config.size, value => {
        this.config.size = parseInt(value)
      })
    )

    form.appendChild(
      buildSelectRow(t('editorBaseTerrainLabel'), BASE_TERRAINS, this.config.baseTerrain, value => {
        this.config.baseTerrain = value
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
    const name = (this.nameInput?.value || '').trim()
    this.destroy()
    this.onCreate({
      ...this.config,
      name: name || t('editorDefaultMapName'),
    })
  }

  destroy() {
    document.removeEventListener('keydown', this._onKeyDown)
    this._modal.close()
  }
}
