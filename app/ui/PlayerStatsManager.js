export class PlayerStatsManager {
  constructor(menu) {
    this.menu = menu
    this._open = false

    this.btn = document.createElement('button')
    this.btn.className = 'player-stats-btn'
    this.btn.textContent = 'S'
    this.btn.addEventListener('pointerdown', evt => {
      evt.preventDefault()
      evt.stopPropagation()
      this._toggle()
    })
    menu.bottombar.appendChild(this.btn)

    this.el = document.createElement('div')
    this.el.className = 'player-stats'
    this.el.style.display = 'none'
    document.body.appendChild(this.el)
  }

  _toggle() {
    this._open = !this._open
    if (this._open) {
      this._render()
      this.el.style.display = ''
    } else {
      this.el.style.display = 'none'
    }
  }

  _render() {
    const { players, player: me } = this.menu.context
    this.el.innerHTML = ''
    players.forEach(p => {
      const dead = p.units.length === 0 && p.buildings.length === 0
      const isMe = p === me
      const label = isMe ? 'You' : p.color.charAt(0).toUpperCase() + p.color.slice(1)

      const span = document.createElement('span')
      span.className = 'player-stats-name' + (dead ? ' player-stats-name--dead' : '')
      span.style.color = p.colorHex
      span.textContent = `${label}: ${p.units.length}/${p.buildings.length}`

      this.el.appendChild(span)
    })
  }

  update() {
    if (this._open) this._render()
  }

  destroy() {
    this.btn.remove()
    this.el.remove()
  }
}
