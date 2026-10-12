// UI and gameplay poll independently. Keep closing presses consumed across both loops.
// A button is released from the set only when read while up: pollers must read every frame,
// not only on a new press (a press reads it while still down and stays consumed).
const consumedButtons = new Map<number, Set<number>>()

export function consumeGamepadButtons(pad: Gamepad): void {
  consumedButtons.set(pad.index, new Set(pad.buttons.flatMap((button, index) => (button.pressed ? [index] : []))))
}

export function getConsumedGamepadButtons(pad: Gamepad): ReadonlySet<number> {
  const consumed = consumedButtons.get(pad.index) ?? new Set<number>()
  for (const index of consumed) {
    if (!pad.buttons[index]?.pressed) consumed.delete(index)
  }
  if (!consumed.size) consumedButtons.delete(pad.index)
  return consumed
}
