import type { PlayerLike } from '../../types/player'

export function withMinimapPlayerVision<T>(player: PlayerLike | null | undefined, spaceId: string, callback: () => T): T {
  return player?.views?.withSpace?.(spaceId, callback) ?? callback()
}
