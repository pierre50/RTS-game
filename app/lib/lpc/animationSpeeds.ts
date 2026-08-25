const LPC_RUNTIME_ANIMATION_SPEED = 0.3
const LPC_SLASH_ANIMATION_SPEED = 0.25
const LPC_CORPSE_ANIMATION_SPEED = 0
const PIXI_ANIMATION_FPS = 60

function animationFrameMs(animationSpeed: number): number {
  return Math.round(1000 / (PIXI_ANIMATION_FPS * animationSpeed))
}

export function lpcSlashFrameMs(): number {
  return animationFrameMs(LPC_SLASH_ANIMATION_SPEED)
}

export function lpcAnimationSpeedForAlias(alias: string): number {
  if (alias.endsWith('/corpse')) return LPC_CORPSE_ANIMATION_SPEED
  if (alias.endsWith('/slash')) return LPC_SLASH_ANIMATION_SPEED
  return LPC_RUNTIME_ANIMATION_SPEED
}

export function lpcAnimationSpeedForSheet(sheet: string, { slashAction = true }: { slashAction?: boolean } = {}): number {
  if (sheet === 'corpse' || sheet === 'corpseSheet') return LPC_CORPSE_ANIMATION_SPEED
  if (sheet === 'harvest' || sheet === 'harvestSheet') return LPC_SLASH_ANIMATION_SPEED
  if ((sheet === 'action' || sheet === 'actionSheet') && slashAction) return LPC_SLASH_ANIMATION_SPEED
  return LPC_RUNTIME_ANIMATION_SPEED
}
