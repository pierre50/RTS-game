import type { CompactVisionGrid } from '../types/vision'

export const VISION_CHUNK_SIZE = 64
const BYTES = VISION_CHUNK_SIZE ** 2 / 8

function invalid(): never {
  throw new Error('Invalid save file: compact exploration is invalid.')
}

/** Validates without expanding the save into a grid of cell objects. */
export function readCompactVision(
  value: unknown,
  stride: number
): {
  chunks: { i: number; j: number; bytes: Uint8Array }[]
  visible: CompactVisionGrid['visible']
} {
  if (!value || typeof value !== 'object') invalid()
  const data = value as CompactVisionGrid
  if (
    data.version !== 1 ||
    data.stride !== stride ||
    data.chunkSize !== VISION_CHUNK_SIZE ||
    !Array.isArray(data.explored) ||
    !Array.isArray(data.visible)
  )
    invalid()
  const count = Math.ceil(stride / VISION_CHUNK_SIZE)
  if (data.explored.length > count ** 2 || data.visible.length > stride ** 2) invalid()
  const seen = new Set<string>()
  const chunks = data.explored.map(chunk => {
    if (
      !chunk ||
      !Number.isInteger(chunk.i) ||
      !Number.isInteger(chunk.j) ||
      chunk.i < 0 ||
      chunk.j < 0 ||
      chunk.i >= count ||
      chunk.j >= count ||
      typeof chunk.bits !== 'string' ||
      chunk.bits.length !== 684 ||
      !/^[A-Za-z0-9+/]{683}=$/.test(chunk.bits)
    )
      invalid()
    const key = `${chunk.i}:${chunk.j}`
    if (seen.has(key)) invalid()
    seen.add(key)
    const binary = atob(chunk.bits)
    if (binary.length !== BYTES) invalid()
    const bytes = Uint8Array.from(binary, c => c.charCodeAt(0))
    if ((chunk.i + 1) * VISION_CHUNK_SIZE > stride || (chunk.j + 1) * VISION_CHUNK_SIZE > stride) {
      for (let bit = 0; bit < VISION_CHUNK_SIZE ** 2; bit++) {
        if (!(bytes[bit >> 3] & (1 << (bit & 7)))) continue
        if (
          chunk.i * VISION_CHUNK_SIZE + Math.floor(bit / VISION_CHUNK_SIZE) >= stride ||
          chunk.j * VISION_CHUNK_SIZE + (bit % VISION_CHUNK_SIZE) >= stride
        )
          invalid()
      }
    }
    return { i: chunk.i, j: chunk.j, bytes }
  })
  const visible = new Set<number>()
  for (const entry of data.visible) {
    if (
      !entry ||
      !Number.isInteger(entry.index) ||
      entry.index < 0 ||
      entry.index >= stride ** 2 ||
      visible.has(entry.index) ||
      !Array.isArray(entry.viewBy) ||
      entry.viewBy.length > 65535 ||
      entry.viewBy.some(label => typeof label !== 'string' || !label) ||
      new Set(entry.viewBy).size !== entry.viewBy.length
    )
      invalid()
    visible.add(entry.index)
  }
  return { chunks, visible: data.visible }
}

/** Changes are recorded at discovery time; saves only encode changed 64 × 64 chunks. */
export class ExplorationSaveChunks {
  private chunks = new Map<string, { i: number; j: number; bytes: Uint8Array; encoded?: string }>()

  set(i: number, j: number, viewed: boolean): void {
    const ci = Math.floor(i / VISION_CHUNK_SIZE)
    const cj = Math.floor(j / VISION_CHUNK_SIZE)
    const key = `${ci}:${cj}`
    let chunk = this.chunks.get(key)
    if (!chunk) {
      if (!viewed) return
      chunk = { i: ci, j: cj, bytes: new Uint8Array(BYTES) }
      this.chunks.set(key, chunk)
    }
    const bit = (i % VISION_CHUNK_SIZE) * VISION_CHUNK_SIZE + (j % VISION_CHUNK_SIZE)
    const mask = 1 << (bit & 7)
    if (Boolean(chunk.bytes[bit >> 3] & mask) === viewed) return
    if (viewed) chunk.bytes[bit >> 3] |= mask
    else chunk.bytes[bit >> 3] &= ~mask
    chunk.encoded = undefined
    if (!viewed && !chunk.bytes.some(Boolean)) this.chunks.delete(key)
  }

  revealAll(stride: number): void {
    this.chunks.clear()
    for (let i = 0; i < Math.ceil(stride / VISION_CHUNK_SIZE); i++) {
      for (let j = 0; j < Math.ceil(stride / VISION_CHUNK_SIZE); j++) {
        const bytes = new Uint8Array(BYTES)
        if ((i + 1) * VISION_CHUNK_SIZE <= stride && (j + 1) * VISION_CHUNK_SIZE <= stride) bytes.fill(255)
        else
          for (let x = 0; x < Math.min(VISION_CHUNK_SIZE, stride - i * VISION_CHUNK_SIZE); x++) {
            for (let y = 0; y < Math.min(VISION_CHUNK_SIZE, stride - j * VISION_CHUNK_SIZE); y++) {
              const bit = x * VISION_CHUNK_SIZE + y
              bytes[bit >> 3] |= 1 << (bit & 7)
            }
          }
        this.chunks.set(`${i}:${j}`, { i, j, bytes })
      }
    }
  }

  clear(): void {
    this.chunks.clear()
  }

  snapshot(): CompactVisionGrid['explored'] {
    return [...this.chunks.values()].map(chunk => {
      chunk.encoded ??= btoa(String.fromCharCode(...chunk.bytes))
      return { i: chunk.i, j: chunk.j, bits: chunk.encoded }
    })
  }
}
