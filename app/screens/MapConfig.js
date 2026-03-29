const STARTING_RESOURCES = [
  { label: 'Bas      — 100 / 150 / 50 / 0', value: 'low' },
  { label: 'Standard — 200 / 200 / 150 / 0', value: 'standard' },
  { label: 'Élevé    — 500 / 500 / 300 / 0', value: 'high' },
  { label: 'Très élevé — 1000 / 1000 / 750 / 100', value: 'very_high' },
]

const RESOURCES_MAP = {
  low: { wood: 100, food: 150, stone: 50, gold: 0 },
  standard: { wood: 200, food: 200, stone: 150, gold: 0 },
  high: { wood: 500, food: 500, stone: 300, gold: 0 },
  very_high: { wood: 1000, food: 1000, stone: 750, gold: 100 },
}

const MAP_SIZES = [
  { label: 'Tiny  (120×120) — 2 joueurs', value: 120 },
  { label: 'Small  (144×144) — 3 joueurs', value: 144 },
  { label: 'Medium (168×168) — 4 joueurs', value: 168 },
  { label: 'Normal (200×200) — 6 joueurs', value: 200 },
  { label: 'Large  (220×220) — 8 joueurs', value: 220 },
]

export default class MapConfig {
  constructor(onPlay, onBack) {
    this.config = {
      size: 120,
      bots: 1,
      revealEverything: false,
      revealTerrain: false,
      devMode: false,
      startingResources: RESOURCES_MAP.standard,
    }

    this.el = document.createElement('div')
    this.el.id = 'map-config'

    const panel = document.createElement('div')
    panel.className = 'menu-panel'

    const title = document.createElement('div')
    title.className = 'menu-title'
    title.textContent = 'Nouvelle Partie'

    const subtitle = document.createElement('div')
    subtitle.className = 'menu-subtitle'
    subtitle.textContent = 'Configuration'

    const divider = document.createElement('div')
    divider.className = 'menu-divider'

    const form = document.createElement('div')
    form.className = 'config-form'

    form.appendChild(
      this.createSelect('Carte', MAP_SIZES, 120, val => {
        this.config.size = parseInt(val)
      })
    )

    const botOptions = Array.from({ length: 7 }, (_, i) => ({
      label: `${i + 1} bot${i > 0 ? 's' : ''}`,
      value: i + 1,
    }))
    form.appendChild(
      this.createSelect('Adversaires (IA)', botOptions, 1, val => {
        this.config.bots = parseInt(val)
      })
    )

    form.appendChild(
      this.createSelect('Ressources de départ', STARTING_RESOURCES, 'standard', val => {
        this.config.startingResources = RESOURCES_MAP[val]
      })
    )

    form.appendChild(
      this.createCheckbox('Mode dev (instant build)', false, val => {
        this.config.devMode = val
      })
    )

    form.appendChild(
      this.createCheckbox('Tout révéler', false, val => {
        this.config.revealEverything = val
      })
    )

    form.appendChild(
      this.createCheckbox('Révéler le terrain', false, val => {
        this.config.revealTerrain = val
      })
    )

    const divider2 = document.createElement('div')
    divider2.className = 'menu-divider'

    const buttons = document.createElement('div')
    buttons.className = 'menu-buttons'

    const btnBack = document.createElement('button')
    btnBack.className = 'menu-btn secondary'
    btnBack.textContent = '← Retour'
    btnBack.onclick = onBack

    const btnPlay = document.createElement('button')
    btnPlay.className = 'menu-btn'
    btnPlay.textContent = 'Lancer la Partie'
    btnPlay.onclick = () => onPlay({ ...this.config })

    buttons.appendChild(btnBack)
    buttons.appendChild(btnPlay)

    panel.appendChild(title)
    panel.appendChild(subtitle)
    panel.appendChild(divider)
    panel.appendChild(form)
    panel.appendChild(divider2)
    panel.appendChild(buttons)

    this.el.appendChild(panel)
    document.body.appendChild(this.el)
  }

  createSelect(label, options, defaultValue, onChange) {
    const row = document.createElement('div')
    row.className = 'config-row'

    const lbl = document.createElement('label')
    lbl.textContent = label

    const select = document.createElement('select')
    options.forEach(opt => {
      const option = document.createElement('option')
      option.value = opt.value
      option.textContent = opt.label
      if (opt.value === defaultValue) option.selected = true
      select.appendChild(option)
    })
    select.onchange = e => onChange(e.target.value)

    row.appendChild(lbl)
    row.appendChild(select)
    return row
  }

  createCheckbox(label, defaultValue, onChange) {
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
