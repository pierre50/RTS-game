import { getLang } from '../lang'

const LAYOUT_KEY = 'virtual_keyboard_layout'
export type VirtualKeyboardLayout = 'auto' | 'azerty' | 'qwerty'

export function getVirtualKeyboardLayout(): VirtualKeyboardLayout {
  const saved = localStorage.getItem(LAYOUT_KEY)
  return saved === 'azerty' || saved === 'qwerty' ? saved : 'auto'
}

export function setVirtualKeyboardLayout(value: string): void {
  if (value === 'auto') localStorage.removeItem(LAYOUT_KEY)
  else if (value === 'azerty' || value === 'qwerty') localStorage.setItem(LAYOUT_KEY, value)
}

export function usesAzertyVirtualKeyboard(): boolean {
  const layout = getVirtualKeyboardLayout()
  return layout === 'auto' ? getLang() === 'fr' : layout === 'azerty'
}
