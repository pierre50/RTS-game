import { playClickSound } from '../lib/uiSound'
import { t } from '../lib/lang'
import { CIVILIZATIONS } from '../config/civilizations'
import { isGeneratedPlayerName, randomPlayerNameForCivilization } from '../config/playerNames'
import { renderUnitHeadCanvasAvatar } from '../lib/avatar'
import { recolorCanvasByPalette } from '../lib/graphics/colors'
import {
  defaultHeroAppearance,
  HERO_HAIR_COLOR_OPTIONS,
  HERO_HAIR_STYLE_OPTIONS,
  normalizeHeroAppearance,
  normalizeHeroAppearanceGender,
  type HeroAppearanceConfig,
  type HeroHairColor,
} from '../lib/lpc/heroAppearance'
import type { PlayerSetupConfig } from '../types/save'

type PlayerSetupPanelOptions = {
  players?: PlayerSetupConfig[]
  maxPlayers?: number
  onChange?: ((players: PlayerSetupConfig[]) => void) | null
  showAge?: boolean
  simplified?: boolean
}

type PlayerSetupConfigWithAge = PlayerSetupConfig & {
  civ: string
  color: string
  gender: 'male' | 'female'
  heroAppearance: HeroAppearanceConfig
  isHuman: boolean
  name: string
  team: number | null
  age?: number
  civilizationLevel?: number
}

const AGES = [
  { label: () => t('stoneAge'), value: 0 },
  { label: () => t('toolAge'), value: 1 },
]

const GENDERS = [
  { label: () => t('genderMale'), value: 'male' },
  { label: () => t('genderFemale'), value: 'female' },
] as const

const MAX_BOTS = 4
const MAX_PLAYERS = MAX_BOTS + 1
const MIN_PLAYERS = 1
const HERO_PREVIEW_SIZE = 96
const HERO_FRAME_SIZE = 64
const HERO_ATLAS_FRAME_STRIDE = HERO_FRAME_SIZE + 1
const HERO_BODY_WALKING_SOUTH_FRAME_X = 18 * HERO_ATLAS_FRAME_STRIDE
const HERO_WALKING_SOUTH_FRAME_NAME = '018'
const HERO_HAIR_SOURCE_PALETTE = 'brown_hair'

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
  onChange: ((players: PlayerSetupConfig[]) => void) | null
  showAge: boolean
  simplified: boolean
  maxPlayers: number
  players: PlayerSetupConfigWithAge[]
  element: HTMLDivElement
  playerTableEl!: HTMLDivElement
  playerCountRow!: HTMLDivElement
  playerCountSelect!: HTMLSelectElement
  humanControlsEl!: HTMLDivElement
  simplifiedExtraControls: HTMLElement[] = []
  heroPreviewRequestId = 0

  constructor({ players, maxPlayers, onChange = null, showAge = false, simplified = false }: PlayerSetupPanelOptions) {
    this.onChange = onChange
    this.showAge = showAge
    this.simplified = simplified
    this.maxPlayers = Math.max(MIN_PLAYERS, Math.min(maxPlayers || 2, MAX_PLAYERS))
    this.players = (players?.length ? players : this._createDefaultPlayers()).map(player =>
      this._normalizePlayer(player)
    )
    if (this.showAge) {
      this.players.forEach(player => {
        player.age = Math.max(0, Math.min(Number(player.age) || 0, 1))
      })
    }
    // Simplified lobby is the adventure start: the played hero arrives alone.
    if (this.simplified) this._keepOnlyHumanPlayer()
    this._clampPlayers()
    this._reassignAIColors()

    this.element = document.createElement('div')

    if (this.simplified) {
      this.element.className = 'config-form player-setup-form'
      this.humanControlsEl = this.element
      this._refreshHumanControls()
    } else {
      this.element.className = 'player-setup-panel'
      this.playerTableEl = document.createElement('div')
      this.playerTableEl.className = `player-table${this.showAge ? ' player-table--with-age' : ''}`
      this.playerCountRow = this._createPlayerCountSelect()
      this.element.appendChild(this.playerCountRow)
      this.element.appendChild(this.playerTableEl)
      this._refreshPlayerTable()
    }
  }

  appendSimplifiedControl(control: HTMLElement): void {
    if (!this.simplified) return
    this.simplifiedExtraControls.push(control)
    this.humanControlsEl.appendChild(control)
  }

  _createDefaultPlayers(): PlayerSetupConfigWithAge[] {
    const humanCiv = this._randomCiv()
    const humanGender = 'male'
    const aiCiv = this._randomCiv()
    const aiGender = 'male'
    return [
      {
        name: randomPlayerNameForCivilization(humanCiv, humanGender),
        color: 'blue',
        civ: humanCiv,
        gender: humanGender,
        heroAppearance: defaultHeroAppearance(humanCiv, humanGender),
        team: null,
        isHuman: true,
      },
      {
        name: t('computer') + ' 1',
        color: 'red',
        civ: aiCiv,
        gender: aiGender,
        heroAppearance: defaultHeroAppearance(aiCiv, aiGender),
        team: null,
        isHuman: false,
      },
    ]
  }

  _normalizePlayer(player: PlayerSetupConfig): PlayerSetupConfigWithAge {
    const civ = player.civ || this._randomCiv()
    const gender = player.gender === 'female' ? 'female' : 'male'
    const shouldGenerateHumanName = player.isHuman === true && (!player.name || player.name === t('you'))
    return {
      name: shouldGenerateHumanName ? randomPlayerNameForCivilization(civ, gender) : player.name || t('computer'),
      color: player.color || PLAYER_COLORS[0].name,
      civ,
      gender,
      heroAppearance: normalizeHeroAppearance(player.heroAppearance, civ, gender),
      team: typeof player.team === 'number' ? player.team : null,
      isHuman: player.isHuman === true,
      ...(this.showAge ? { age: Math.max(0, Math.min(Number((player as PlayerSetupConfigWithAge).age) || 0, 1)) } : {}),
      civilizationLevel: Math.max(0, Math.min(Number(player.civilizationLevel) || 0, 3)),
    }
  }

  _emitChange(): void {
    this.onChange?.(this.getPlayers())
  }

  getPlayers(): PlayerSetupConfig[] {
    return this.players.map(player => ({ ...player }))
  }

  setMaxPlayers(maxPlayers: number): void {
    this.maxPlayers = Math.max(MIN_PLAYERS, Math.min(maxPlayers || 2, MAX_PLAYERS))
    if (this.simplified) this._keepOnlyHumanPlayer()
    this._clampPlayers()
    this._reassignAIColors()
    this._refresh()
    this._emitChange()
  }

  _refresh(): void {
    if (this.simplified) {
      this._refreshHumanControls()
    } else {
      this._refreshPlayerCountSelect()
      this._refreshPlayerTable()
    }
  }

  _usedColors(): Set<string> {
    return new Set(this.players.map(player => player.color))
  }

  _isKnownColor(color: string): boolean {
    return PLAYER_COLORS.some(playerColor => playerColor.name === color)
  }

  _nextColor(currentColor: string): string {
    const idx = PLAYER_COLORS.findIndex(color => color.name === currentColor)
    return PLAYER_COLORS[((idx >= 0 ? idx : 0) + 1) % PLAYER_COLORS.length].name
  }

  _nextAvailableColor(currentColor: string): string {
    const used = this._usedColors()
    const idx = PLAYER_COLORS.findIndex(color => color.name === currentColor)
    for (let offset = 1; offset < PLAYER_COLORS.length; offset++) {
      const candidate = PLAYER_COLORS[(idx + offset) % PLAYER_COLORS.length]
      if (!used.has(candidate.name)) return candidate.name
    }
    return currentColor
  }

  _firstAvailableColor(): string {
    const used = this._usedColors()
    const found = PLAYER_COLORS.find(color => !used.has(color.name))
    return found ? found.name : PLAYER_COLORS[0].name
  }

  _reassignAIColors(): void {
    const used = new Set(this.players.filter(player => player.isHuman).map(player => player.color))

    this.players.forEach(player => {
      if (player.isHuman) return
      if (!used.has(player.color) && this._isKnownColor(player.color)) {
        used.add(player.color)
        return
      }

      const color = PLAYER_COLORS.find(candidate => !used.has(candidate.name))?.name ?? PLAYER_COLORS[0].name
      player.color = color
      used.add(color)
    })
  }

  _randomCiv(): string {
    return CIVILIZATIONS[Math.floor(Math.random() * CIVILIZATIONS.length)]?.value || 'Greek'
  }

  _shouldRegeneratePlayerName(player: PlayerSetupConfigWithAge): boolean {
    return player.isHuman && (player.name === t('you') || isGeneratedPlayerName(player.name))
  }

  _refreshGeneratedPlayerName(player: PlayerSetupConfigWithAge): void {
    if (!this._shouldRegeneratePlayerName(player)) return
    player.name = randomPlayerNameForCivilization(player.civ, player.gender)
  }

  _setPlayerCiv(playerIndex: number, civ: string): void {
    const player = this.players[playerIndex]
    if (!player) return
    player.civ = civ
    player.heroAppearance = defaultHeroAppearance(civ, player.gender)
    this._refreshGeneratedPlayerName(player)
    this._refresh()
    this._emitChange()
  }

  _setPlayerGender(playerIndex: number, gender: string): void {
    const player = this.players[playerIndex]
    if (!player) return
    player.gender = gender === 'female' ? 'female' : 'male'
    player.heroAppearance = defaultHeroAppearance(player.civ, player.gender)
    this._refreshGeneratedPlayerName(player)
    this._refresh()
    this._emitChange()
  }

  _setHeroHairStyle(playerIndex: number, hairStyle: string): void {
    const player = this.players[playerIndex]
    if (!player) return
    player.heroAppearance = normalizeHeroAppearance({ ...player.heroAppearance, hairStyle }, player.civ, player.gender)
    this._refresh()
    this._emitChange()
  }

  _setHeroHairColor(playerIndex: number, hairColor: string): void {
    const player = this.players[playerIndex]
    if (!player) return
    player.heroAppearance = normalizeHeroAppearance(
      { ...player.heroAppearance, hairColor: hairColor as HeroHairColor },
      player.civ,
      player.gender
    )
    this._refresh()
    this._emitChange()
  }

  _clampPlayers(): void {
    while (this.players.length > this.maxPlayers) {
      this.players.pop()
    }
    while (this.players.length < MIN_PLAYERS) {
      this._addBot()
    }

    let botNum = 1
    this.players.forEach(player => {
      if (!player.isHuman) player.name = t('computer') + ' ' + botNum++
    })
  }

  _addBot(): void {
    if (this.players.length >= this.maxPlayers) return
    if (this.players.filter(player => !player.isHuman).length >= MAX_BOTS) return
    const color = this._firstAvailableColor()
    const botNum = this.players.filter(player => !player.isHuman).length + 1
    const civ = this._randomCiv()
    const gender = 'male'
    this.players.push({
      name: t('computer') + ' ' + botNum,
      color,
      civ,
      gender,
      heroAppearance: defaultHeroAppearance(civ, gender),
      team: null,
      isHuman: false,
      civilizationLevel: 0,
      ...(this.showAge ? { age: 0 } : {}),
    })
  }

  _growOrShrinkTo(count: number): void {
    while (this.players.length < count) {
      this._addBot()
    }

    while (this.players.length > count) {
      const lastBotIndex = this.players.map(player => player.isHuman).lastIndexOf(false)
      if (lastBotIndex === -1) break
      this.players.splice(lastBotIndex, 1)
    }
  }

  _keepOnlyHumanPlayer(): void {
    const human = this.players.find(player => player.isHuman) || this.players[0] || this._createDefaultPlayers()[0]
    human.isHuman = true
    this.players = [human]
  }

  _setPlayerCount(count: string | number): void {
    const playerCount = Math.max(MIN_PLAYERS, Math.min(parseInt(String(count)), this.maxPlayers, MAX_PLAYERS))
    this._growOrShrinkTo(playerCount)
    this._clampPlayers()
    this._refreshPlayerCountSelect()
    this._refreshPlayerTable()
    this._emitChange()
  }

  _cycleColor(playerIndex: number): void {
    const player = this.players[playerIndex]
    if (!player) return
    player.color = player.isHuman ? this._nextColor(player.color) : this._nextAvailableColor(player.color)
    this._reassignAIColors()
    this._refresh()
    this._emitChange()
  }

  _heroPreviewSrc(player: PlayerSetupConfigWithAge): string {
    const civ = (player.civ || 'Greek').toLowerCase()
    const gender = player.gender === 'female' ? 'female' : 'male'
    return `assets/graphics/lpc-baked/hero/${civ}/${gender}/texture.png`
  }

  _heroHairPreviewSrc(player: PlayerSetupConfigWithAge): string {
    const gender = normalizeHeroAppearanceGender(player.gender)
    const appearance = normalizeHeroAppearance(player.heroAppearance, player.civ, gender)
    return `assets/graphics/lpc-hero/hair/${appearance.hairStyle}/${gender}/texture.png`
  }

  _heroHairPreviewJsonSrc(player: PlayerSetupConfigWithAge): string {
    const gender = normalizeHeroAppearanceGender(player.gender)
    const appearance = normalizeHeroAppearance(player.heroAppearance, player.civ, gender)
    return `assets/graphics/lpc-hero/hair/${appearance.hairStyle}/${gender}/texture.json`
  }

  _drawHeroPreviewFrame(ctx: CanvasRenderingContext2D, frame: HTMLCanvasElement, canvas: HTMLCanvasElement, player: PlayerSetupConfigWithAge): void {
    renderUnitHeadCanvasAvatar(frame, canvas, player.color)
  }

  _drawHeroHairPreview(
    frameCtx: CanvasRenderingContext2D,
    player: PlayerSetupConfigWithAge,
    onDone: () => void
  ): void {
    const img = new Image()
    img.onload = async () => {
      try {
        const response = await fetch(this._heroHairPreviewJsonSrc(player))
        const sheet = await response.json()
        const entry = Object.entries(sheet.frames ?? {}).find(([name]) =>
          name.startsWith(HERO_WALKING_SOUTH_FRAME_NAME) && name.includes('_front_walking')
        ) as [string, { frame: { x: number; y: number; w: number; h: number } }] | undefined
        const frameData = entry?.[1]?.frame
        if (!frameData) {
          onDone()
          return
        }
        const hair = document.createElement('canvas')
        hair.width = HERO_FRAME_SIZE
        hair.height = HERO_FRAME_SIZE
        const hairCtx = hair.getContext('2d')
        if (!hairCtx) {
          onDone()
          return
        }
        hairCtx.imageSmoothingEnabled = false
        hairCtx.drawImage(img, frameData.x, frameData.y, frameData.w, frameData.h, 0, 0, HERO_FRAME_SIZE, HERO_FRAME_SIZE)
        recolorCanvasByPalette(hair, HERO_HAIR_SOURCE_PALETTE, player.heroAppearance.hairColor)
        frameCtx.drawImage(hair, 0, 0)
      } catch {
        // The preview should still render the base hero if a custom hair atlas is missing.
      }
      onDone()
    }
    img.onerror = onDone
    img.src = this._heroHairPreviewSrc(player)
  }

  _renderHeroPreview(canvas: HTMLCanvasElement, player: PlayerSetupConfigWithAge): void {
    const requestId = ++this.heroPreviewRequestId
    const img = new Image()
    let triedFallback = false
    img.onload = () => {
      if (requestId !== this.heroPreviewRequestId) return
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      ctx.imageSmoothingEnabled = false
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      const frame = document.createElement('canvas')
      frame.width = HERO_FRAME_SIZE
      frame.height = HERO_FRAME_SIZE
      const frameCtx = frame.getContext('2d')
      if (!frameCtx) return
      frameCtx.imageSmoothingEnabled = false

      frameCtx.drawImage(
        img,
        HERO_BODY_WALKING_SOUTH_FRAME_X,
        0,
        HERO_FRAME_SIZE,
        HERO_FRAME_SIZE,
        0,
        0,
        HERO_FRAME_SIZE,
        HERO_FRAME_SIZE
      )
      this._drawHeroHairPreview(frameCtx, player, () => this._drawHeroPreviewFrame(ctx, frame, canvas, player))
    }
    img.onerror = () => {
      if (requestId !== this.heroPreviewRequestId) return
      if (triedFallback) return
      triedFallback = true
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      ctx.imageSmoothingEnabled = false
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      img.src = `assets/graphics/lpc-baked/hero/greek/male/texture.png`
    }
    img.src = this._heroPreviewSrc(player)
  }

  _createHeroPreview(player: PlayerSetupConfigWithAge): HTMLDivElement {
    const row = document.createElement('div')
    row.className = 'config-row hero-avatar-row'

    const preview = document.createElement('div')
    preview.className = 'hero-avatar-preview'

    const frame = document.createElement('div')
    frame.className = 'hero-avatar-preview-frame'

    const canvas = document.createElement('canvas')
    canvas.width = HERO_PREVIEW_SIZE
    canvas.height = HERO_PREVIEW_SIZE
    canvas.setAttribute('role', 'img')
    canvas.setAttribute('aria-label', player.name)
    frame.appendChild(canvas)

    preview.appendChild(frame)
    row.appendChild(preview)
    this._renderHeroPreview(canvas, player)
    return row
  }

  _humanizeAppearanceValue(value: string): string {
    return value
      .split('_')
      .map(part => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ')
  }

  _createHeroAppearanceControls(player: PlayerSetupConfigWithAge): HTMLDivElement {
    const group = document.createElement('div')
    group.className = 'hero-appearance-controls'
    const gender = normalizeHeroAppearanceGender(player.gender)
    const appearance = normalizeHeroAppearance(player.heroAppearance, player.civ, gender)
    player.heroAppearance = appearance

    const hairStyleRow = document.createElement('div')
    hairStyleRow.className = 'config-row'
    const hairStyleLabel = document.createElement('label')
    hairStyleLabel.textContent = t('heroHairStyle')
    hairStyleRow.appendChild(hairStyleLabel)
    const hairStyleSelect = document.createElement('select')
    hairStyleSelect.className = 'ui-select'
    HERO_HAIR_STYLE_OPTIONS[gender].forEach(style => {
      const opt = document.createElement('option')
      opt.value = style
      opt.textContent = this._humanizeAppearanceValue(style)
      if (style === appearance.hairStyle) opt.selected = true
      hairStyleSelect.appendChild(opt)
    })
    hairStyleSelect.onchange = (evt: Event) => this._setHeroHairStyle(0, (evt.target as HTMLSelectElement).value)
    hairStyleRow.appendChild(hairStyleSelect)
    group.appendChild(hairStyleRow)

    const hairColorRow = document.createElement('div')
    hairColorRow.className = 'config-row'
    const hairColorLabel = document.createElement('label')
    hairColorLabel.textContent = t('heroHairColor')
    hairColorRow.appendChild(hairColorLabel)
    const hairColorSelect = document.createElement('select')
    hairColorSelect.className = 'ui-select'
    HERO_HAIR_COLOR_OPTIONS.forEach(color => {
      const opt = document.createElement('option')
      opt.value = color
      opt.textContent = this._humanizeAppearanceValue(color)
      if (color === appearance.hairColor) opt.selected = true
      hairColorSelect.appendChild(opt)
    })
    hairColorSelect.onchange = (evt: Event) => this._setHeroHairColor(0, (evt.target as HTMLSelectElement).value)
    hairColorRow.appendChild(hairColorSelect)
    group.appendChild(hairColorRow)

    return group
  }

  _cycleTeam(playerIndex: number): void {
    const current = this.players[playerIndex].team
    this.players[playerIndex].team = current === null || current >= 9 ? (current === null ? 1 : null) : current + 1
    this._refresh()
    this._emitChange()
  }

  _refreshPlayerTable(): void {
    this.playerTableEl.innerHTML = ''

    const header = document.createElement('div')
    header.className = 'player-table-header'
    const headers = [t('colName'), t('colCiv'), t('genderLabel')]
    if (this.showAge) headers.push(t('colAge'))
    headers.push(t('colTeam'), t('colColor'))
    headers.forEach(text => {
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
      civSelect.onchange = (evt: Event) => {
        this._setPlayerCiv(index, (evt.target as HTMLSelectElement).value)
      }
      civCell.appendChild(civSelect)
      row.appendChild(civCell)

      const genderCell = document.createElement('div')
      genderCell.className = 'player-gender'
      const genderSelect = document.createElement('select')
      genderSelect.className = 'ui-select'
      GENDERS.forEach(gender => {
        const opt = document.createElement('option')
        opt.value = gender.value
        opt.textContent = gender.label()
        if (gender.value === player.gender) opt.selected = true
        genderSelect.appendChild(opt)
      })
      genderSelect.onchange = (evt: Event) => {
        this._setPlayerGender(index, (evt.target as HTMLSelectElement).value)
      }
      genderCell.appendChild(genderSelect)
      row.appendChild(genderCell)

      if (this.showAge) {
        const ageCell = document.createElement('div')
        ageCell.className = 'player-age'
        const ageSelect = document.createElement('select')
        ageSelect.className = 'ui-select'
        AGES.forEach(age => {
          const opt = document.createElement('option')
          opt.value = String(age.value)
          opt.textContent = age.label()
          if (age.value === player.age) opt.selected = true
          ageSelect.appendChild(opt)
        })
        ageSelect.onchange = (evt: Event) => {
          this.players[index].age = Number((evt.target as HTMLSelectElement).value)
          this._emitChange()
        }
        ageCell.appendChild(ageSelect)
        row.appendChild(ageCell)
      }

      const teamCell = document.createElement('div')
      teamCell.className = 'player-team'
      const teamBtn = document.createElement('button')
      teamBtn.className = 'team-cycle ui-btn'
      teamBtn.type = 'button'
      teamBtn.textContent = player.team == null ? '-' : String(player.team)
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

  // Simplified lobby: only the human's setup is editable because the opening map starts solo.
  _refreshHumanControls(): void {
    this.humanControlsEl.innerHTML = ''
    const human = this.players[0]

    const nameRow = document.createElement('div')
    nameRow.className = 'config-row'
    const nameLabel = document.createElement('label')
    nameLabel.textContent = t('playerNameLabel')
    nameRow.appendChild(nameLabel)
    const nameInput = document.createElement('input')
    nameInput.className = 'ui-input'
    nameInput.type = 'text'
    nameInput.maxLength = 24
    nameInput.value = human.name
    nameInput.addEventListener('input', (evt: Event) => {
      human.name = (evt.target as HTMLInputElement).value
      this._emitChange()
    })
    nameRow.appendChild(nameInput)
    this.humanControlsEl.appendChild(nameRow)

    const civRow = document.createElement('div')
    civRow.className = 'config-row'
    const civLabel = document.createElement('label')
    civLabel.textContent = t('colCiv')
    civRow.appendChild(civLabel)
    const civSelect = document.createElement('select')
    civSelect.className = 'ui-select'
    CIVS.forEach(civ => {
      const opt = document.createElement('option')
      opt.value = civ.value
      opt.textContent = typeof civ.label === 'function' ? civ.label() : civ.label
      if (civ.value === human.civ) opt.selected = true
      civSelect.appendChild(opt)
    })
    civSelect.onchange = (evt: Event) => {
      this._setPlayerCiv(0, (evt.target as HTMLSelectElement).value)
    }
    civRow.appendChild(civSelect)
    this.humanControlsEl.appendChild(civRow)

    this.humanControlsEl.appendChild(this._createHeroPreview(human))
    this.humanControlsEl.appendChild(this._createHeroAppearanceControls(human))

    const genderRow = document.createElement('div')
    genderRow.className = 'config-row'
    const genderLabel = document.createElement('label')
    genderLabel.textContent = t('genderLabel')
    genderRow.appendChild(genderLabel)
    const genderSelect = document.createElement('select')
    genderSelect.className = 'ui-select'
    GENDERS.forEach(gender => {
      const opt = document.createElement('option')
      opt.value = gender.value
      opt.textContent = gender.label()
      if (gender.value === human.gender) opt.selected = true
      genderSelect.appendChild(opt)
    })
    genderSelect.onchange = (evt: Event) => {
      this._setPlayerGender(0, (evt.target as HTMLSelectElement).value)
    }
    genderRow.appendChild(genderSelect)
    this.humanControlsEl.appendChild(genderRow)

    const colorRow = document.createElement('div')
    colorRow.className = 'config-row'
    const colorLabel = document.createElement('label')
    colorLabel.textContent = t('colColor')
    colorRow.appendChild(colorLabel)
    const colorData = PLAYER_COLORS.find(color => color.name === human.color)
    const swatch = document.createElement('button')
    swatch.className = 'color-swatch ui-btn'
    swatch.type = 'button'
    swatch.style.backgroundColor = colorData ? colorData.hex : '#fff'
    swatch.title = t('colorSwatch', { color: human.color })
    swatch.setAttribute('aria-label', t('colorSwatch', { color: human.color }))
    swatch.addEventListener('pointerdown', playClickSound)
    swatch.addEventListener('click', () => this._cycleColor(0))
    colorRow.appendChild(swatch)
    this.humanControlsEl.appendChild(colorRow)

    this.simplifiedExtraControls.forEach(control => {
      this.humanControlsEl.appendChild(control)
    })
  }

  _createPlayerCountSelect(): HTMLDivElement {
    const row = document.createElement('div')
    row.className = 'config-row player-count-row'

    const label = document.createElement('label')
    label.textContent = t('playerCount')

    this.playerCountSelect = document.createElement('select')
    this.playerCountSelect.className = 'ui-select'
    this.playerCountSelect.addEventListener('pointerdown', playClickSound)
    this.playerCountSelect.addEventListener('change', (evt: Event) =>
      this._setPlayerCount((evt.target as HTMLSelectElement).value)
    )

    row.appendChild(label)
    row.appendChild(this.playerCountSelect)
    this._refreshPlayerCountSelect()

    return row
  }

  _refreshPlayerCountSelect(): void {
    if (!this.playerCountSelect) return

    this.playerCountSelect.innerHTML = ''
    for (let count = MIN_PLAYERS; count <= this.maxPlayers; count++) {
      const option = document.createElement('option')
      option.value = String(count)
      option.textContent = String(count)
      if (count === this.players.length) option.selected = true
      this.playerCountSelect.appendChild(option)
    }
  }
}
