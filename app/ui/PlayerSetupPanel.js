import { playClickSound } from '../lib/uiSound'
import { t } from '../lib/lang'
import { CIVILIZATIONS } from '../config/civilizations'

const DIFFICULTIES = [
  { label: () => t('diffEasy'), value: 'easy' },
  { label: () => t('diffMedium'), value: 'medium' },
  { label: () => t('diffHard'), value: 'hard' },
]

const MAX_BOTS = 4
const MAX_PLAYERS = MAX_BOTS + 1

const CIVS = CIVILIZATIONS.map(civ => ({ label: () => t(civ.labelKey), value: civ.value }))

const PLAYER_COLORS = [
  { name: 'blue', hex: '#3f5f9f' },
  { name: 'red', hex: '#e30b00' },
  { name: 'yellow', hex: '#c3a31b' },
  { name: 'brown', hex: '#8b5b37' },
  { name: 'orange', hex: '#ef6307' },
  { name: 'green', hex: '#4b6b2b' },
  { name: 'grey', hex: '#8f8f8f' },
  { name: 'cyan', hex: '#00837b' },
]

export class PlayerSetupPanel {
  constructor({ players, maxPlayers, onChange = null }) {
    this.onChange = onChange
    this.maxPlayers = Math.max(2, Math.min(maxPlayers || 2, MAX_PLAYERS))
    this.players = (players?.length ? players : this._createDefaultPlayers()).map(player => ({ ...player }))
    this._clampPlayers()

    this.element = document.createElement('div')
    this.element.className = 'lobby-col'
    this.playerTableEl = document.createElement('div')
    this.playerTableEl.className = 'player-table'
    this.playerCountRow = this._createPlayerCountSelect()

    this.element.appendChild(this.playerCountRow)
    this.element.appendChild(this.playerTableEl)

    this._refreshPlayerTable()
  }

  _createDefaultPlayers() {
    return [
      { name: t('you'), color: 'blue', civ: this._randomCiv(), team: null, isHuman: true },
      { name: t('computer') + ' 1', color: 'red', civ: this._randomCiv(), team: null, isHuman: false, difficulty: 'medium' },
    ]
  }

  _emitChange() {
    this.onChange?.(this.getPlayers())
  }

  getPlayers() {
    return this.players.map(player => ({ ...player }))
  }

  setMaxPlayers(maxPlayers) {
    this.maxPlayers = Math.max(2, Math.min(maxPlayers || 2, MAX_PLAYERS))
    this._clampPlayers()
    this._refreshPlayerCountSelect()
    this._refreshPlayerTable()
    this._emitChange()
  }

  _usedColors() {
    return new Set(this.players.map(player => player.color))
  }

  _nextAvailableColor(currentColor) {
    const used = this._usedColors()
    const idx = PLAYER_COLORS.findIndex(color => color.name === currentColor)
    for (let offset = 1; offset < PLAYER_COLORS.length; offset++) {
      const candidate = PLAYER_COLORS[(idx + offset) % PLAYER_COLORS.length]
      if (!used.has(candidate.name)) return candidate.name
    }
    return currentColor
  }

  _firstAvailableColor() {
    const used = this._usedColors()
    const found = PLAYER_COLORS.find(color => !used.has(color.name))
    return found ? found.name : PLAYER_COLORS[0].name
  }

  _randomCiv() {
    return CIVILIZATIONS[Math.floor(Math.random() * CIVILIZATIONS.length)]?.value || 'Greek'
  }

  _clampPlayers() {
    while (this.players.length > this.maxPlayers) {
      this.players.pop()
    }
    while (this.players.length < 2) {
      this._addBot()
    }

    let botNum = 1
    this.players.forEach(player => {
      if (!player.isHuman) player.name = t('computer') + ' ' + botNum++
    })
  }

  _addBot() {
    if (this.players.length >= this.maxPlayers) return
    if (this.players.filter(player => !player.isHuman).length >= MAX_BOTS) return
    const color = this._firstAvailableColor()
    const botNum = this.players.filter(player => !player.isHuman).length + 1
    this.players.push({
      name: t('computer') + ' ' + botNum,
      color,
      civ: this._randomCiv(),
      team: null,
      isHuman: false,
      difficulty: 'medium',
    })
  }

  _setPlayerCount(count) {
    const playerCount = Math.max(2, Math.min(parseInt(count), this.maxPlayers, MAX_PLAYERS))

    while (this.players.length < playerCount) {
      this._addBot()
    }

    while (this.players.length > playerCount) {
      const lastBotIndex = this.players.map(player => player.isHuman).lastIndexOf(false)
      if (lastBotIndex === -1) break
      this.players.splice(lastBotIndex, 1)
    }

    this._clampPlayers()
    this._refreshPlayerCountSelect()
    this._refreshPlayerTable()
    this._emitChange()
  }

  _cycleColor(playerIndex) {
    this.players[playerIndex].color = this._nextAvailableColor(this.players[playerIndex].color)
    this._refreshPlayerTable()
    this._emitChange()
  }

  _cycleTeam(playerIndex) {
    const current = this.players[playerIndex].team
    this.players[playerIndex].team = current === null || current >= 9 ? (current === null ? 1 : null) : current + 1
    this._refreshPlayerTable()
    this._emitChange()
  }

  _refreshPlayerTable() {
    this.playerTableEl.innerHTML = ''

    const header = document.createElement('div')
    header.className = 'player-table-header'
    ;[t('colName'), t('colCiv'), t('colDifficulty'), t('colTeam'), t('colColor')].forEach(text => {
      const cell = document.createElement('div')
      cell.textContent = text
      header.appendChild(cell)
    })
    this.playerTableEl.appendChild(header)

    this.players.forEach((player, index) => {
      const row = document.createElement('div')
      row.className = 'player-row' + (index % 2 === 0 ? ' player-row--odd' : '')

      const nameCell = document.createElement('div')
      nameCell.className = 'player-name' + (player.isHuman ? ' human' : '')
      nameCell.textContent = player.name
      row.appendChild(nameCell)

      const civCell = document.createElement('div')
      civCell.className = 'player-civ'
      const civSelect = document.createElement('select')
      civSelect.className = 'ui-select'
      CIVS.forEach(civ => {
        const opt = document.createElement('option')
        opt.value = civ.value
        opt.textContent = typeof civ.label === 'function' ? civ.label() : civ.label
        if (civ.value === player.civ) opt.selected = true
        civSelect.appendChild(opt)
      })
      civSelect.onchange = evt => {
        this.players[index].civ = evt.target.value
        this._emitChange()
      }
      civCell.appendChild(civSelect)
      row.appendChild(civCell)

      const difficultyCell = document.createElement('div')
      difficultyCell.className = 'player-difficulty'
      if (player.isHuman) {
        difficultyCell.textContent = '-'
      } else {
        const difficultySelect = document.createElement('select')
        difficultySelect.className = 'ui-select'
        DIFFICULTIES.forEach(difficulty => {
          const opt = document.createElement('option')
          opt.value = difficulty.value
          opt.textContent = typeof difficulty.label === 'function' ? difficulty.label() : difficulty.label
          if (difficulty.value === (player.difficulty || 'medium')) opt.selected = true
          difficultySelect.appendChild(opt)
        })
        difficultySelect.onchange = evt => {
          this.players[index].difficulty = evt.target.value
          this._emitChange()
        }
        difficultyCell.appendChild(difficultySelect)
      }
      row.appendChild(difficultyCell)

      const teamCell = document.createElement('div')
      teamCell.className = 'player-team'
      const teamBtn = document.createElement('button')
      teamBtn.className = 'team-cycle ui-btn'
      teamBtn.type = 'button'
      teamBtn.textContent = player.team ?? '-'
      teamBtn.title = t('teamInput')
      teamBtn.addEventListener('pointerdown', playClickSound)
      teamBtn.addEventListener('click', () => this._cycleTeam(index))
      teamCell.appendChild(teamBtn)
      row.appendChild(teamCell)

      const colorCell = document.createElement('div')
      colorCell.className = 'player-color-cell'
      const colorData = PLAYER_COLORS.find(color => color.name === player.color)
      const swatch = document.createElement('button')
      swatch.className = 'color-swatch ui-btn'
      swatch.type = 'button'
      swatch.style.backgroundColor = colorData ? colorData.hex : '#fff'
      swatch.title = t('colorSwatch', { color: player.color })
      swatch.setAttribute('aria-label', t('colorSwatch', { color: player.color }))
      swatch.addEventListener('pointerdown', playClickSound)
      swatch.addEventListener('click', () => this._cycleColor(index))
      colorCell.appendChild(swatch)
      row.appendChild(colorCell)

      this.playerTableEl.appendChild(row)
    })
  }

  _createPlayerCountSelect() {
    const row = document.createElement('div')
    row.className = 'config-row player-count-row'

    const label = document.createElement('label')
    label.textContent = t('playerCount')

    this.playerCountSelect = document.createElement('select')
    this.playerCountSelect.className = 'ui-select'
    this.playerCountSelect.addEventListener('pointerdown', playClickSound)
    this.playerCountSelect.addEventListener('change', evt => this._setPlayerCount(evt.target.value))

    row.appendChild(label)
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
}
