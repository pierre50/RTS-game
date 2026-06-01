import { playClickSound } from '../lib/uiSound'
import { t } from '../lib/lang'

const DIFFICULTIES = [
  { label: () => t('diffEasy'),   value: 'easy' },
  { label: () => t('diffMedium'), value: 'medium' },
  { label: () => t('diffHard'),   value: 'hard' },
]

const STARTING_RESOURCES = [
  { label: () => t('resLow'),       value: 'low' },
  { label: () => t('resStandard'),  value: 'standard' },
  { label: () => t('resHigh'),      value: 'high' },
  { label: () => t('resVeryHigh'),  value: 'very_high' },
]

const RESOURCES_MAP = {
  low: { wood: 100, food: 150, stone: 50, gold: 0 },
  standard: { wood: 200, food: 200, stone: 150, gold: 0 },
  high: { wood: 500, food: 500, stone: 300, gold: 0 },
  very_high: { wood: 1000, food: 1000, stone: 750, gold: 100 },
}

const MAP_SIZES = [
  { label: 'Tiny  (120×120)', value: 120, maxPlayers: 2 },
  { label: 'Small (144×144)', value: 144, maxPlayers: 3 },
  { label: 'Medium (168×168)', value: 168, maxPlayers: 4 },
  { label: 'Normal (200×200)', value: 200, maxPlayers: 6 },
  { label: 'Large  (220×220)', value: 220, maxPlayers: 8 },
]

const CIVS = [
  { label: () => t('civGreek'), value: 'Greek' },
]

const PLAYER_COLORS = [
  { name: 'blue',   hex: '#3f5f9f' },
  { name: 'red',    hex: '#e30b00' },
  { name: 'yellow', hex: '#c3a31b' },
  { name: 'brown',  hex: '#8b5b37' },
  { name: 'orange', hex: '#ef6307' },
  { name: 'green',  hex: '#4b6b2b' },
  { name: 'grey',   hex: '#8f8f8f' },
  { name: 'cyan',   hex: '#00837b' },
]

export default class MapConfig {
  constructor(onPlay, onBack) {
    this.onPlay = onPlay
    this.onBack = onBack

    this.config = {
      size: 120,
      difficulty: 'medium',
      revealEverything: false,
      revealTerrain: false,
      devMode: false,
      startingResources: RESOURCES_MAP.standard,
    }

    this.maxPlayers = 2
    this.players = [
      { name: t('you'), color: 'blue', civ: 'Greek', isHuman: true },
      { name: t('computer') + ' 1', color: 'red', civ: 'Greek', isHuman: false },
    ]

    this.el = document.createElement('div')
    this.el.id = 'map-config'
    this.el.style.backgroundImage = "url('/background/bg2.png')"

    this._buildUI()
    document.body.appendChild(this.el)
  }

  _buildUI() {
    const panel = document.createElement('div')
    panel.className = 'menu-panel lobby-panel'

    const title = document.createElement('div')
    title.className = 'menu-title'
    title.textContent = t('newGame')

    const subtitle = document.createElement('div')
    subtitle.className = 'menu-subtitle'
    subtitle.textContent = t('configuration')

    const divider = document.createElement('div')
    divider.className = 'menu-divider'

    const layout = document.createElement('div')
    layout.className = 'lobby-layout'

    // ── Left column: player table ──
    const leftCol = document.createElement('div')
    leftCol.className = 'lobby-col'

    const leftTitle = document.createElement('div')
    leftTitle.className = 'lobby-section-title'
    leftTitle.textContent = t('players')

    this.playerTableEl = document.createElement('div')
    this.playerTableEl.className = 'player-table'

    this.addBotBtn = document.createElement('button')
    this.addBotBtn.className = 'menu-btn lobby-add-btn'
    this.addBotBtn.textContent = t('addOpponent')
    this.addBotBtn.onmousedown = playClickSound
    this.addBotBtn.onclick = () => this._addBot()

    leftCol.appendChild(leftTitle)
    leftCol.appendChild(this.playerTableEl)
    leftCol.appendChild(this.addBotBtn)

    // ── Right column: settings ──
    const rightCol = document.createElement('div')
    rightCol.className = 'lobby-col'

    const rightTitle = document.createElement('div')
    rightTitle.className = 'lobby-section-title'
    rightTitle.textContent = t('mapSettings')

    const settingsForm = document.createElement('div')
    settingsForm.className = 'config-form lobby-settings-form'

    settingsForm.appendChild(
      this._createSelect(t('mapSizeLabel'), MAP_SIZES, 120, val => {
        this.config.size = parseInt(val)
        const sizeEntry = MAP_SIZES.find(s => s.value === parseInt(val))
        this.maxPlayers = sizeEntry ? sizeEntry.maxPlayers : 2
        this._clampPlayers()
        this._refreshPlayerTable()
      })
    )

    settingsForm.appendChild(
      this._createSelect(t('aiDifficulty'), DIFFICULTIES, 'medium', val => {
        this.config.difficulty = val
      })
    )

    settingsForm.appendChild(
      this._createSelect(t('startingResourcesLabel'), STARTING_RESOURCES, 'standard', val => {
        this.config.startingResources = RESOURCES_MAP[val]
      })
    )

    settingsForm.appendChild(
      this._createCheckbox(t('devMode'), false, val => {
        this.config.devMode = val
      })
    )

    settingsForm.appendChild(
      this._createCheckbox(t('revealAll'), false, val => {
        this.config.revealEverything = val
      })
    )

    settingsForm.appendChild(
      this._createCheckbox(t('revealTerrain'), false, val => {
        this.config.revealTerrain = val
      })
    )

    rightCol.appendChild(rightTitle)
    rightCol.appendChild(settingsForm)

    layout.appendChild(leftCol)
    layout.appendChild(rightCol)

    const divider2 = document.createElement('div')
    divider2.className = 'menu-divider'

    const buttons = document.createElement('div')
    buttons.className = 'menu-buttons menu-buttons--row'

    const btnBack = document.createElement('button')
    btnBack.className = 'menu-btn secondary'
    btnBack.textContent = t('back')
    btnBack.onmousedown = playClickSound
    btnBack.onclick = this.onBack

    const btnPlay = document.createElement('button')
    btnPlay.className = 'menu-btn'
    btnPlay.textContent = t('startGame')
    btnPlay.onmousedown = playClickSound
    btnPlay.onclick = () => this.onPlay({ ...this.config, players: this.players.map(p => ({ ...p })) })

    buttons.appendChild(btnBack)
    buttons.appendChild(btnPlay)

    panel.appendChild(title)
    panel.appendChild(subtitle)
    panel.appendChild(divider)
    panel.appendChild(layout)
    panel.appendChild(divider2)
    panel.appendChild(buttons)

    this.el.appendChild(panel)
    this._refreshPlayerTable()
  }

  _usedColors() {
    return new Set(this.players.map(p => p.color))
  }

  _nextAvailableColor(currentColor) {
    const used = this._usedColors()
    const idx = PLAYER_COLORS.findIndex(c => c.name === currentColor)
    for (let offset = 1; offset < PLAYER_COLORS.length; offset++) {
      const candidate = PLAYER_COLORS[(idx + offset) % PLAYER_COLORS.length]
      if (!used.has(candidate.name)) return candidate.name
    }
    return currentColor
  }

  _firstAvailableColor() {
    const used = this._usedColors()
    const found = PLAYER_COLORS.find(c => !used.has(c.name))
    return found ? found.name : PLAYER_COLORS[0].name
  }

  _clampPlayers() {
    while (this.players.length > this.maxPlayers) {
      this.players.pop()
    }
  }

  _addBot() {
    if (this.players.length >= this.maxPlayers) return
    const color = this._firstAvailableColor()
    const botNum = this.players.filter(p => !p.isHuman).length + 1
    this.players.push({ name: t('computer') + ' ' + botNum, color, civ: 'Greek', isHuman: false })
    this._refreshPlayerTable()
  }

  _removePlayer(index) {
    this.players.splice(index, 1)
    let botNum = 1
    this.players.forEach(p => {
      if (!p.isHuman) p.name = t('computer') + ' ' + botNum++
    })
    this._refreshPlayerTable()
  }

  _cycleColor(playerIndex) {
    this.players[playerIndex].color = this._nextAvailableColor(this.players[playerIndex].color)
    this._refreshPlayerTable()
  }

  _refreshPlayerTable() {
    this.playerTableEl.innerHTML = ''

    // Header row
    const header = document.createElement('div')
    header.className = 'player-table-header'
    ;[t('colName'), t('colCiv'), t('colColor'), ''].forEach(text => {
      const cell = document.createElement('div')
      cell.textContent = text
      header.appendChild(cell)
    })
    this.playerTableEl.appendChild(header)

    // Player rows
    this.players.forEach((player, i) => {
      const row = document.createElement('div')
      row.className = 'player-row' + (i % 2 === 0 ? ' player-row--odd' : '')

      // Name
      const nameCell = document.createElement('div')
      nameCell.className = 'player-name' + (player.isHuman ? ' human' : '')
      nameCell.textContent = player.name
      row.appendChild(nameCell)

      // Civilization select
      const civCell = document.createElement('div')
      civCell.className = 'player-civ'
      const civSelect = document.createElement('select')
      CIVS.forEach(civ => {
        const opt = document.createElement('option')
        opt.value = civ.value
        opt.textContent = typeof civ.label === 'function' ? civ.label() : civ.label
        if (civ.value === player.civ) opt.selected = true
        civSelect.appendChild(opt)
      })
      civSelect.onchange = e => { this.players[i].civ = e.target.value }
      civCell.appendChild(civSelect)
      row.appendChild(civCell)

      // Color swatch
      const colorCell = document.createElement('div')
      colorCell.className = 'player-color-cell'
      const colorData = PLAYER_COLORS.find(c => c.name === player.color)
      const swatch = document.createElement('div')
      swatch.className = 'color-swatch'
      swatch.style.backgroundColor = colorData ? colorData.hex : '#fff'
      swatch.title = t('colorSwatch', { color: player.color })
      swatch.onmousedown = playClickSound
      swatch.onclick = () => this._cycleColor(i)
      colorCell.appendChild(swatch)
      row.appendChild(colorCell)

      // Remove button (bots only)
      const actionCell = document.createElement('div')
      actionCell.className = 'player-action-cell'
      if (!player.isHuman) {
        const removeBtn = document.createElement('button')
        removeBtn.className = 'player-remove'
        removeBtn.textContent = '×'
        removeBtn.title = t('removePlayer')
        removeBtn.onmousedown = playClickSound
        removeBtn.onclick = () => this._removePlayer(i)
        actionCell.appendChild(removeBtn)
      }
      row.appendChild(actionCell)

      this.playerTableEl.appendChild(row)
    })

    this.addBotBtn.disabled = this.players.length >= this.maxPlayers
  }

  _createSelect(label, options, defaultValue, onChange) {
    const row = document.createElement('div')
    row.className = 'config-row'

    const lbl = document.createElement('label')
    lbl.textContent = label

    const select = document.createElement('select')
    options.forEach(opt => {
      const option = document.createElement('option')
      option.value = opt.value
      option.textContent = typeof opt.label === 'function' ? opt.label() : opt.label
      if (opt.value === defaultValue) option.selected = true
      select.appendChild(option)
    })
    select.onchange = e => onChange(e.target.value)

    row.appendChild(lbl)
    row.appendChild(select)
    return row
  }

  _createCheckbox(label, defaultValue, onChange) {
    const row = document.createElement('div')
    row.className = 'config-row config-row--checkbox'

    const lbl = document.createElement('label')
    lbl.textContent = label

    const checkbox = document.createElement('input')
    checkbox.type = 'checkbox'
    checkbox.checked = defaultValue
    checkbox.onchange = e => onChange(e.target.checked)

    row.appendChild(lbl)
    row.appendChild(checkbox)
    return row
  }

  destroy() {
    this.el.remove()
  }
}
