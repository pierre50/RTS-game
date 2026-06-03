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

const MAP_RESOURCE_DENSITIES = [
  { label: () => t('mapResourcesLow'),      value: 'low' },
  { label: () => t('mapResourcesModerate'), value: 'moderate' },
  { label: () => t('mapResourcesHigh'),     value: 'high' },
]

const RESOURCES_MAP = {
  low: { wood: 100, food: 150, stone: 50, gold: 0 },
  standard: { wood: 200, food: 200, stone: 150, gold: 0 },
  high: { wood: 500, food: 500, stone: 300, gold: 0 },
  very_high: { wood: 1000, food: 1000, stone: 750, gold: 100 },
}

const MAX_BOTS = 4
const MAX_PLAYERS = MAX_BOTS + 1

const MAP_SIZES = [
  { label: 'Tiny  (120×120)', value: 120, maxPlayers: 2 },
  { label: 'Small (144×144)', value: 144, maxPlayers: 3 },
  { label: 'Medium (168×168)', value: 168, maxPlayers: 4 },
  { label: 'Normal (200×200)', value: 200, maxPlayers: 5 },
  { label: 'Large  (220×220)', value: 220, maxPlayers: 5 },
  { label: 'Giant  (384×384)', value: 384, maxPlayers: 5 },
  { label: 'Extra Giant (512×512)', value: 512, maxPlayers: 5 },
]

const MAP_TYPES = [
  { label: () => t('mapTypePlain'),     value: 'plain' },
  { label: () => t('mapTypeContinent'), value: 'continent' },
  { label: () => t('mapTypeLac'),       value: 'lac' },
  { label: () => t('mapTypeIlot'),      value: 'ilot' },
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
  constructor({ onPlay, onBack }) {
    this.onPlay = onPlay
    this.onBack = onBack

    this.config = {
      size: 120,
      mapType: 'plain',
      difficulty: 'medium',
      revealEverything: false,
      revealTerrain: false,
      instantMode: false,
      startingResources: RESOURCES_MAP.standard,
      resourceDensity: 'moderate',
    }

    this.maxPlayers = 2
    this.players = [
      { name: t('you'), color: 'blue', civ: 'Greek', team: null, isHuman: true },
      { name: t('computer') + ' 1', color: 'red', civ: 'Greek', team: null, isHuman: false },
    ]

    this.el = document.createElement('div')
    this.el.id = 'map-config'

    this._buildUI()
    document.body.appendChild(this.el)
  }

  _createButton(label, onClick, className = 'btn-dark') {
    const button = document.createElement('button')
    button.className = className
    button.textContent = label
    button.onmousedown = playClickSound
    button.onclick = onClick
    return button
  }

  _buildUI() {
    const panel = document.createElement('div')
    panel.className = 'menu-panel lobby-panel'

    const title = document.createElement('div')
    title.className = 'menu-title'
    title.textContent = t('newGame')

    const divider = document.createElement('div')
    divider.className = 'menu-divider'

    const layout = document.createElement('div')
    layout.className = 'lobby-layout'

    // ── Left column: player table ──
    const leftCol = document.createElement('div')
    leftCol.className = 'lobby-col'

    this.playerTableEl = document.createElement('div')
    this.playerTableEl.className = 'player-table'

    this.playerCountRow = this._createPlayerCountSelect()

    leftCol.appendChild(this.playerCountRow)
    leftCol.appendChild(this.playerTableEl)

    // ── Right column: settings ──
    const rightCol = document.createElement('div')
    rightCol.className = 'lobby-col'

    const settingsForm = document.createElement('div')
    settingsForm.className = 'config-form lobby-settings-form'

    settingsForm.appendChild(
      this._createSelect(t('mapSizeLabel'), MAP_SIZES, 120, val => {
        this.config.size = parseInt(val)
        const sizeEntry = MAP_SIZES.find(s => s.value === parseInt(val))
        this.maxPlayers = Math.min(sizeEntry ? sizeEntry.maxPlayers : 2, MAX_PLAYERS)
        this._clampPlayers()
        this._refreshPlayerCountSelect()
        this._refreshPlayerTable()
      })
    )

    settingsForm.appendChild(
      this._createSelect(t('mapTypeLabel'), MAP_TYPES, 'plain', val => {
        this.config.mapType = val
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
      this._createSelect(t('mapResourcesLabel'), MAP_RESOURCE_DENSITIES, 'moderate', val => {
        this.config.resourceDensity = val
      })
    )

    settingsForm.appendChild(
      this._createCheckbox(t('revealTerrain'), false, val => {
        this.config.revealTerrain = val
      })
    )

    rightCol.appendChild(settingsForm)

    layout.appendChild(leftCol)
    layout.appendChild(rightCol)

    const buttons = document.createElement('div')
    buttons.className = 'button-group button-group--row'

    buttons.appendChild(this._createButton(t('back'), this.onBack, 'btn-dark secondary'))
    buttons.appendChild(
      this._createButton(t('startGame'), () => this.onPlay({ ...this.config, players: this.players.map(p => ({ ...p })) }))
    )

    panel.appendChild(title)
    panel.appendChild(divider)
    panel.appendChild(layout)
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
    while (this.players.length < 2) {
      this._addBot()
    }
  }

  _addBot() {
    if (this.players.length >= this.maxPlayers) return
    if (this.players.filter(p => !p.isHuman).length >= MAX_BOTS) return
    const color = this._firstAvailableColor()
    const botNum = this.players.filter(p => !p.isHuman).length + 1
    this.players.push({ name: t('computer') + ' ' + botNum, color, civ: 'Greek', team: null, isHuman: false })
  }

  _setPlayerCount(count) {
    const playerCount = Math.max(2, Math.min(parseInt(count), this.maxPlayers, MAX_PLAYERS))

    while (this.players.length < playerCount) {
      this._addBot()
    }

    while (this.players.length > playerCount) {
      const lastBotIndex = this.players.map(p => p.isHuman).lastIndexOf(false)
      if (lastBotIndex === -1) break
      this.players.splice(lastBotIndex, 1)
    }

    let botNum = 1
    this.players.forEach(p => {
      if (!p.isHuman) p.name = t('computer') + ' ' + botNum++
    })

    this._refreshPlayerCountSelect()
    this._refreshPlayerTable()
  }

  _cycleColor(playerIndex) {
    this.players[playerIndex].color = this._nextAvailableColor(this.players[playerIndex].color)
    this._refreshPlayerTable()
  }

  _cycleTeam(playerIndex) {
    const current = this.players[playerIndex].team
    this.players[playerIndex].team = current === null || current >= 9 ? (current === null ? 1 : null) : current + 1
    this._refreshPlayerTable()
  }

  _refreshPlayerTable() {
    this.playerTableEl.innerHTML = ''

    // Header row
    const header = document.createElement('div')
    header.className = 'player-table-header'
    ;[t('colName'), t('colCiv'), t('colTeam'), t('colColor')].forEach(text => {
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

      // Team button: "-" means no alliance, equal numbers are allied
      const teamCell = document.createElement('div')
      teamCell.className = 'player-team'
      const teamBtn = document.createElement('button')
      teamBtn.className = 'team-cycle'
      teamBtn.type = 'button'
      teamBtn.textContent = player.team ?? '-'
      teamBtn.title = t('teamInput')
      teamBtn.onmousedown = playClickSound
      teamBtn.onclick = () => this._cycleTeam(i)
      teamCell.appendChild(teamBtn)
      row.appendChild(teamCell)

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

      this.playerTableEl.appendChild(row)
    })
  }

  _createPlayerCountSelect() {
    const row = document.createElement('div')
    row.className = 'config-row player-count-row'

    const lbl = document.createElement('label')
    lbl.textContent = t('playerCount')

    this.playerCountSelect = document.createElement('select')
    this.playerCountSelect.onmousedown = playClickSound
    this.playerCountSelect.onchange = e => this._setPlayerCount(e.target.value)

    row.appendChild(lbl)
    row.appendChild(this.playerCountSelect)
    this._refreshPlayerCountSelect()

    return row
  }

  _refreshPlayerCountSelect() {
    if (!this.playerCountSelect) return

    this.playerCountSelect.innerHTML = ''
    for (let count = 2; count <= this.maxPlayers; count++) {
      const option = document.createElement('option')
      option.value = count
      option.textContent = count
      if (count === this.players.length) option.selected = true
      this.playerCountSelect.appendChild(option)
    }
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
