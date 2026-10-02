import {
  CONTROL_BINDING_GROUPS,
  GAMEPAD_BINDING_GROUPS,
  getControlKeyLabel,
  getKeyBindings,
  getGamepadBindings,
  getGamepadEnabled,
  setGamepadEnabled,
  resetKeyBindings,
  resetGamepadBindings,
  getGamepadBindingChange,
  rebindGamepadButton,
  getKeyboardBindingChange,
  rebindKeyboardKey,
  type GamepadBindingAction,
} from '../../lib/audio/settings'
import { getActiveGamepad } from '../../lib/input/gamepad'
import { createGamepadKey } from '../../lib/input/gamepadGlyph'
import { t } from '../../lib/lang'
import { ModalTabs } from '../Tabs'
import { buildCheckboxRow } from '../utils/formUtils'
import { buildBindingRows } from './controlsBindings'

function section(parent: HTMLElement, title: string, open = false): HTMLElement {
  const wrapper = document.createElement('section')
  wrapper.className = 'settings-controls-group settings-controls-section'
  const heading = document.createElement('h3')
  const toggle = document.createElement('button')
  toggle.type = 'button'
  toggle.className = 'settings-section-toggle'
  const body = document.createElement('div')
  body.className = 'settings-section-body'
  const render = () => {
    toggle.textContent = `${open ? '▾' : '▸'} ${title}`
    toggle.setAttribute('aria-expanded', String(open))
    body.hidden = !open
  }
  toggle.addEventListener('click', () => {
    open = !open
    render()
  })
  render()
  heading.appendChild(toggle)
  wrapper.append(heading, body)
  parent.appendChild(wrapper)
  return body
}

function help(parent: HTMLElement, key: string): void {
  const text = document.createElement('p')
  text.className = 'settings-controls-help'
  text.textContent = t(key)
  parent.appendChild(text)
}

export function buildControlsPage(panel: HTMLDivElement): () => void {
  let deviceChosen = false
  const keyboard = document.createElement('div')
  const gamepad = document.createElement('div')
  keyboard.className = gamepad.className = 'settings-device-page'
  const refreshers: (() => void)[] = []
  const refreshAll = () => refreshers.forEach(refresh => refresh())
  help(keyboard, 'controlsKeyboardHelp')
  for (const group of CONTROL_BINDING_GROUPS) {
    const body = section(keyboard, t(group.key), group.key === 'controlsGroupHero')
    refreshers.push(
      buildBindingRows(body, {
        actions: group.actions,
        display: action => document.createTextNode(getControlKeyLabel(getKeyBindings()[action])),
        hasConflict: action =>
          getKeyboardBindingChange(action, { key: getKeyBindings()[action], code: '' } as KeyboardEvent).conflicts
            .length > 0,
        keyboard: (action, event) => {
          const change = getKeyboardBindingChange(action, event)
          return {
            conflicts: change.conflicts,
            canSwap: Boolean(change.swapped),
            apply: () => rebindKeyboardKey(action, event),
          }
        },
        reset: () => {
          resetKeyBindings(group.actions)
        },
        refreshAll,
      })
    )
  }
  const keyboardHelp = section(keyboard, t('controlsFixedCommands'))
  help(keyboardHelp, 'controlsKeyboardFixed')
  gamepad.appendChild(buildCheckboxRow(t('gamepadEnabled'), getGamepadEnabled(), setGamepadEnabled))
  help(gamepad, 'controlsGamepadHelp')
  const movement: GamepadBindingAction[] = ['heroUp', 'heroDown', 'heroLeft', 'heroRight']
  const groups = [
    { key: 'controlsInGame', actions: GAMEPAD_BINDING_GROUPS[0].actions.filter(action => !movement.includes(action)) },
    { key: 'controlsConstruction', actions: GAMEPAD_BINDING_GROUPS[1].actions },
    { key: 'controlsInventoryMenus', actions: GAMEPAD_BINDING_GROUPS[2].actions },
    { key: 'controlsAdvanced', actions: movement },
  ]
  for (const group of groups) {
    const body = section(gamepad, t(group.key), group.key === 'controlsInGame')
    if (group.key === 'controlsInGame') help(body, 'controlsSticksHelp')
    if (group.key === 'controlsInventoryMenus') help(body, 'controlsMenuFixed')
    if (group.key === 'controlsAdvanced') help(body, 'controlsAdvancedHelp')
    refreshers.push(
      buildBindingRows(body, {
        actions: group.actions,
        display: action => createGamepadKey(Number(getGamepadBindings()[action].replace('Button', ''))),
        hasConflict: action =>
          getGamepadBindingChange(action, Number(getGamepadBindings()[action].replace('Button', ''))).conflicts.length >
          0,
        gamepad: (action, index) => {
          const change = getGamepadBindingChange(action, index)
          return {
            conflicts: change.conflicts,
            canSwap: Boolean(change.swapped),
            apply: () => rebindGamepadButton(action, index),
          }
        },
        reset: () => {
          resetGamepadBindings(group.actions)
        },
        refreshAll,
      })
    )
  }
  const tabs = new ModalTabs(
    [
      { id: 'keyboard', label: t('controlsKeyboardMouse'), page: keyboard },
      { id: 'gamepad', label: t('controlsGroupGamepad'), page: gamepad },
    ],
    getGamepadEnabled() && getActiveGamepad() ? 'gamepad' : 'keyboard',
    () => {
      deviceChosen = true
    }
  )
  tabs.tabs.element.setAttribute('aria-label', t('settingsTabControls'))
  const scope = document.createElement('div')
  scope.className = 'settings-device-tabs'
  scope.append(tabs.tabs.element, tabs.element)
  panel.appendChild(scope)
  return () => {
    if (!deviceChosen)
      tabs.setActive(getGamepadEnabled() && getActiveGamepad() ? 'gamepad' : 'keyboard', { emit: false })
  }
}
