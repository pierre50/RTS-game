export const GAMEPAD_DEADZONE = 0.2
export const GAMEPAD_CURSOR_SPEED = 18 // screen pixels per frame at full stick tilt

// Standard Gamepad API mapping (https://w3c.github.io/gamepad/#remapping) — matches
// 8BitDo controllers and other Xbox-layout pads once the browser reports mapping: "standard".
export const GAMEPAD_BUTTON = {
  action: 5, // R1 — attack/use tool
  interact: 2, // X / Square
  inventory: 3, // Y / Triangle
  toolPrev: 6, // L2 — cycle tool backward
  toolNext: 7, // R2 — cycle tool forward
  dpadUp: 12,
  dpadDown: 13,
  dpadLeft: 14,
  dpadRight: 15,
} as const

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
