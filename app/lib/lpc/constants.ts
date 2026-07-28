export const LPC_BASE_URL =
  'assets/graphics/lpc'

export const LPC_PREVIEW_FLAG = 'lpc-villager-preview'

export const LPC_FRAME_ANCHOR = { x: 0.5, y: 0.86 }
export const LPC_128_FRAME_ANCHOR = { x: 0.5, y: 0.68 }
export const LPC_192_FRAME_ANCHOR = { x: 0.5, y: 0.62 }

const TOOL_ROD_SOURCE_COLUMNS = 8
const TOOL_ROD_SOURCE_FRAMES = [0, 1, 2, 3, 4, 5, 4, 4, 4, 5, 4, 2, 3]
export const TOOL_ROD_FRAME_INDICES = [0, 1, 2, 3].flatMap(row =>
  TOOL_ROD_SOURCE_FRAMES.map(frame => row * TOOL_ROD_SOURCE_COLUMNS + frame)
)

const OVERSIZE_SLASH_COLUMNS = 6
export const CLUB_HOLD_FRAME_INDICES = [0, 1, 2, 3].map(row => row * OVERSIZE_SLASH_COLUMNS + 5)

export function makeLpcUrl(path: string): string {
  return `${LPC_BASE_URL}/${path}`
}
