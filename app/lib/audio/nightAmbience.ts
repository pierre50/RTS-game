const NIGHT_AMBIENCE_MAX_VOLUME = 0.28
export const NIGHT_AMBIENCE_LERP_PER_SECOND = 1.35

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

export function getNightAmbienceTargetVolume(darkness: number | null | undefined): number {
  const intensity = clamp(Number.isFinite(darkness) ? Number(darkness) : 0, 0, 1)
  return Math.pow(intensity, 1.2) * NIGHT_AMBIENCE_MAX_VOLUME
}
