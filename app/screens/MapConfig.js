import { playClickSound } from '../lib/uiSound'
import { Modal } from '../lib'
import { t } from '../lib/lang'
import { buildSelectRow, buildCheckboxRow } from '../ui/formUtils'
import { MAP_SIZES } from '../config/mapSizes'
import { MAP_TYPES } from '../config/mapTypes'
import { PlayerSetupPanel } from '../ui/PlayerSetupPanel'

const STARTING_RESOURCES = [
  { label: () => t('resLow'), value: 'low' },
  { label: () => t('resStandard'), value: 'standard' },
  { label: () => t('resHigh'), value: 'high' },
  { label: () => t('resVeryHigh'), value: 'very_high' },
]

const MAP_RESOURCE_DENSITIES = [
  { label: () => t('mapResourcesLow'), value: 'low' },
  { label: () => t('mapResourcesModerate'), value: 'moderate' },
  { label: () => t('mapResourcesHigh'), value: 'high' },
]

const STARTING_AGES = [
  { label: () => t('stoneAge'), value: 0 },
  { label: () => t('toolAge'), value: 1 },
  { label: () => t('bronzeAge'), value: 2 },
  { label: () => t('ironAge'), value: 3 },
]

const RESOURCES_MAP = {
  low: { wood: 100, food: 150, stone: 50, gold: 0 },
  standard: { wood: 200, food: 200, stone: 150, gold: 0 },
  high: { wood: 500, food: 500, stone: 300, gold: 0 },
  very_high: { wood: 1000, food: 1000, stone: 750, gold: 100 },
}

export default class MapConfig {
  constructor({ onPlay }) {
    this.onPlay = onPlay
    this._onKeyDown = this._handleKeyDown.bind(this)

    this.config = {
      size: 256,
      mapType: 'plain',
      startingAge: 0,
      allTechnologies: false,
      revealEverything: false,
      revealTerrain: false,
      instantMode: false,
      startingResources: RESOURCES_MAP.standard,
      resourceDensity: 'moderate',
    }

    this.maxPlayers = 2

    this._modal = new Modal({
      title: t('newGame'),
      content: this._buildContent(),
    })

    document.addEventListener('keydown', this._onKeyDown)
  }

  _createButton(label, onClick, className = 'ui-btn') {
    const button = document.createElement('button')
    button.className = className
    button.textContent = label
    button.addEventListener('pointerdown', playClickSound)
    button.addEventListener('click', onClick)
    return button
  }

  _buildContent() {
    const content = document.createElement('div')

    const layout = document.createElement('div')
    layout.className = 'lobby-layout'

    // ── Left column: player table ──
    const leftCol = document.createElement('div')
    leftCol.className = 'lobby-col'

    this.playerSetupPanel = new PlayerSetupPanel({ maxPlayers: this.maxPlayers })
    leftCol.appendChild(this.playerSetupPanel.element)

    // ── Right column: settings ──
    const rightCol = document.createElement('div')
    rightCol.className = 'lobby-col'

    const settingsForm = document.createElement('div')
    settingsForm.className = 'config-form lobby-settings-form'

    settingsForm.appendChild(
      buildSelectRow(t('mapSizeLabel'), MAP_SIZES, 256, val => {
        this.config.size = parseInt(val)
        const sizeEntry = MAP_SIZES.find(s => s.value === parseInt(val))
        this.maxPlayers = sizeEntry ? sizeEntry.maxPlayers : 2
        this.playerSetupPanel.setMaxPlayers(this.maxPlayers)
      })
    )

    settingsForm.appendChild(
      buildSelectRow(t('mapTypeLabel'), MAP_TYPES, 'plain', val => {
        this.config.mapType = val
      })
    )

    settingsForm.appendChild(
      buildSelectRow(t('startingResourcesLabel'), STARTING_RESOURCES, 'standard', val => {
        this.config.startingResources = RESOURCES_MAP[val]
      })
    )

    settingsForm.appendChild(
      buildSelectRow(t('mapResourcesLabel'), MAP_RESOURCE_DENSITIES, 'moderate', val => {
        this.config.resourceDensity = val
      })
    )

    settingsForm.appendChild(
      buildSelectRow(t('startingAgeLabel'), STARTING_AGES, 0, val => {
        this.config.startingAge = parseInt(val)
      })
    )

    settingsForm.appendChild(
      buildCheckboxRow(t('allTechnologiesLabel'), false, val => {
        this.config.allTechnologies = val
      })
    )

    settingsForm.appendChild(
      buildCheckboxRow(t('revealTerrain'), false, val => {
        this.config.revealTerrain = val
      })
    )

    rightCol.appendChild(settingsForm)

    layout.appendChild(leftCol)
    layout.appendChild(rightCol)

    const buttons = document.createElement('div')
    buttons.className = 'button-group button-group--row'
    buttons.appendChild(this._createButton(t('startGame'), () => this._startGame()))

    content.appendChild(layout)
    content.appendChild(buttons)

    return content
  }

  _startGame() {
    this.destroy()
    this.onPlay({ ...this.config, players: this.playerSetupPanel.getPlayers() })
  }

  _handleKeyDown(evt) {
    if (evt.key !== 'Enter' || evt.repeat) return
    if (!document.getElementById(this._modal?._id)) return

    evt.preventDefault()
    playClickSound()
    this._startGame()
  }

  destroy() {
    document.removeEventListener('keydown', this._onKeyDown)
    this._modal.close()
  }
}
