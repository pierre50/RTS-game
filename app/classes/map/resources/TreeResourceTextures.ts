export type TreeTextureFamily = 'Grass' | 'Desert' | 'Jungle' | 'DarkForest'

const TREE_TEXTURE_SHEETS: Record<TreeTextureFamily, string> = {
  Grass: 'resources/tree/grass',
  Desert: 'resources/tree/palm',
  Jungle: 'resources/tree/palm',
  DarkForest: 'resources/tree/dark-forest',
}

const TREE_TEXTURE_FRAMES = [0, 1, 2, 3]

function formatTextureName(sheet: string, frame: number): string {
  return `${String(frame).padStart(3, '0')}_${sheet}`
}

export function pickTreeTextureNameForFamily(
  family: TreeTextureFamily | null | undefined,
  randomItem: <T>(items: T[]) => T
): string | undefined {
  if (!family) return undefined
  const sheet = TREE_TEXTURE_SHEETS[family]
  if (!sheet) return undefined
  return formatTextureName(sheet, randomItem(TREE_TEXTURE_FRAMES))
}
