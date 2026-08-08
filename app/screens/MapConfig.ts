import { playClickSound } from '../lib/uiSound'
import { Modal } from '../lib'
import { t } from '../lib/lang'
import { buildSelectRow } from '../ui/formUtils'
import { MAP_SIZES } from '../config/mapSizes'
import { DEFAULT_MAP_TYPE } from '../config/mapTypes'
import { PlayerSetupPanel } from '../ui/PlayerSetupPanel'
import { RESOURCES_MAP } from '../config/resourcePresets'
import type { GameConfig } from '../types/save'

const DIFFICULTIES = [
  { label: () => t('diffEasy'), value: 'easy' },
  { label: () => t('diffMedium'), value: 'medium' },
  { label: () => t('diffHard'), value: 'hard' },
]

export default class MapConfig {
  onPlay: (config: GameConfig) => void
  _onKeyDown: (evt: KeyboardEvent) => void
  config: GameConfig
  _modal: Modal
  playerSetupPanel!: PlayerSetupPanel
  _destroyed?: boolean

  constructor({ onPlay }: { onPlay: (config: GameConfig) => void }) {
    this.onPlay = onPlay
    this._onKeyDown = this._handleKeyDown.bind(this)

    this.config = {
      size: 144,
      mapType: DEFAULT_MAP_TYPE,
      startingAge: 0,
      allTechnologies: false,
      revealEverything: false,
      revealTerrain: false,
      instantMode: false,
      startingResources: RESOURCES_MAP.standard,
      resourceDensity: 'moderate',
      difficulty: 'medium',
    }

    this._modal = new Modal({
      title: t('newGame'),
      content: this._buildContent(),
      onClose: () => this.destroy(),
    })

    document.addEventListener('keydown', this._onKeyDown)
  }

  _createButton(label: string, onClick: (evt: MouseEvent) => void, className: string = 'ui-btn'): HTMLButtonElement {
    const button = document.createElement('button')
    button.className = className
    button.textContent = label
    button.addEventListener('pointerdown', playClickSound)
    button.addEventListener('click', onClick)
    return button
  }

  _buildContent(): HTMLDivElement {
    const content = document.createElement('div')

    const layout = document.createElement('div')
    layout.className = 'lobby-layout'

    const leftCol = document.createElement('div')
    leftCol.className = 'lobby-col'

    this.playerSetupPanel = new PlayerSetupPanel({ maxPlayers: 1, simplified: true })
    leftCol.appendChild(this.playerSetupPanel.element)

    const rightCol = document.createElement('div')
    rightCol.className = 'lobby-col'

    const settingsForm = document.createElement('div')
    settingsForm.className = 'config-form lobby-settings-form'

    settingsForm.appendChild(
      buildSelectRow(t('mapSizeLabel'), MAP_SIZES, 144, val => {
        this.config.size = parseInt(val)
      })
    )

    settingsForm.appendChild(
      buildSelectRow(t('colDifficulty'), DIFFICULTIES, 'medium', val => {
        this.config.difficulty = val
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

  _startGame(): void {
    this.destroy()
    this.onPlay({ ...this.config, players: this.playerSetupPanel.getPlayers() })
  }

  _handleKeyDown(evt: KeyboardEvent): void {
    if (evt.key !== 'Enter' || evt.repeat) return
    if (!document.getElementById(this._modal?._id)) return
    if (evt.target instanceof HTMLElement && evt.target.closest('input, select, textarea')) return

    evt.preventDefault()
    playClickSound()
    this._startGame()
  }

  destroy(): void {
    if (this._destroyed) return
    this._destroyed = true
    document.removeEventListener('keydown', this._onKeyDown)
    this._modal.close()
  }
}
