import { canPlayerStillAct, isPlayerEliminated } from '../lib'

export class PlayerStatsManager {
  constructor(menu) {
    this.menu = menu
    this._open = false
    this._renderSignature = null
    this._tickRender = () => this.update()

    this.btn = document.createElement('button')
    this.btn.className = 'player-stats-btn btn-ui'
    this.btn.textContent = 'S'
    this.btn.addEventListener('pointerdown', evt => {
      evt.preventDefault()
      evt.stopPropagation()
      this._toggle()
    })
    menu.bottombar.appendChild(this.btn)

    this.el = document.createElement('div')
    this.el.className = 'player-stats'
    document.body.appendChild(this.el)
  }

  _toggle() {
    this._open = !this._open
    if (this._open) {
      this.menu.context.app.ticker.add(this._tickRender)
      this._render()
      this.el.classList.add('player-stats--open')
    } else {
      this.menu.context.app.ticker.remove(this._tickRender)
      this.el.classList.remove('player-stats--open')
    }
  }

  _getRenderData() {
    const { players, player: me } = this.menu.context
    const sorted = [...players].sort((a, b) => {
      const activeDiff = Number(canPlayerStillAct(b)) - Number(canPlayerStillAct(a))
      if (activeDiff !== 0) return activeDiff

      const scoreA = a.units.length + a.buildings.length
      const scoreB = b.units.length + b.buildings.length
      return scoreB - scoreA
    })
    return sorted.map((p, rank) => {
      const dead = isPlayerEliminated(p)
      const isMe = p === me
      const label = isMe ? 'You' : p.color.charAt(0).toUpperCase() + p.color.slice(1)
      return {
        dead,
        colorHex: p.colorHex,
        text: `${rank + 1}. ${label}: ${p.units.length}/${p.buildings.length}`,
      }
    })
  }

  _render() {
    const rows = this._getRenderData()
    const nextSignature = JSON.stringify(rows)

    if (nextSignature === this._renderSignature) {
      return
    }

    this._renderSignature = nextSignature
    this.el.innerHTML = ''

    rows.forEach(({ dead, colorHex, text }) => {
      const span = document.createElement('span')
      span.className = 'player-stats-name' + (dead ? ' player-stats-name--dead' : '')
      span.style.color = colorHex
      span.textContent = text

      this.el.appendChild(span)
    })
  }

  update() {
    if (this._open) this._render()
  }

  destroy() {
    this.menu.context.app.ticker.remove(this._tickRender)
    this.btn.remove()
    this.el.remove()
  }
}
