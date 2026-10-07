import Keyboard from 'simple-keyboard'
import { getActiveGamepad } from '../input/gamepad'
import { consumeGamepadButtons } from '../input/gamepadConsumption'
import { getGamepadEnabled } from '../audio/settings'
import { getLang, t } from '../lang'
import { getGamepadGlyph } from '../input/gamepadGlyph'
import { renderCommandFooter } from './GameWindowFooter'
import type { Command } from './GameWindowCommands'
import { usesAzertyVirtualKeyboard } from '../input/virtualKeyboardSettings'
import { getWindowGamepad } from './GameWindowInput'
import { findDirectionalTarget, GameWindowPadState } from './GameWindowNavigation'
import { editVirtualKeyboardText } from './VirtualKeyboardText'

type TextField = HTMLInputElement | HTMLTextAreaElement
const TEXT_TYPES = new Set(['text', 'search', 'email', 'url', 'tel', 'password', 'number'])

function textField(target: EventTarget | null): TextField | null {
  if (target instanceof HTMLTextAreaElement || (target instanceof HTMLInputElement && TEXT_TYPES.has(target.type)))
    return target.disabled || target.readOnly ? null : target
  return null
}

/** One keyboard for all screens; the original field remains the owner of its value and events. */
export class VirtualKeyboard {
  private root: HTMLDivElement | null = null
  private keyboard: Keyboard | null = null
  private field: TextField | null = null
  private preview: HTMLOutputElement | null = null
  private selected = 0
  private shifted = false
  private symbols = false
  private resizeObserver: ResizeObserver | null = null
  private modal: HTMLElement | null = null
  private french = getLang() === 'fr'
  private padState = new GameWindowPadState()
  private gamepadMode = false
  private openingValue = ''
  private numericDraft: string | null = null

  constructor() {
    document.addEventListener('focusin', this.onFocus)
    document.addEventListener('virtualkeyboardrequest', event => this.open(textField(event.target)))
    document.addEventListener(
      'pointerdown',
      event => {
        if (this.root?.contains(event.target as Node)) return
        this.gamepadMode = false
        this.close()
      },
      true
    )
    document.addEventListener('keydown', this.onKey, true)
    window.addEventListener('blur', () => this.close())
    requestAnimationFrame(this.poll)
  }

  private onFocus = (event: FocusEvent): void => {
    if (this.root?.contains(event.target as Node)) return
    const field = textField(event.target)
    if (this.field && field !== this.field) this.close()
    // Focus follows menu navigation; only an explicit A press opens the keyboard.
  }

  private open(field: TextField | null): void {
    if (!field || this.field === field) return
    const panel = field.closest<HTMLElement>('.game-window')
    const pad = panel ? getWindowGamepad(panel) : getGamepadEnabled() ? getActiveGamepad() : null
    if (!pad || (!this.gamepadMode && panel?.dataset.inputMode !== 'gamepad')) return
    this.close()
    this.field = field
    this.openingValue = field.value
    this.numericDraft = field instanceof HTMLInputElement && field.type === 'number' ? field.value : null
    this.shifted = false
    this.symbols = false
    this.selected = 0
    this.french = getLang() === 'fr'
    const root = document.createElement('div')
    root.className = 'virtual-keyboard'
    root.setAttribute('role', 'dialog')
    root.setAttribute('aria-label', this.french ? 'Clavier virtuel' : 'On-screen keyboard')
    const title = document.createElement('div')
    title.className = 'modal-title virtual-keyboard-title'
    title.textContent =
      field.labels?.[0]?.textContent ||
      field.getAttribute('aria-label') ||
      field.placeholder ||
      (this.french ? 'Saisie' : 'Text input')
    this.preview = document.createElement('output')
    this.preview.className = 'virtual-keyboard-preview'
    const keys = document.createElement('div')
    keys.className = 'virtual-keyboard-keys'
    const header = document.createElement('div')
    header.className = 'virtual-keyboard-header'
    header.append(title, this.preview)
    root.append(header, keys, this.createFooter())
    root.addEventListener('pointerdown', event => event.preventDefault())
    document.body.append(root)
    this.root = root
    this.keyboard = new Keyboard(keys, {
      layout: { default: this.layout() },
      display: {
        '{bksp}': '⌫',
        '{shift}': '⇧',
        '{symbols}': '123 / #+=',
        '{letters}': 'ABC',
        '{space}': this.french ? 'Espace' : 'Space',
        '{enter}': this.french ? 'Terminer' : 'Done',
        '{newline}': '↵',
      },
      preventMouseDownDefault: true,
      onKeyPress: key => this.press(key),
    })
    this.modal = field.closest<HTMLElement>('.modal')
    if (this.modal) {
      this.modal.classList.add('virtual-keyboard-host')
      this.resizeObserver = new ResizeObserver(() => {
        this.modal?.style.setProperty('--virtual-keyboard-height', `${root.getBoundingClientRect().height}px`)
        field.scrollIntoView({ block: 'nearest', inline: 'nearest' })
      })
      this.resizeObserver.observe(root)
    }
    this.padState.reset()
    this.padState.read(pad, performance.now())
    consumeGamepadButtons(pad)
    this.updatePreview()
    this.highlight()
  }

  private createFooter(): HTMLElement {
    const footer = document.createElement('footer')
    footer.className = 'game-window-footer virtual-keyboard-footer'
    footer.setAttribute('aria-label', t('windowCommands'))
    const commands: Command[] = [
      {
        id: 'type',
        pad: 0,
        key: 'Enter',
        label: this.french ? 'Saisir' : 'Type',
        run: () => {
          const key = this.buttons()[this.selected]?.dataset.skbtn
          if (key) this.press(key)
        },
      },
      {
        id: 'delete',
        pad: 2,
        key: 'Backspace',
        label: this.french ? 'Effacer' : 'Delete',
        run: () => this.press('{bksp}'),
      },
      { id: 'close', pad: 1, key: 'Escape', label: this.french ? 'Fermer' : 'Close', run: () => this.close() },
    ].map(command => ({ ...command, glyph: getGamepadGlyph(command.pad) }))
    renderCommandFooter({
      footer,
      mode: 'gamepad',
      confirmation: null,
      commands,
      restoreSelectionFocus: () => this.field?.focus({ preventScroll: true }),
      execute: command => command.run(),
      resolveCommand: command => commands.find(item => item.id === command.id),
    })
    footer.querySelectorAll('kbd').forEach(key => key.classList.add('gamepad-key'))
    return footer
  }

  private layout(): string[] {
    if (this.field instanceof HTMLInputElement && (this.field.type === 'number' || this.field.inputMode === 'numeric'))
      return ['1 2 3 {bksp}', '4 5 6 -', '7 8 9 .', '0 {enter}']
    if (this.symbols)
      return ['1 2 3 4 5 6 7 8 9 0', "@ # + = / - _ . , '", 'é è ê à ç ù ! ? ( )', '{letters} {space} {bksp} {enter}']
    const rows = usesAzertyVirtualKeyboard()
      ? ['a z e r t y u i o p', 'q s d f g h j k l m', 'w x c v b n']
      : ['q w e r t y u i o p', 'a s d f g h j k l', 'z x c v b n m']
    return [
      ...rows.map(row => (this.shifted ? row.toUpperCase() : row)),
      `{shift} {symbols} {space} {bksp} ${this.field instanceof HTMLTextAreaElement ? '{newline} ' : ''}{enter}`,
    ]
  }

  private press(key: string): void {
    const field = this.field
    if (!field) return
    if (key === '{enter}') return this.close()
    if (['{shift}', '{symbols}', '{letters}'].includes(key)) {
      if (key === '{shift}') this.shifted = !this.shifted
      else this.symbols = key === '{symbols}'
      this.keyboard?.setOptions({ layout: { default: this.layout() } })
      this.highlight()
      return
    }
    const edit = editVirtualKeyboardText(
      this.numericDraft ?? field.value,
      field.selectionStart,
      field.selectionEnd,
      key,
      field.maxLength
    )
    if (this.numericDraft !== null) {
      if (!/^-?\d*\.?\d*$/.test(edit.value)) return
      this.numericDraft = edit.value
      this.updatePreview()
      if (edit.value !== '' && (!Number.isFinite(Number(edit.value)) || edit.value.endsWith('.'))) return
    }
    field.value = edit.value
    if (field.selectionStart !== null) field.setSelectionRange(edit.caret, edit.caret)
    field.dispatchEvent(new Event('input', { bubbles: true }))
    this.updatePreview()
  }

  private updatePreview(): void {
    if (this.preview && this.field)
      this.preview.textContent =
        this.field instanceof HTMLInputElement && this.field.type === 'password'
          ? '•'.repeat(this.field.value.length)
          : (this.numericDraft ?? this.field.value) || ' '
  }

  private buttons(): HTMLElement[] {
    return [...(this.root?.querySelectorAll<HTMLElement>('.hg-button') ?? [])]
  }

  private highlight(): void {
    const buttons = this.buttons()
    this.selected = Math.min(this.selected, buttons.length - 1)
    buttons.forEach((button, index) => button.classList.toggle('is-selected', index === this.selected))
  }

  private onKey = (event: KeyboardEvent): void => {
    this.gamepadMode = false
    if (!this.root) return
    event.stopImmediatePropagation()
    if (event.key === 'Escape' || (event.key === 'Enter' && !(this.field instanceof HTMLTextAreaElement))) {
      event.preventDefault()
      this.close()
    } else if (event.key === 'Tab') this.close()
    else
      queueMicrotask(() => {
        if (this.numericDraft !== null && this.field) this.numericDraft = this.field.value
        this.updatePreview()
      })
  }

  private close(): void {
    if (!this.root) return
    const field = this.field
    const changed = field?.value !== this.openingValue
    const pad = getActiveGamepad()
    if (pad) consumeGamepadButtons(pad)
    if (field?.isConnected) field.focus({ preventScroll: true })
    this.resizeObserver?.disconnect()
    this.resizeObserver = null
    this.modal?.classList.remove('virtual-keyboard-host')
    this.modal?.style.removeProperty('--virtual-keyboard-height')
    this.modal = null
    this.keyboard?.destroy()
    this.root.remove()
    this.root = null
    this.keyboard = null
    this.preview = null
    this.field = null
    this.numericDraft = null
    if (field?.isConnected && changed) field.dispatchEvent(new Event('change', { bubbles: true }))
  }

  private poll = (now: number): void => {
    const field = this.field ?? textField(document.activeElement)
    const panel = field?.closest<HTMLElement>('.game-window')
    const pad = panel ? getWindowGamepad(panel) : getGamepadEnabled() ? getActiveGamepad() : null
    if (!pad || document.visibilityState === 'hidden') {
      this.close()
      this.padState.reset()
    } else {
      const { pressed, direction } = this.padState.read(pad, now)
      if (pressed.length || direction) this.gamepadMode = true
      if (this.root) {
        if (
          !this.field?.isConnected ||
          !this.field.getClientRects().length ||
          this.field.disabled ||
          this.field.readOnly
        )
          this.close()
        else {
          consumeGamepadButtons(pad)
          if (pressed.includes(1) || pressed.includes(9)) this.close()
          else {
            const buttons = this.buttons()
            if (direction) {
              this.selected = findDirectionalTarget(
                buttons.map(button => {
                  const rect = button.getBoundingClientRect()
                  return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 }
                }),
                this.selected,
                ...direction
              )
              this.highlight()
            }
            if (pressed.includes(2)) this.press('{bksp}')
            else if (pressed.includes(0)) {
              const key = buttons[this.selected]?.dataset.skbtn
              if (key) this.press(key)
            }
          }
        }
      } else if (pressed.includes(0) && field) this.open(field)
    }
    requestAnimationFrame(this.poll)
  }
}
