export const LPC_BASE_URL =
  'assets/graphics/lpc'

const TOOL_ROD_SOURCE_COLUMNS = 8
const TOOL_ROD_SOURCE_FRAMES = [0, 1, 2, 3, 4, 5, 4, 4, 4, 5, 4, 2, 3]
export const TOOL_ROD_FRAME_INDICES = [0, 1, 2, 3].flatMap(row =>
  TOOL_ROD_SOURCE_FRAMES.map(frame => row * TOOL_ROD_SOURCE_COLUMNS + frame)
)

const OVERSIZE_SLASH_COLUMNS = 6
