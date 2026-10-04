import { t } from '../../lib/lang'
import { Modal } from '../../lib/ui/Modal'

type Change = { conflicts: string[]; canSwap: boolean; apply(): boolean }
export type BindingEditor<A extends string> = {
  actions: readonly A[]
  display(action: A): Node
  hasConflict(action: A): boolean
  keyboard?(action: A, event: KeyboardEvent): Change
  gamepad?(action: A, index: number): Change
  refreshAll(): void
}

export function buildBindingRows<A extends string>(parent: HTMLElement, editor: BindingEditor<A>): () => void {
  const buttons = new Map<A, HTMLButtonElement>()
  let listening: HTMLButtonElement | null = null
  let frame = 0
  const refresh = () => {
    for (const [action, button] of buttons) {
      if (button === listening) continue
      const display = editor.display(action)
      button.replaceChildren(display)
      button.setAttribute(
        'aria-label',
        `${t('controlsChangeBinding', { action: t(`controlAction_${action}`) })} : ${display.textContent ?? ''}`
      )
      const conflict = editor.hasConflict(action)
      button.classList.toggle('is-conflict', conflict)
      button.title = conflict ? t('controlsConflict') : ''
    }
  }
  const stop = () => {
    listening?.classList.remove('is-listening')
    listening = null
    cancelAnimationFrame(frame)
    refresh()
  }
  const apply = (change: Change, button: HTMLButtonElement) => {
    stop()
    if (!change.conflicts.length) {
      change.apply()
      editor.refreshAll()
      return
    }
    const content = document.createElement('div')
    content.className = 'settings-binding-dialog'
    const message = document.createElement('p')
    message.textContent = t(change.canSwap ? 'controlsSwapPrompt' : 'controlsSwapUnavailable', {
      actions: change.conflicts.map(action => t(`controlAction_${action}`)).join(', '),
    })
    content.appendChild(message)
    const close = () => {
      editor.refreshAll()
      button.focus()
    }
    const modal = new Modal({ title: t('controlsConflictTitle'), content, onClose: close })
    if (change.canSwap) {
      const swap = document.createElement('button')
      swap.type = 'button'
      swap.className = 'ui-btn'
      swap.textContent = t('controlsSwap')
      swap.addEventListener('click', () => {
        change.apply()
        modal.close()
        close()
      })
      content.appendChild(swap)
    }
    const cancel = document.createElement('button')
    cancel.type = 'button'
    cancel.className = 'ui-btn'
    cancel.textContent = t('cancel')
    cancel.addEventListener('click', () => modal._dismiss())
    content.appendChild(cancel)
  }
  for (const action of editor.actions) {
    const row = document.createElement('div')
    row.className = 'config-row settings-key-row'
    const label = document.createElement('span')
    label.className = 'settings-binding-label'
    label.textContent = t(`controlAction_${action}`)
    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'settings-key-button ui-btn'
    button.dataset.bindingAction = action
    button.dataset.windowLabel = t(`controlAction_${action}`)
    button.setAttribute('aria-label', t('controlsChangeBinding', { action: label.textContent }))
    button.addEventListener('click', () => {
      stop()
      button.focus()
      listening = button
      button.classList.add('is-listening')
      button.textContent = t(editor.gamepad ? 'controlsPressButton' : 'controlsPressKey')
      if (!editor.gamepad) return
      let released = false
      const poll = () => {
        if (listening !== button) return
        if (!button.isConnected || button.closest('[hidden], .hidden, [aria-hidden="true"]')) {
          stop()
          return
        }
        const pads = Array.from(navigator.getGamepads?.() ?? []).filter(pad => pad?.connected)
        if (!released) released = !pads.some(pad => pad?.buttons.some(value => value.pressed))
        else {
          for (const pad of pads) {
            const index = pad?.buttons.findIndex(value => value.pressed) ?? -1
            if (index >= 0) {
              apply(editor.gamepad!(action, index), button)
              return
            }
          }
        }
        frame = requestAnimationFrame(poll)
      }
      poll()
    })
    button.addEventListener(
      'keydown',
      event => {
        if (listening !== button) return
        event.preventDefault()
        event.stopPropagation()
        if (event.key === 'Escape') stop()
        else if (editor.keyboard) apply(editor.keyboard(action, event), button)
      },
      true
    )
    button.addEventListener('blur', () => {
      if (listening === button) stop()
    })
    buttons.set(action, button)
    row.append(label, button)
    parent.appendChild(row)
  }
  refresh()
  return refresh
}
