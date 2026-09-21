import { getControlActionForKeyboardEvent, getGamepadEnabled, getGamepadButtonIndex } from '../audio/settings'
import { getActiveGamepad } from '../input/gamepad'
import { t, LANG_CHANGE_EVENT } from '../lang'
import { adjustWindowField, canAdjustWindowField, enhanceWindowForms, getWindowField } from './GameWindowForms'
import { findDirectionalTarget, GameWindowPadState } from './GameWindowNavigation'

type Command = {
  id: string
  label: string
  key: string
  pad: number
  glyph: string
  disabled?: boolean
  danger?: boolean
  run: () => void
}

const ROW = '.inventory-action-row'
const GLOBAL_ACTION = '[data-window-action], .entity-delete-building-button'
const PAD_GLYPHS = ['A', 'B', 'X', 'Y', 'LB', 'RB', 'LT', 'RT', 'View', 'Menu', 'L3', 'R3', '↑', '↓', '←', '→']

/** Shared selection, detail panel and input-aware footer. Domain actions stay with their owners. */
export class GameWindow {
  private readonly details = document.createElement('div')
  private readonly footer = document.createElement('footer')
  private readonly observer: MutationObserver
  private readonly padState = new GameWindowPadState()
  private frame = 0
  private selected: HTMLElement | null = null
  private selectedId = ''
  private selectedIndex = 0
  private commands: Command[] = []
  private signature = ''
  private mode: 'keyboard' | 'gamepad' = 'keyboard'
  private confirmation: Command | null = null
  private holding: { command: Command; since: number } | null = null
  private disposed = false
  private queued = false

  constructor(
    private panel: HTMLElement,
    private dismiss: () => void,
    private isTopmost: () => boolean,
    private dismissible = true
  ) {
    panel.classList.add('game-window')
    panel.dataset.inputMode = this.mode
    this.details.className = 'game-window-details'
    this.details.hidden = true
    this.footer.className = 'game-window-footer'
    this.footer.setAttribute('aria-label', t('windowCommands'))
    panel.append(this.details, this.footer)
    panel.addEventListener('click', this.onClick)
    panel.addEventListener('focusin', this.onFocus)
    panel.addEventListener('pointerdown', this.onPointer)
    panel.addEventListener('input', this.onFieldChange)
    panel.addEventListener('change', this.onFieldChange)
    window.addEventListener(LANG_CHANGE_EVENT, this.onFieldChange)
    document.addEventListener('keydown', this.onKey, true)
    this.observer = new MutationObserver(records => {
      if (records.some(record => !this.footer.contains(record.target) && !this.details.contains(record.target))) {
        this.scheduleRefresh()
      }
    })
    this.observer.observe(panel, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ['disabled'],
    })
    this.refresh()
    this.frame = requestAnimationFrame(this.poll)
  }

  private visible(element: HTMLElement): boolean {
    return !element.closest('[hidden], .hidden, [aria-hidden="true"]') && element.getClientRects().length > 0
  }

  private items(): HTMLElement[] {
    return [
      ...this.panel.querySelectorAll<HTMLElement>(
        `${ROW}, button, input:not([type=hidden]), select:not([hidden]), [data-window-field], [role="button"]`
      ),
    ].filter(
      element =>
        !this.footer.contains(element) &&
        !this.details.contains(element) &&
        !element.matches('.modal-close, .window-choice-arrow') &&
        !element.closest('.inventory-row-actions') &&
        !element.matches(GLOBAL_ACTION) &&
        this.visible(element)
    )
  }

  private scheduleRefresh(): void {
    if (this.queued || this.disposed) return
    this.queued = true
    queueMicrotask(() => {
      this.queued = false
      if (!this.disposed) this.refresh()
    })
  }

  private refresh(): void {
    enhanceWindowForms(this.panel)
    const items = this.items()
    const next =
      items.find(item => item === this.selected) ??
      items.find(item => this.selectedId && item.id === this.selectedId) ??
      items[Math.min(this.selectedIndex, items.length - 1)] ??
      null
    this.select(next, false)
  }

  private select(element: HTMLElement | null, focus: boolean): void {
    const restoreFocus = Boolean(
      element &&
        this.selected &&
        !this.selected.isConnected &&
        document.activeElement === document.body &&
        this.isTopmost()
    )
    const replacedSelection = Boolean(
      element && this.selected && element !== this.selected && element.id && element.id === this.selectedId
    )
    if (element !== this.selected) {
      if (element?.id !== this.selectedId) {
        this.holding = null
        this.confirmation = null
      }
      this.selected?.classList.remove('is-window-selected')
      if (this.selected?.matches(ROW)) this.selected.tabIndex = -1
      this.selected = element
    }
    if (element) {
      this.selectedId = element.id
      this.selectedIndex = this.items().indexOf(element)
      element.classList.add('is-window-selected')
      if (element.matches(ROW)) {
        element.tabIndex = 0
        element.setAttribute('role', 'group')
      }
      if (replacedSelection) element.scrollIntoView({ block: 'nearest', inline: 'nearest' })
      if (focus || restoreFocus) {
        element.focus({ preventScroll: true })
        element.scrollIntoView({ block: 'nearest', inline: 'nearest' })
      }
    }
    this.renderDetails()
    this.renderCommands()
  }

  private renderDetails(): void {
    const row = this.selected?.matches(`${ROW}:not(.inventory-action-row--no-icon)`) ? this.selected : null
    const texts = row
      ? [
          ...row.querySelectorAll<HTMLElement>(
            '.inventory-action-row-label, .inventory-action-row-description, .inventory-action-row-meta, .inventory-action-row-value, .inventory-action-row-badge'
          ),
        ]
          .map(element => element.textContent?.trim())
          .filter(Boolean)
      : []
    const disabled = row?.querySelector<HTMLButtonElement>('.inventory-row-action-button:disabled[title]')
    if (disabled?.title) texts.push(disabled.title)
    const text = texts.join(' · ')
    this.details.hidden = !text
    if (this.details.textContent !== text) this.details.textContent = text
  }

  private buttonCommand(button: HTMLButtonElement, id: string, key: string, pad: number): Command {
    return {
      id,
      key,
      pad,
      glyph: PAD_GLYPHS[pad],
      label:
        button.dataset.windowLabel ||
        button.querySelector('.hero-building-menu-label')?.textContent?.trim() ||
        button.textContent?.trim() ||
        button.getAttribute('aria-label') ||
        '',
      disabled: button.disabled,
      danger: button.matches('.entity-delete-building-button, .inventory-row-action-button--delete'),
      run: () => {
        if (button.isConnected && !button.disabled) button.click()
      },
    }
  }

  private availableCommands(): Command[] {
    const commands: Command[] = []
    const field = getWindowField(this.selected)
    if (field) {
      if (field instanceof HTMLSelectElement || field.type === 'range') {
        for (const direction of [-1, 1])
          commands.push({
            id: direction < 0 ? 'decrease' : 'increase',
            label: t(direction < 0 ? 'windowPrevious' : 'windowNext'),
            key: direction < 0 ? 'ArrowLeft' : 'ArrowRight',
            pad: -1,
            glyph: direction < 0 ? '←' : '→',
            disabled: !canAdjustWindowField(this.selected, direction),
            run: () => {
              adjustWindowField(this.selected, direction)
              this.scheduleRefresh()
            },
          })
      } else {
        commands.push({
          id: 'field',
          label: t(field.type === 'checkbox' ? 'windowToggle' : 'windowEditText'),
          key: 'Enter',
          pad: 0,
          glyph: 'A',
          disabled: field.disabled,
          run: () => {
            if (field.type === 'checkbox') field.click()
            else {
              field.focus()
              field.select()
            }
          },
        })
      }
    }
    const row = this.selected
    const buttons = row?.matches(ROW)
      ? [...row.querySelectorAll<HTMLButtonElement>('.inventory-row-action-button')]
      : []
    const primary =
      buttons.find(button => !button.matches('.inventory-row-action-button--delete')) ??
      (row instanceof HTMLButtonElement ? row : null)
    if (primary) {
      commands.push(this.buttonCommand(primary, 'primary', 'Enter', 0))
      if (primary.dataset.inventoryTransferSlot === 'true') {
        commands.push({
          ...this.buttonCommand(primary, 'stack', 'Shift+Enter', 2),
          label: t('windowWholeStack'),
          run: () => {
            if (primary.isConnected && !primary.disabled)
              primary.dispatchEvent(new MouseEvent('click', { bubbles: true, shiftKey: true }))
          },
        })
      }
    }
    const secondary = buttons.find(button => button !== primary)
    if (secondary) {
      commands.push(this.buttonCommand(secondary, 'secondary', 'Delete', 3))
      if (
        secondary.matches('.inventory-row-action-button--delete') &&
        row?.querySelector('.inventory-quantity-badge')
      ) {
        commands.push({
          ...this.buttonCommand(secondary, 'secondary-stack', 'Shift+Delete', 8),
          label: t('windowDeleteStack'),
          run: () => {
            if (secondary.isConnected && !secondary.disabled)
              secondary.dispatchEvent(new MouseEvent('click', { bubbles: true, shiftKey: true }))
          },
        })
      }
    }
    const section = row?.closest('.inventory-section')
    const all = section?.querySelector<HTMLButtonElement>('.inventory-transfer-all-button')
    if (all) commands.push(this.buttonCommand(all, 'all', 'R', 7))
    for (const button of this.panel.querySelectorAll<HTMLButtonElement>(GLOBAL_ACTION)) {
      if (button.closest('[hidden], .hidden, [aria-hidden="true"]')) continue
      const danger = button.matches('.entity-delete-building-button')
      commands.push(
        this.buttonCommand(button, danger ? 'remove' : 'deliveries', danger ? 'Delete' : 'V', danger ? 3 : 6)
      )
    }
    if (this.panel.querySelectorAll('.ui-tab').length > 1) {
      for (const direction of [-1, 1])
        commands.push({
          id: direction < 0 ? 'previous-tab' : 'next-tab',
          label: t(direction < 0 ? 'windowPreviousTab' : 'windowNextTab'),
          key: direction < 0 ? 'PageUp' : 'PageDown',
          pad: direction < 0 ? 4 : 5,
          glyph: direction < 0 ? 'LB' : 'RB',
          run: () => this.switchPanel(direction),
        })
    }
    if (this.dismissible)
      commands.push({ id: 'close', label: t('close'), key: 'Escape', pad: 1, glyph: 'B', run: this.dismiss })
    if (primary?.dataset.inventoryTransferSlot === 'true') {
      const assigned = new Set<number>()
      for (const [id, action] of [
        ['primary', 'inventoryTransferOne'],
        ['stack', 'inventoryTransferAll'],
      ] as const) {
        const command = commands.find(value => value.id === id)
        const pad = getGamepadButtonIndex(action)
        if (!command || assigned.has(pad)) continue
        const occupied = commands.find(value => value !== command && value.pad === pad)
        if (occupied) {
          occupied.pad = command.pad
          occupied.glyph = PAD_GLYPHS[occupied.pad] ?? String(occupied.pad)
        }
        command.pad = pad
        command.glyph = PAD_GLYPHS[pad] ?? String(pad)
        assigned.add(pad)
      }
    }
    return commands
  }

  private renderCommands(): void {
    this.commands = this.availableCommands()
    if (
      this.confirmation &&
      !this.commands.some(command => command.id === this.confirmation?.id && !command.disabled)
    ) {
      this.confirmation = null
    }
    const commands = this.confirmation
      ? [
          {
            ...this.confirmation,
            id: 'confirm',
            label: t('windowConfirm'),
            key: 'Enter',
            pad: 0,
            glyph: 'A',
            danger: false,
            run: () => {
              const command = this.commands.find(item => item.id === this.confirmation?.id)
              this.confirmation = null
              if (command && !command.disabled) command.run()
              this.signature = ''
              this.scheduleRefresh()
            },
          },
          {
            id: 'cancel',
            label: t('cancel'),
            key: 'Escape',
            pad: 1,
            glyph: 'B',
            run: () => {
              this.confirmation = null
              this.renderCommands()
            },
          },
        ]
      : this.commands
    const multiplePanels = this.panel.querySelectorAll('.inventory-section, .ui-tab:not([hidden])').length > 1
    const signature = JSON.stringify([
      multiplePanels,
      this.mode,
      Boolean(this.items().length),
      this.confirmation?.label,
      commands.map(({ id, label, key, pad, disabled }) => [id, label, key, pad, disabled]),
    ])
    // Keep DOM focus on footer buttons through live resource/health refreshes.
    if (signature === this.signature) return
    this.signature = signature
    const focusedCommand = (document.activeElement as HTMLElement | null)?.dataset.command
    this.footer.replaceChildren()
    if (this.confirmation) {
      const question = document.createElement('span')
      question.className = 'game-window-confirmation'
      question.textContent = `${this.confirmation.label} ?`
      this.footer.appendChild(question)
    }
    if (!this.confirmation && this.items().length) {
      const navigation = document.createElement('span')
      navigation.className = 'game-window-navigation'
      navigation.textContent =
        this.mode === 'gamepad' ? `✥ ${t('windowNavigation')}` : `↑ ↓ ← → ${t('windowNavigation')}`
      if (multiplePanels)
        navigation.textContent +=
          this.mode === 'gamepad' ? ` · LB / RB ${t('windowPanels')}` : ` · Page ↑ / ↓ ${t('windowPanels')}`
      this.footer.appendChild(navigation)
    }
    for (const command of commands) {
      const button = document.createElement('button')
      button.type = 'button'
      button.className = 'game-window-command'
      button.dataset.command = command.id
      button.disabled = command.disabled ?? false
      button.classList.toggle('is-danger', Boolean(command.danger))
      const key = document.createElement('kbd')
      key.textContent =
        this.mode === 'gamepad'
          ? command.glyph
          : ({ ArrowLeft: '←', ArrowRight: '→', Enter: '↵', Escape: 'Esc', PageUp: 'Pg ↑', PageDown: 'Pg ↓' }[
              command.key
            ] ?? command.key)
      key.dataset.pad = String(command.pad)
      const label = document.createElement('span')
      label.textContent = `${command.label}${command.danger && this.mode === 'gamepad' ? ` · ${t('windowHold')}` : ''}`
      button.append(key, label)
      button.addEventListener('click', () => {
        // Resolve fresh handlers: live refreshes may have replaced the source button.
        const current = this.confirmation ? command : this.commands.find(item => item.id === command.id)
        if (current) this.execute(current)
      })
      this.footer.appendChild(button)
      if (focusedCommand === command.id) button.focus({ preventScroll: true })
    }
    if (this.confirmation) this.footer.querySelector<HTMLButtonElement>('button')?.focus({ preventScroll: true })
    else if (focusedCommand && !this.footer.contains(document.activeElement))
      this.selected?.focus({ preventScroll: true })
  }

  private execute(command: Command): void {
    if (command.disabled) return
    if (command.danger) {
      this.confirmation = command
      this.renderCommands()
    } else {
      command.run()
      this.scheduleRefresh()
    }
  }

  private setMode(mode: 'keyboard' | 'gamepad'): void {
    if (mode === this.mode) return
    this.mode = mode
    this.panel.dataset.inputMode = mode
    this.renderCommands()
  }

  private onPointer = (event: PointerEvent): void => {
    if (!this.footer.contains(event.target as Node)) this.setMode('keyboard')
  }
  private onFocus = (event: FocusEvent): void => {
    const target = event.target as HTMLElement
    const item = target.closest<HTMLElement>('[data-window-field]') ?? target.closest<HTMLElement>(ROW) ?? target
    if (this.items().includes(item) && item !== this.selected) this.select(item, false)
  }
  private onClick = (event: MouseEvent): void => {
    if (event.isTrusted) this.setMode('keyboard')
    const target = event.target as HTMLElement
    const choice = target.closest<HTMLElement>('[data-window-field]')
    if (choice) this.select(choice, true)
    const row = target.closest<HTMLElement>(ROW)
    if (row && !target.closest('.inventory-row-actions')) this.select(row, true)
    this.scheduleRefresh()
  }

  private onFieldChange = (): void => {
    this.footer.setAttribute('aria-label', t('windowCommands'))
    this.panel.querySelector('.modal-close')?.setAttribute('aria-label', t('close'))
    this.signature = ''
    this.scheduleRefresh()
  }

  private move(dx: number, dy: number): void {
    const field = getWindowField(this.selected)
    if (dx && field && (field instanceof HTMLSelectElement || field.type === 'range' || field.type === 'checkbox')) {
      adjustWindowField(this.selected, dx)
      this.scheduleRefresh()
      return
    }
    const items = this.items()
    const index = findDirectionalTarget(
      items.map(item => {
        const rect = item.getBoundingClientRect()
        return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 }
      }),
      items.indexOf(this.selected!),
      dx,
      dy
    )
    let next = items[index] ?? null
    if (dy < 0 && next?.matches('.ui-tab') && !this.selected?.matches('.ui-tab')) {
      next = items.find(item => item.matches('.ui-tab[aria-selected="true"]')) ?? next
    }
    if (dx && this.selected?.matches('.ui-tab') && next?.matches('.ui-tab')) next.click()
    this.select(next, true)
  }

  private switchPanel(direction: number): void {
    const tabs = [...this.panel.querySelectorAll<HTMLButtonElement>('.ui-tab')].filter(
      tab => !tab.disabled && this.visible(tab)
    )
    if (tabs.length) {
      const index = tabs.findIndex(tab => tab.getAttribute('aria-selected') === 'true')
      const tab = tabs[(index + direction + tabs.length) % tabs.length]
      tab.click()
      this.select(tab, true)
      return
    }
    const sections = [...this.panel.querySelectorAll<HTMLElement>('.inventory-section')].filter(section =>
      this.visible(section)
    )
    if (!sections.length) return
    const index = sections.indexOf(this.selected?.closest('.inventory-section') as HTMLElement)
    const section = sections[(Math.max(0, index) + direction + sections.length) % sections.length]
    this.select(this.items().find(item => section.contains(item)) ?? null, true)
  }

  private onKey = (event: KeyboardEvent): void => {
    if (!this.isTopmost() || event.defaultPrevented) return
    const target = event.target as HTMLElement
    if (target.closest('.is-listening')) return
    if (target.matches('input:not([type=range]):not([type=checkbox]), textarea, [contenteditable="true"]')) {
      this.setMode('keyboard')
      // Single-line fields keep horizontal caret movement; vertical arrows navigate the window.
      const verticalNavigation = target.matches('input') && ['ArrowUp', 'ArrowDown'].includes(event.key)
      if (!verticalNavigation && !['Escape', 'PageUp', 'PageDown'].includes(event.key)) return
    }
    this.setMode('keyboard')
    if (getControlActionForKeyboardEvent(event) === 'inventory' && this.panel.classList.contains('inventory-panel')) {
      event.preventDefault()
      event.stopImmediatePropagation()
      if (!event.repeat) this.dismiss()
      return
    }
    const direction = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[event.key]
    const commandKey = event.shiftKey && ['Enter', 'Delete'].includes(event.key) ? `Shift+${event.key}` : event.key
    const command = this.commands.find(item => item.key.toLowerCase() === commandKey.toLowerCase())
    const page = event.key === 'PageUp' ? -1 : event.key === 'PageDown' ? 1 : 0
    if (!direction && !command && !page && !(this.confirmation && ['Enter', 'Escape'].includes(event.key))) {
      if (event.key !== 'Tab') event.stopImmediatePropagation()
      return
    }
    // Native keyboard activation of a focused command remains available.
    if (
      !this.confirmation &&
      event.key === 'Enter' &&
      !event.shiftKey &&
      document.activeElement instanceof HTMLButtonElement &&
      document.activeElement !== this.selected
    ) {
      event.stopImmediatePropagation()
      return
    }
    event.preventDefault()
    event.stopImmediatePropagation()
    if (this.confirmation) {
      if (!event.repeat && (event.key === 'Enter' || event.key === 'Escape')) {
        this.footer
          .querySelector<HTMLButtonElement>(`[data-command="${event.key === 'Enter' ? 'confirm' : 'cancel'}"]`)
          ?.click()
      }
      return
    }
    if (direction) this.move(direction[0], direction[1])
    else if (page) this.switchPanel(page)
    else if (command && !event.repeat) this.execute(command)
  }

  private poll = (now: number): void => {
    if (this.disposed) return
    // Settings must remain navigable after the gameplay gamepad option is turned off.
    const pad =
      getGamepadEnabled() || !this.panel.closest('.inventory-panel, .inventory-transfer-modal, .interaction-panel')
        ? getActiveGamepad()
        : null
    if (this.panel.querySelector('.is-listening')) {
      this.padState.reset()
      this.holding = null
      this.frame = requestAnimationFrame(this.poll)
      return
    }
    if (pad && this.isTopmost()) {
      const { pressed, direction } = this.padState.read(pad, now)
      if (pressed.length || direction) this.setMode('gamepad')
      if (this.confirmation) {
        if (pressed.includes(0) || pressed.includes(1)) {
          this.footer
            .querySelector<HTMLButtonElement>(`[data-command="${pressed.includes(1) ? 'cancel' : 'confirm'}"]`)
            ?.click()
        }
      } else {
        const bound = (index: number) => this.commands.some(command => command.pad === index)
        const directionalCommand = this.commands.some(
          command => command.pad >= 12 && command.pad <= 15 && pad.buttons[command.pad]?.pressed
        )
        if (direction && !directionalCommand) this.move(...direction)
        if (pressed.includes(4) && !bound(4)) this.switchPanel(-1)
        if (pressed.includes(5) && !bound(5)) this.switchPanel(1)
        for (const index of pressed) {
          const command = this.commands.find(item => item.pad === index)
          if (!command || command.disabled) continue
          if (command.danger) this.holding = { command, since: now }
          else this.execute(command)
        }
        if (this.holding) {
          const held = this.holding
          if (!pad.buttons[held.command.pad]?.pressed) this.holding = null
          else if (now - held.since >= 850) {
            this.holding = null
            const current = this.commands.find(command => command.id === held.command.id)
            if (current && !current.disabled) current.run()
          }
          this.footer.style.setProperty('--hold-progress', `${Math.min(100, (now - held.since) / 8.5)}%`)
        }
      }
    } else {
      this.padState.reset()
      this.holding = null
      if (!pad) this.setMode('keyboard')
    }
    this.footer.classList.toggle('is-holding', Boolean(this.holding))
    if (!this.disposed) this.frame = requestAnimationFrame(this.poll)
  }

  destroy(): void {
    this.disposed = true
    cancelAnimationFrame(this.frame)
    this.observer.disconnect()
    this.panel.removeEventListener('click', this.onClick)
    this.panel.removeEventListener('focusin', this.onFocus)
    this.panel.removeEventListener('pointerdown', this.onPointer)
    this.panel.removeEventListener('input', this.onFieldChange)
    this.panel.removeEventListener('change', this.onFieldChange)
    window.removeEventListener(LANG_CHANGE_EVENT, this.onFieldChange)
    document.removeEventListener('keydown', this.onKey, true)
  }
}
