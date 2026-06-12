import { createDevCommands } from './createDevCommands'

export class DevConsole {
  constructor(context) {
    this.context = context
    this.commands = createDevCommands()
    this.history = []
    this.historyIndex = 0
    this.isOpen = false
    this.root = null
    this.input = null

    this._onKeyDown = evt => this.onKeyDown(evt)
    this._onSubmit = evt => this.onSubmit(evt)
    document.addEventListener('keydown', this._onKeyDown)
  }

  destroy() {
    document.removeEventListener('keydown', this._onKeyDown)
    this.close()
  }

  open() {
    if (this.isOpen || this.context.victory) return
    this.isOpen = true
    this.context.devConsoleOpen = true
    this.context.controls?.stopKeyboardMove?.()

    this.root = document.createElement('div')
    this.root.id = 'dev-console'

    const panel = document.createElement('form')
    panel.className = 'dev-console-panel ui-panel-enter'
    panel.addEventListener('submit', this._onSubmit)

    this.log = document.createElement('div')
    this.log.className = 'dev-console-log'
    this.log.textContent = 'Type help'

    this.input = document.createElement('input')
    this.input.className = 'ui-input dev-console-input'
    this.input.type = 'text'
    this.input.spellcheck = false
    this.input.autocomplete = 'off'

    panel.appendChild(this.log)
    panel.appendChild(this.input)
    this.root.appendChild(panel)
    this.context.gamebox.appendChild(this.root)

    requestAnimationFrame(() => this.input?.focus())
  }

  close() {
    if (!this.isOpen) return
    this.isOpen = false
    this.context.devConsoleOpen = false
    this.root?.remove()
    this.root = null
    this.input = null
    this.log = null
  }

  onKeyDown(evt) {
    if (!this.isOpen && evt.key === 'Enter') {
      evt.preventDefault()
      this.open()
      return
    }
    if (!this.isOpen) return

    if (evt.key === 'Escape') {
      evt.preventDefault()
      this.close()
      return
    }
    if (evt.key === 'Enter') {
      evt.preventDefault()
      this.executeInput()
      return
    }
    if (evt.key === 'ArrowUp') {
      evt.preventDefault()
      this.navigateHistory(-1)
      return
    }
    if (evt.key === 'ArrowDown') {
      evt.preventDefault()
      this.navigateHistory(1)
      return
    }
    if (evt.key === 'Tab') {
      evt.preventDefault()
      this.autocomplete()
    }
  }

  onSubmit(evt) {
    evt.preventDefault()
    this.executeInput()
  }

  executeInput() {
    const input = this.input.value.trim()
    if (!input) return

    this.history.push(input)
    this.historyIndex = this.history.length
    const result = this.commands.execute(input, {
      ...this.context,
      commands: this.commands,
    })
    this.log.textContent = result.message
    this.log.dataset.status = result.ok ? 'ok' : 'error'
    this.input.value = ''
    this.input.focus()
  }

  navigateHistory(direction) {
    if (!this.history.length) return
    this.historyIndex = Math.max(0, Math.min(this.history.length, this.historyIndex + direction))
    this.input.value = this.history[this.historyIndex] || ''
    this.input.setSelectionRange(this.input.value.length, this.input.value.length)
  }

  autocomplete() {
    const raw = this.input.value
    if (!raw.trim()) return

    const context = { ...this.context, commands: this.commands }
    const matches = this.commands.complete(raw, context)
    if (!matches.length) return

    if (matches.length === 1) {
      const endsWithSpace = /\s$/.test(raw)
      const tokens = raw.trim().split(/\s+/)
      const base = endsWithSpace ? tokens : tokens.slice(0, -1)
      this.input.value = `${[...base, matches[0]].join(' ')} `
    } else {
      this.log.textContent = matches.join('  ')
      this.log.dataset.status = 'ok'
    }
  }
}
