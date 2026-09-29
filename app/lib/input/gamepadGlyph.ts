/** The same compact controller symbols are used in menus and world prompts. */
const GLYPHS = ['A', 'B', 'X', 'Y', 'LB', 'RB', 'LT', 'RT', 'View', 'Menu', 'L3', 'R3', '↑', '↓', '←', '→', 'Home']

export function getGamepadGlyph(index: number): string {
  return GLYPHS[index] ?? String(index)
}

export function createGamepadKey(index: number): HTMLElement {
  const key = document.createElement('kbd')
  key.className = 'gamepad-key'
  key.dataset.pad = String(index)
  key.textContent = getGamepadGlyph(index)
  return key
}
