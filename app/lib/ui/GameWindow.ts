import { getWindowInteraction } from './GameWindowInteraction'
import { consumeGamepadButtons } from '../input/gamepadConsumption'
import { LANG_CHANGE_EVENT, t } from '../lang'
import { availableCommands, type Command } from './GameWindowCommands'
import { GameWindowControls } from './GameWindowControls'
import { confirmationCommands, retainedConfirmation, windowCommandSignature } from './GameWindowConfirmation'
import {
  findRetainedWindowItem,
  getClickedWindowRow,
  getWindowItemForTarget,
  isReplacedWindowSelection,
  isWindowItemCandidate,
  lostWindowSelectionFocus,
  markWindowSelection,
  renderDockedWindowDetails,
  unmarkWindowSelection,
  WINDOW_ITEMS,
} from './GameWindowElements'
import { renderCommandFooter } from './GameWindowFooter'
import { enhanceWindowForms } from './GameWindowForms'
import {
  getKeyConfirmationChoice,
  getWindowGamepad,
  isNativeButtonActivation,
  isUnboundWindowKey,
  readWindowKeyIntent,
} from './GameWindowInput'
import { moveWindowSelection } from './GameWindowMove'
import { scrollWindowSelectionIntoView } from './GameWindowScroll'
import { isTabNavigationCommand, renderWindowTabHints } from './GameWindowTabHints'

/** Shared selection, detail panel and input-aware footer. Domain actions stay with their owners. */
export class GameWindow {
  private readonly details = document.createElement('div')
  private readonly footer = document.createElement('footer')
  private readonly observer: MutationObserver
  private readonly controls: GameWindowControls
  private frame = 0
  private selected: HTMLElement | null = null
  private selectedId = ''
  private selectedIndex = 0
  private commands: Command[] = []
  private signature = ''
  private mode: 'keyboard' | 'gamepad' = 'keyboard'
  private hadGamepad = false
  private confirmation: Command | null = null
  private disposed = false
  private queued = false

  constructor(
    private panel: HTMLElement,
    private dismiss: () => void,
    private isTopmost: () => boolean,
    private dismissible = true
  ) {
    const owner = () => this
    this.controls = new GameWindowControls({
      get panel() {
        return owner().panel
      },
      get footer() {
        return owner().footer
      },
      get commands() {
        return owner().commands
      },
      get selected() {
        return owner().selected
      },
      get confirmation() {
        return owner().confirmation
      },
      isTopmost: () => this.isTopmost(),
      dismiss: () => this.dismiss(),
      move: (dx, dy) => this.move(dx, dy),
      switchPanel: direction => this.switchPanel(direction),
      setMode: mode => this.setMode(mode),
      refresh: () => this.refresh(),
      scheduleRefresh: () => this.scheduleRefresh(),
      execute: command => this.execute(command),
      visible: element => this.visible(element),
      select: (element, focus) => this.select(element, focus),
    })
    panel.classList.add('game-window')
    const initialPad = this.getGamepad()
    this.hadGamepad = Boolean(initialPad)
    // Only presses already held at opening should be ignored, not a new press before the first frame.
    if (initialPad) this.controls.padState.read(initialPad, performance.now())
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
    panel.addEventListener('pointermove', this.onPointerMove)
    panel.addEventListener('input', this.onFieldChange)
    panel.addEventListener('change', this.onFieldChange)
    panel.addEventListener('windowinteractionchange', this.onFieldChange)
    panel.addEventListener('equipmentavatarready', this.onAvatarReady)
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
      attributeFilter: ['disabled', 'data-equipment-durability'],
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
        this.controls.holding = null
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
      if (replacedSelection) scrollWindowSelectionIntoView(element)
      if (focus || restoreFocus) {
        element.focus({ preventScroll: true })
        scrollWindowSelectionIntoView(element)
      }
    }
    this.renderDetails()
    this.renderCommands()
  }

  private renderDetails(): void {
    renderDockedWindowDetails(this.panel, this.details, this.footer, this.selected)
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
    this.confirmation = retainedConfirmation(this.confirmation, this.commands)
    const commands = this.confirmation
      ? confirmationCommands(
          this.confirmation,
          () => this.confirmPending(),
          () => this.cancelPending()
        )
      : this.commands
    renderWindowTabHints(this.panel, this.selected, commands, this.mode)
    const footerCommands = commands.filter(command => !isTabNavigationCommand(command))
    const signature = windowCommandSignature(this.mode, Boolean(this.items().length), this.confirmation, commands)
    // Keep DOM focus on footer buttons through live resource/health refreshes.
    if (signature === this.signature) return
    this.signature = signature
    renderCommandFooter({
      footer: this.footer,
      mode: this.mode,
      confirmation: this.confirmation,
      commands: footerCommands,
      restoreSelectionFocus: () => this.selected?.focus({ preventScroll: true }),
      execute: command => this.execute(command),
      resolveCommand: command => (this.confirmation ? command : this.commands.find(item => item.id === command.id)),
    })
  }

  private confirmPending(): void {
    const command = this.commands.find(item => item.id === this.confirmation?.id)
    this.confirmation = null
    if (command && !command.disabled) command.run()
    this.signature = ''
    this.scheduleRefresh()
  }

  private cancelPending(): void {
    this.confirmation = null
    this.renderCommands()
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
  private onPointerMove = (event: PointerEvent): void => {
    if (event.pointerType !== 'mouse' || (!event.movementX && !event.movementY) || !this.isTopmost()) return
    const target = event.target as HTMLElement
    if (!target.closest('[data-window-hover-selection]')) return
    const row = getClickedWindowRow(target)
    if (row && row !== this.selected && this.items().includes(row)) {
      this.setMode('keyboard')
      this.select(row, false)
    }
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

  private onAvatarReady = (): void => {
    this.renderDetails()
  }

  private onFieldChange = (): void => {
    this.footer.setAttribute('aria-label', t('windowCommands'))
    this.signature = ''
    this.scheduleRefresh()
  }

  private move(dx: number, dy: number): void {
    moveWindowSelection(
      {
        panel: this.panel,
        selected: this.selected,
        items: () => this.items(),
        select: (element, focus) => this.select(element, focus),
        scheduleRefresh: () => this.scheduleRefresh(),
      },
      dx,
      dy
    )
  }

  private switchPanel(direction: number): void {
    this.controls.switchPanel(direction)
  }

  private onKey = (event: KeyboardEvent): void => {
    if (
      document.querySelector('.virtual-keyboard') ||
      !this.isTopmost() ||
      event.defaultPrevented ||
      !this.controls.acceptsWindowKey(event)
    )
      return
    if (this.controls.toggleInventoryFromKey(event)) return
    this.refresh()
    const intent = readWindowKeyIntent(event, this.commands)
    if (isUnboundWindowKey(intent, event.key, Boolean(this.confirmation))) {
      if (event.key !== 'Tab') event.stopImmediatePropagation()
      return
    }
    if (
      !this.confirmation &&
      (!getWindowInteraction(this.panel) || this.footer.contains(document.activeElement)) &&
      isNativeButtonActivation(event, this.selected)
    ) {
      if (event.repeat && (document.activeElement as HTMLButtonElement)?.dataset.craftBatchLabel) event.preventDefault()
      event.stopImmediatePropagation()
      return
    }
    event.preventDefault()
    event.stopImmediatePropagation()
    if (this.confirmation) this.controls.answerConfirmation(getKeyConfirmationChoice(event))
    else this.controls.runKeyIntent(intent, event.repeat)
  }

  /** Rebinding prompts and text fields keep their keys; modifier chords never reach window commands. */

  private cancelKeyboardHold = (): void => {
    this.controls.keyboardHolding = null
  }

  private onKeyUp = (event: KeyboardEvent): void => {
    if (['x', 'shift'].includes(event.key.toLowerCase())) this.cancelKeyboardHold()
  }

  private getGamepad(): Gamepad | null {
    return getWindowGamepad(this.panel)
  }

  private poll = (now: number): void => {
    if (this.disposed) return
    const pad = this.getGamepad()
    if (pad && !this.hadGamepad) this.setMode('gamepad')
    this.hadGamepad = Boolean(pad)
    if (document.querySelector('.virtual-keyboard') || this.panel.querySelector('.is-listening')) {
      this.cancelKeyboardHold()
      this.controls.padState.reset()
      this.controls.holding = null
      this.frame = requestAnimationFrame(this.poll)
      return
    }
    if (pad && this.isTopmost()) {
      this.controls.readGamepad(pad, now)
    } else {
      this.controls.padState.reset()
      this.controls.holding = null
      if (!pad) this.setMode('keyboard')
    }
    this.controls.advanceKeyboardHold(now)
    this.footer.classList.toggle('is-holding', Boolean(this.controls.holding || this.controls.keyboardHolding))
    if (!this.disposed) this.frame = requestAnimationFrame(this.poll)
  }

  destroy(): void {
    unmarkWindowSelection(this.selected)
    const pad = this.getGamepad()
    if (pad) consumeGamepadButtons(pad)
    this.disposed = true
    cancelAnimationFrame(this.frame)
    this.observer.disconnect()
    this.panel.removeEventListener('click', this.onClick)
    this.panel.removeEventListener('focusin', this.onFocus)
    this.panel.removeEventListener('pointerdown', this.onPointer)
    this.panel.removeEventListener('pointermove', this.onPointerMove)
    this.panel.removeEventListener('input', this.onFieldChange)
    this.panel.removeEventListener('change', this.onFieldChange)
    this.panel.removeEventListener('windowinteractionchange', this.onFieldChange)
    this.panel.removeEventListener('equipmentavatarready', this.onAvatarReady)
    window.removeEventListener(LANG_CHANGE_EVENT, this.onFieldChange)
    document.removeEventListener('keydown', this.onKey, true)
    document.removeEventListener('keyup', this.onKeyUp, true)
    window.removeEventListener('blur', this.cancelKeyboardHold)
    this.cancelKeyboardHold()
    this.details.remove()
    this.footer.remove()
  }
}
