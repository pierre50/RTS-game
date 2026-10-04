/** Compact, immutable road state. Kept independently of streamed/materialized cells. */
export type RoadLayer = { version: 1; stride: number; cells: Array<[number, number]> }

export function readRoadLayer(value: unknown, stride: number): RoadLayer | undefined {
  if (value === undefined) return undefined
  const data = value as Partial<RoadLayer> | null
  if (!data || data.version !== 1 || data.stride !== stride || !Array.isArray(data.cells))
    throw new Error('Invalid road layer dimensions or version')
  const seen = new Set<number>()
  for (const record of data.cells) {
    if (!Array.isArray(record) || record.length !== 2) throw new Error('Invalid road cell')
    const [id, mask] = record
    if (
      !Number.isInteger(id) ||
      id < 0 ||
      id >= stride * stride ||
      seen.has(id) ||
      !Number.isInteger(mask) ||
      mask < 1 ||
      mask > 15
    )
      throw new Error('Invalid road cell index or connections')
    seen.add(id)
  }
  const cells = data.cells.map(([id, mask]): [number, number] => [id, mask])
  const connections = new Map(cells)
  for (const [id, mask] of cells) {
    const i = Math.floor(id / stride),
      j = id % stride
    ;[
      [0, -1],
      [1, 0],
      [0, 1],
      [-1, 0],
    ].forEach(([di, dj], bit) => {
      if (!(mask & (1 << bit))) return
      const a = i + di,
        b = j + dj
      if (
        a < 0 ||
        b < 0 ||
        a >= stride ||
        b >= stride ||
        !((connections.get(a * stride + b) ?? 0) & (1 << (bit + 2) % 4))
      )
        throw new Error('Disconnected road edge')
    })
  }
  return { version: 1, stride, cells }
}

// Row mapping supplied by paths-atlas.json; 11/19 and 12/20 share silhouettes.
const ROWS = [0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 3, 4, 11, 12, 13, 14]
export function roadAtlasFrame(terrainFrame: number | string, connections: number): number {
  const row = ROWS[Number(terrainFrame)]
  if (row === undefined) throw new Error(`Unsupported road terrain frame: ${terrainFrame}`)
  return row * 16 + connections
}
