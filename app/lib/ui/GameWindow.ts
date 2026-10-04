import { consumeGamepadButtons } from '../input/gamepadConsumption'
import { LANG_CHANGE_EVENT, t } from '../lang'
import { availableCommands, type Command } from './GameWindowCommands'
import {
  findRetainedWindowItem,
  getClickedWindowRow,
  getWindowItemForTarget,
  getWindowNavigationPoint,
  getWindowTabScope,
  hasSteppableWindowField,
  isReplacedWindowSelection,
  isWindowItemCandidate,
  isWindowTabInScope,
  lostWindowSelectionFocus,
  markWindowSelection,
  preferActiveWindowTab,
  renderWindowDetails,
  unmarkWindowSelection,
  WINDOW_ITEMS,
} from './GameWindowElements'
import { renderCommandFooter } from './GameWindowFooter'
import { adjustWindowField, enhanceWindowForms } from './GameWindowForms'
import {
  EDITABLE_FIELD,
  findEnabledPadCommand,
  findLiveCommand,
  getHoldProgress,
  getKeyConfirmationChoice,
  getPadConfirmationChoice,
  getWindowGamepad,
  hasHeldDirectionalCommand,
  hasWindowKeyModifier,
  isEditingWindowField,
  isHoldComplete,
  isInventoryToggleKey,
  isNativeButtonActivation,
  isPadButtonBound,
  isUnboundWindowKey,
  keepsFieldKey,
  readWindowKeyIntent,
  type ConfirmationChoice,
  type WindowHold,
  type WindowKeyIntent,
} from './GameWindowInput'
import { scrollWindowInformation } from './GameWindowScroll'
import { findDirectionalTarget, GameWindowPadState } from './GameWindowNavigation'

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
  private lastScrollAt = 0
  private hadGamepad = false
  private confirmation: Command | null = null
  private holding: WindowHold | null = null
  private keyboardHolding: WindowHold | null = null
  private disposed = false
  private queued = false

  constructor(
    private panel: HTMLElement,
    private dismiss: () => void,
    private isTopmost: () => boolean,
    private dismissible = true
  ) {
    panel.classList.add('game-window')
    this.hadGamepad = Boolean(this.getGamepad())
    this.mode = this.hadGamepad ? 'gamepad' : 'keyboard'
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
    document.addEventListener('keyup', this.onKeyUp, true)
    window.addEventListener('blur', this.cancelKeyboardHold)
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
    return [...this.panel.querySelectorAll<HTMLElement>(WINDOW_ITEMS)].filter(
      element => isWindowItemCandidate(element, this.footer, this.details) && this.visible(element)
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
    this.select(findRetainedWindowItem(this.items(), this.selected, this.selectedId, this.selectedIndex), false)
  }

  private select(element: HTMLElement | null, focus: boolean): void {
    const restoreFocus = lostWindowSelectionFocus(element, this.selected) && this.isTopmost()
    const replacedSelection = isReplacedWindowSelection(element, this.selected, this.selectedId)
    if (element !== this.selected) {
      if (element?.id !== this.selectedId) {
        this.holding = null
        this.cancelKeyboardHold()
        this.confirmation = null
      }
      unmarkWindowSelection(this.selected)
      this.selected = element
    }
    if (element) {
      this.selectedId = element.id
      this.selectedIndex = this.items().indexOf(element)
      markWindowSelection(element)
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
    renderWindowDetails(this.details, this.selected)
  }

  private renderCommands(): void {
    this.commands = availableCommands({
      getSelected: () => this.selected,
      panel: this.panel,
      dismissible: this.dismissible,
      dismiss: this.dismiss,
      scheduleRefresh: () => this.scheduleRefresh(),
      switchPanel: direction => this.switchPanel(direction),
    })
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
            hold: false,
            confirm: false,
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
    const signature = JSON.stringify([
      this.mode,
      Boolean(this.items().length),
      this.confirmation?.label,
      commands.map(({ id, label, key, pad, disabled, description, hold }) => [
        id,
        label,
        key,
        pad,
        disabled,
        description,
        hold,
      ]),
    ])
    // Keep DOM focus on footer buttons through live resource/health refreshes.
    if (signature === this.signature) return
    this.signature = signature
    renderCommandFooter({
      footer: this.footer,
      mode: this.mode,
      confirmation: this.confirmation,
      commands,
      restoreSelectionFocus: () => this.selected?.focus({ preventScroll: true }),
      execute: command => this.execute(command),
      resolveCommand: command => (this.confirmation ? command : this.commands.find(item => item.id === command.id)),
    })
  }

  private execute(command: Command): void {
    if (command.disabled) return
    if (command.danger || command.confirm || command.hold) {
      this.confirmation = command
      this.renderCommands()
    } else {
      command.run()
      this.scheduleRefresh()
    }
  }

  private setMode(mode: 'keyboard' | 'gamepad'): void {
    if (mode === this.mode) return
    this.cancelKeyboardHold()
    this.mode = mode
    this.panel.dataset.inputMode = mode
    this.renderCommands()
  }

  private onPointer = (event: PointerEvent): void => {
    if (!this.footer.contains(event.target as Node)) this.setMode('keyboard')
  }
  private onFocus = (event: FocusEvent): void => {
    const item = getWindowItemForTarget(event.target as HTMLElement)
    if (this.items().includes(item) && item !== this.selected) this.select(item, false)
  }
  private onClick = (event: MouseEvent): void => {
    if (event.isTrusted) this.setMode('keyboard')
    const target = event.target as HTMLElement
    const choice = target.closest<HTMLElement>('[data-window-field]')
    if (choice) this.select(choice, true)
    const row = getClickedWindowRow(target)
    if (row) this.select(row, true)
    this.scheduleRefresh()
  }

  private onFieldChange = (): void => {
    this.footer.setAttribute('aria-label', t('windowCommands'))
    this.signature = ''
    this.scheduleRefresh()
  }

  private move(dx: number, dy: number): void {
    if (dx && hasSteppableWindowField(this.selected)) {
      adjustWindowField(this.selected, dx)
      this.scheduleRefresh()
      return
    }
    const items = this.items()
    if (!items.length && dy) {
      scrollWindowInformation(this.panel, dy * 48)
      return
    }
    const index = findDirectionalTarget(
      items.map(item => getWindowNavigationPoint(item, Boolean(dy))),
      items.indexOf(this.selected!),
      dx,
      dy
    )
    let next: HTMLElement | null = items[index] ?? null
    if (dy < 0) next = preferActiveWindowTab(items, next, this.selected)
    if (dx && this.selected?.matches('.ui-tab') && next?.matches('.ui-tab')) next.click()
    this.select(next, true)
  }

  private switchPanel(direction: number): void {
    const scope = getWindowTabScope(this.selected, this.panel)
    const tabs = [...scope.querySelectorAll<HTMLButtonElement>('.ui-tab')].filter(
      tab => !tab.disabled && this.visible(tab) && isWindowTabInScope(tab, scope, this.panel)
    )
    if (tabs.length) {
      const index = tabs.findIndex(tab => tab.getAttribute('aria-selected') === 'true')
      const tab = tabs[(index + direction + tabs.length) % tabs.length]
      tab.click()
      this.select(tab, true)
      return
    }
  }

  private onKey = (event: KeyboardEvent): void => {
    if (!this.isTopmost() || event.defaultPrevented || !this.acceptsWindowKey(event)) return
    if (this.toggleInventoryFromKey(event)) return
    const intent = readWindowKeyIntent(event, this.commands)
    if (isUnboundWindowKey(intent, event.key, Boolean(this.confirmation))) {
      if (event.key !== 'Tab') event.stopImmediatePropagation()
      return
    }
    if (!this.confirmation && isNativeButtonActivation(event, this.selected)) {
      event.stopImmediatePropagation()
      return
    }
    event.preventDefault()
    event.stopImmediatePropagation()
    if (this.confirmation) this.answerConfirmation(getKeyConfirmationChoice(event))
    else this.runKeyIntent(intent, event.repeat)
  }

  /** Rebinding prompts and text fields keep their keys; modifier chords never reach window commands. */
  private acceptsWindowKey(event: KeyboardEvent): boolean {
    const target = event.target as HTMLElement
    if (target.closest('.is-listening')) return false
    if (target.closest(EDITABLE_FIELD)) {
      this.cancelKeyboardHold()
      this.setMode('keyboard')
      if (keepsFieldKey(target, event.key)) return false
    }
    this.setMode('keyboard')
    if (hasWindowKeyModifier(event)) {
      this.cancelKeyboardHold()
      return false
    }
    if (event.key.toLowerCase() !== 'x') this.cancelKeyboardHold()
    return true
  }

  private toggleInventoryFromKey(event: KeyboardEvent): boolean {
    if (!isInventoryToggleKey(event, this.panel)) return false
    event.preventDefault()
    event.stopImmediatePropagation()
    if (!event.repeat) this.dismiss()
    return true
  }

  private runKeyIntent({ direction, command, page }: WindowKeyIntent, repeat: boolean): void {
    if (direction) this.move(direction[0], direction[1])
    else if (page) this.switchPanel(page)
    else if (command && !repeat) {
      if (command.hold && !command.disabled) this.keyboardHolding = { command, since: performance.now() }
      else this.execute(command)
    }
  }

  private answerConfirmation(choice: ConfirmationChoice): void {
    if (choice) this.footer.querySelector<HTMLButtonElement>(`[data-command="${choice}"]`)?.click()
  }

  private cancelKeyboardHold = (): void => {
    this.keyboardHolding = null
  }

  private onKeyUp = (event: KeyboardEvent): void => {
    if (['x', 'shift'].includes(event.key.toLowerCase())) this.cancelKeyboardHold()
  }

  private advanceKeyboardHold(now: number): void {
    const held = this.keyboardHolding
    if (!held) return
    const current = findLiveCommand(this.commands, held.command)
    if (!this.isTopmost() || this.confirmation || isEditingWindowField() || !current) {
      this.cancelKeyboardHold()
      return
    }
    this.footer.style.setProperty('--hold-progress', getHoldProgress(held, now))
    if (isHoldComplete(held, now)) {
      this.cancelKeyboardHold()
      current.run()
      this.scheduleRefresh()
    }
  }

  private getGamepad(): Gamepad | null {
    return getWindowGamepad(this.panel)
  }

  private poll = (now: number): void => {
    if (this.disposed) return
    const pad = this.getGamepad()
    if (pad && !this.hadGamepad) this.setMode('gamepad')
    this.hadGamepad = Boolean(pad)
    if (this.panel.querySelector('.is-listening')) {
      this.cancelKeyboardHold()
      this.padState.reset()
      this.holding = null
      this.frame = requestAnimationFrame(this.poll)
      return
    }
    if (pad && this.isTopmost()) {
      this.readGamepad(pad, now)
    } else {
      this.padState.reset()
      this.holding = null
      if (!pad) this.setMode('keyboard')
    }
    this.advanceKeyboardHold(now)
    this.footer.classList.toggle('is-holding', Boolean(this.holding || this.keyboardHolding))
    if (!this.disposed) this.frame = requestAnimationFrame(this.poll)
  }

  private readGamepad(pad: Gamepad, now: number): void {
    const { pressed, direction } = this.padState.read(pad, now)
    const readAxis = pad.axes[3] ?? 0
    const elapsed = Math.min(50, Math.max(0, now - (this.lastScrollAt || now)))
    this.lastScrollAt = now
    if (pressed.length || direction || Math.abs(readAxis) > 0.35) this.setMode('gamepad')
    if (!this.confirmation && Math.abs(readAxis) > 0.35) scrollWindowInformation(this.panel, readAxis * elapsed * 0.65)
    if (this.confirmation) {
      this.answerConfirmation(getPadConfirmationChoice(pressed))
      return
    }
    if (direction && !hasHeldDirectionalCommand(this.commands, pad)) this.move(...direction)
    if (pressed.includes(4) && !isPadButtonBound(this.commands, 4)) this.switchPanel(-1)
    if (pressed.includes(5) && !isPadButtonBound(this.commands, 5)) this.switchPanel(1)
    for (const index of pressed) {
      const command = findEnabledPadCommand(this.commands, index, pad)
      if (!command) continue
      if (command.hold) this.holding = { command, since: now }
      else this.execute(command)
      if (this.confirmation) break
    }
    this.advancePadHold(pad, now)
  }

  private advancePadHold(pad: Gamepad, now: number): void {
    const held = this.holding
    if (!held) return
    if (!pad.buttons[held.command.pad]?.pressed) this.holding = null
    else if (isHoldComplete(held, now)) {
      this.holding = null
      findLiveCommand(this.commands, held.command)?.run()
    }
    this.footer.style.setProperty('--hold-progress', getHoldProgress(held, now))
  }

  destroy(): void {
    const pad = this.getGamepad()
    if (pad) consumeGamepadButtons(pad)
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
    document.removeEventListener('keyup', this.onKeyUp, true)
    window.removeEventListener('blur', this.cancelKeyboardHold)
    this.cancelKeyboardHold()
  }
}
