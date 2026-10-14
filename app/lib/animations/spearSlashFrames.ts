// Keep in sync with SLASH_BODY_TIMELINE in scripts/lpc/build_spear_prototype.py.
// The body has six source poses; the spear bake has nine distinct source cells.
export const SPEAR_SLASH_BODY_FRAMES = [0, 1, 2, 2, 3, 3, 4, 4, 5]
export const SPEAR_SLASH_WEAPON_FRAMES = [0, 1, 2, 3, 4, 5, 6, 7, 8]

export function isSpearSlashBodySequence(sequence: readonly number[] | null): boolean {
  return sequence?.length === SPEAR_SLASH_BODY_FRAMES.length &&
    SPEAR_SLASH_BODY_FRAMES.every((frame, index) => sequence[index] === frame)
}
