const GAMEPAD_DEADZONE = 0.2
export const GAMEPAD_CURSOR_SPEED = 18 // screen pixels per frame at full stick tilt

export const GAMEPAD_AXIS = {
  moveX: 0,
  moveY: 1,
  aimX: 2,
  aimY: 3,
} as const

export function getActiveGamepad(): Gamepad | null {
  if (typeof navigator === 'undefined' || !navigator.getGamepads) return null
  for (const pad of navigator.getGamepads()) {
    if (pad?.connected) return pad
  }
  return null
}

/**
 * Reads a thumbstick with a radial deadzone, rescaling the remaining travel to [0, 1]
 * so movement doesn't jump straight to full speed the instant the stick leaves the deadzone.
 */
export function readStick(
  gamepad: Gamepad,
  xAxis: number,
  yAxis: number,
  deadzone = GAMEPAD_DEADZONE
): { x: number; y: number } {
  const rawX = gamepad.axes[xAxis] ?? 0
  const rawY = gamepad.axes[yAxis] ?? 0
  const magnitude = Math.hypot(rawX, rawY)
  if (magnitude < deadzone) return { x: 0, y: 0 }
  const scale = Math.min(1, (magnitude - deadzone) / (1 - deadzone)) / magnitude
  return { x: rawX * scale, y: rawY * scale }
}
