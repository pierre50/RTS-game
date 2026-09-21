/** Spatial navigation follows the rendered grid, including responsive column counts. */
export function findDirectionalTarget(
  rectangles: { x: number; y: number }[],
  current: number,
  dx: number,
  dy: number
): number {
  const origin = rectangles[current]
  if (!origin) return rectangles.length ? 0 : -1
  let best = current
  let distance = Infinity
  rectangles.forEach((point, index) => {
    const x = point.x - origin.x
    const y = point.y - origin.y
    const forward = x * dx + y * dy
    if (forward <= 1) return
    const sideways = Math.abs(x * dy - y * dx)
    const score = forward + sideways * 4
    if (score < distance) {
      distance = score
      best = index
    }
  })
  return best
}

/** Do not treat a button held while opening a window as a new UI action. */
export class GameWindowPadState {
  private previous: boolean[] | null = null
  private direction = ''
  private repeatAt = 0

  read(pad: Gamepad, now: number): { pressed: number[]; direction: [number, number] | null } {
    const buttons = pad.buttons.map(button => button.pressed)
    const pressed = this.previous
      ? buttons.flatMap((down, index) => (down && !this.previous?.[index] ? [index] : []))
      : []
    const dx = buttons[14] ? -1 : buttons[15] ? 1 : Math.abs(pad.axes[0] ?? 0) > 0.55 ? Math.sign(pad.axes[0]) : 0
    const dy = buttons[12] ? -1 : buttons[13] ? 1 : Math.abs(pad.axes[1] ?? 0) > 0.55 ? Math.sign(pad.axes[1]) : 0
    const direction: [number, number] =
      Math.abs(pad.axes[0] ?? 0) > Math.abs(pad.axes[1] ?? 0) && !buttons[12] && !buttons[13]
        ? [dx, 0]
        : dy
          ? [0, dy]
          : [dx, 0]
    const key = direction.join(',')
    const changed = key !== this.direction
    const move = Boolean(this.previous) && key !== '0,0' && (changed || now >= this.repeatAt)
    if (changed || move) this.repeatAt = now + (changed ? 350 : 120)
    this.direction = key
    this.previous = buttons
    return { pressed, direction: move ? direction : null }
  }

  reset(): void {
    this.previous = null
    this.direction = ''
  }
}
