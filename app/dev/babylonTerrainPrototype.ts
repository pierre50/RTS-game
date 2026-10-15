import * as BABYLON from '@babylonjs/core'
import { TERRAIN_TYPES } from '../constants/blueprintTerrain'
import { getEnvironmentTerrainParams } from '../constants/environments'
import { createDeterministicCellVariantPicker } from '../lib/random'
import { decodePreparedTerrain } from '../serialization/blueprint/PreparedTerrainCodec'
import { createModelLayer } from './babylonModelLayer'
import { createModelGroundDetails } from './babylonModelGroundDetails'
import { createTerrainBuddy, type TerrainBuddy } from './buddyTerrainHero'
import { createTerrainBuddySprite } from './buddyTerrainSprite'
import { installBuddyPixelation } from './buddyPixelation'
import { createResourceLayer, type BlueprintResource, type ResourcesConfig } from './babylonResourceLayer'
import { createSheetLoader, decodeBase64, fetchJson, getFrameRect, type FrameRect, type Sheet } from './babylonSheets'

/**
 * Opt-in experiment (?babylon-terrain): render a pregenerated map blueprint's terrain in Babylon,
 * without entities or resources, to measure whether a 3D renderer copes with 1000+ maps.
 * The game's isometric diamond tiles are unwarped into square tiles so they map onto cells, and the
 * blueprint's prepared appearance (shore tiles, ground patch borders) is composed in the shader.
 */

const DEFAULT_MAP_PATH = 'maps/worlds/world-test-1000/maps/world-test-1000-r0-0.map'
const CHUNK_CELLS = 64
const TILE = 64
const ABSENT = 255
const WATER = TERRAIN_TYPES.indexOf('Water')
const LEGACY_WATER = 6
// Heights are stored in relief levels and scaled in the vertex shader so the relief can be tuned live.
// 0.41 world units per level would match the game's CELL_DEPTH (16px) under the 30° ortho camera; the default exaggerates it.
const WATER_LEVEL = -0.6
const DEFAULT_HEIGHT_SCALE = 1.2
// Iso default relief: the 2D game's CELL_DEPTH (16px) per level under the 30° ortho camera.
const ISO_HEIGHT_SCALE = 0.41
const MIN_HEIGHT_SCALE = 0.2
const MAX_HEIGHT_SCALE = 5

// Same tables as PreparedTerrainCodec / CellTerrain.setPatchBorder / MapWaterOverlay.
const PATCH_DIRECTIONS = ['north', 'south', 'east', 'west'] as const
const PATCH_FRAME_BY_DIRECTION = { west: 0, north: 1, south: 2, east: 3 } as const
const PATCH_GROUNDS = ['Desert', 'DarkForest', 'Dirt', 'Jungle', 'Snow'] as const
const PATCH_SHEETS: Record<(typeof PATCH_GROUNDS)[number], string> = {
  Desert: 'border/desert-relief',
  DarkForest: 'border/dark-grass-relief',
  Dirt: 'border/dirt-relief',
  Jungle: 'border/jungle-relief',
  Snow: 'border/snow-relief',
}
const WATER_BORDER_SHEET = 'border/desert-sand-water-border'
const WATER_BORDER_FRAMES = 12
const WATER_PHASES = 4
const WATER_SURFACE_SHEET = 'border/water-surface-filter'
const WATER_SURFACE_ALPHA = 0.32
const WATER_FRAMES_PER_SECOND = 60 / 17
// Border atlas: rows 0-4 = patch grounds (columns = PATCH_DIRECTIONS), rows 5-8 = shore phases (columns = frames).
const BORDER_COLUMNS = WATER_BORDER_FRAMES
const BORDER_ROWS = PATCH_GROUNDS.length + WATER_PHASES

type TerrainBlueprint = {
  size: number
  seed?: string | number
  terrain: string
  relief: string
  terrainAppearanceData?: string
  environment?: string
  resources?: BlueprintResource[]
  spawns?: Array<{ i: number; j: number }>
}
type CellsConfig = Record<string, { assets?: Array<{ sheet: string; frame: number }> }>

/** Copies a diamond frame into a TILE² square of an atlas (u along i, v along j). Returns the mean colour. */
function unwarpFrame(
  sheet: Sheet,
  rect: FrameRect,
  atlas: Uint8Array,
  atlasWidth: number,
  column: number,
  row: number,
  opaque = false
): [number, number, number] {
  const { image } = sheet
  const sum: [number, number, number] = [0, 0, 0]
  // Matches cartesianToIsometric: +i goes right-down, +j goes left-down on screen.
  const sourceIndex = (u: number, v: number) => {
    const sx = Math.min(rect.w - 1, Math.max(0, Math.floor(rect.w / 2 + ((u - v) * (rect.w - 1)) / 2)))
    const sy = Math.min(rect.h - 1, Math.max(0, Math.floor(rect.h / 2 + ((u + v) * (rect.h - 1)) / 2)))
    return ((rect.y + sy) * image.width + rect.x + sx) * 4
  }
  for (let y = 0; y < TILE; y++) {
    for (let x = 0; x < TILE; x++) {
      const u = (x + 0.5) / TILE - 0.5
      const v = (y + 0.5) / TILE - 0.5
      let source = sourceIndex(u, v)
      // The diamond's staircase edge leaves transparent pixels; ground tiles pull them from just inside.
      for (let step = 1; opaque && image.data[source + 3] < 255 && step <= 16; step++) {
        source = sourceIndex(u * (1 - step / 32), v * (1 - step / 32))
      }
      const target = ((row * TILE + y) * atlasWidth + column * TILE + x) * 4
      for (let channel = 0; channel < 4; channel++) atlas[target + channel] = image.data[source + channel]
      for (let channel = 0; channel < 3; channel++) sum[channel] += image.data[source + channel]
    }
  }
  return [sum[0] / (TILE * TILE), sum[1] / (TILE * TILE), sum[2] / (TILE * TILE)]
}

/** Rows = TERRAIN_TYPES index, columns = variant. */
async function buildTerrainAtlas(
  cells: CellsConfig,
  loadSheet: (sheet: string) => Promise<Sheet>
): Promise<{ pixels: Uint8Array; averages: Uint8Array; columns: number; rows: number; variantCounts: number[] }> {
  const rows = TERRAIN_TYPES.length
  const variantCounts = TERRAIN_TYPES.map(type => cells[type]?.assets?.length ?? 0)
  const columns = Math.max(1, ...variantCounts)
  const width = columns * TILE
  const pixels = new Uint8Array(width * rows * TILE * 4)
  const averages = new Uint8Array(columns * rows * 4)
  for (let row = 0; row < rows; row++) {
    const assets = cells[TERRAIN_TYPES[row]]?.assets ?? []
    for (let column = 0; column < assets.length; column++) {
      const { sheet: sheetName, frame } = assets[column]
      const sheet = await loadSheet(sheetName)
      const average = unwarpFrame(sheet, getFrameRect(sheet, frame, sheetName), pixels, width, column, row, true)
      averages.set([...average, 255], (row * columns + column) * 4)
    }
  }
  return { pixels, averages, columns, rows, variantCounts }
}

/** Patch borders use the flat-tile frames (0-3): in 3D the slope is real geometry, not a sprite silhouette. */
async function buildBorderAtlas(loadSheet: (sheet: string) => Promise<Sheet>): Promise<Uint8Array> {
  const width = BORDER_COLUMNS * TILE
  const pixels = new Uint8Array(width * BORDER_ROWS * TILE * 4)
  for (let row = 0; row < PATCH_GROUNDS.length; row++) {
    const sheetName = PATCH_SHEETS[PATCH_GROUNDS[row]]
    const sheet = await loadSheet(sheetName)
    PATCH_DIRECTIONS.forEach((direction, column) => {
      const rect = getFrameRect(sheet, PATCH_FRAME_BY_DIRECTION[direction], sheetName)
      unwarpFrame(sheet, rect, pixels, width, column, row)
    })
  }
  const water = await loadSheet(WATER_BORDER_SHEET)
  for (let phase = 0; phase < WATER_PHASES; phase++) {
    for (let frame = 0; frame < WATER_BORDER_FRAMES; frame++) {
      const rect = getFrameRect(water, frame + phase * WATER_BORDER_FRAMES, WATER_BORDER_SHEET)
      unwarpFrame(water, rect, pixels, width, frame, PATCH_GROUNDS.length + phase)
    }
  }
  return pixels
}

/** RGBA per cell: type, variant, relief+128, present. Texture row is j and column is i. */
function buildCellData(
  types: Uint8Array,
  relief: Int8Array,
  gridSize: number,
  variantCounts: number[],
  seed: string | number
): Uint8Array {
  const pickVariant = createDeterministicCellVariantPicker(seed)
  const variantIndexes = variantCounts.map(count => Array.from({ length: count }, (_, index) => index))
  const data = new Uint8Array(gridSize * gridSize * 4)
  for (let i = 0; i < gridSize; i++) {
    for (let j = 0; j < gridSize; j++) {
      const cell = i * gridSize + j
      const type = types[cell]
      if (type === ABSENT) continue
      const target = (j * gridSize + i) * 4
      data[target] = type
      data[target + 1] = pickVariant(variantIndexes[type], i, j) ?? 0
      data[target + 2] = relief[cell] + 128
      data[target + 3] = 255
    }
  }
  return data
}

/**
 * RGBA per cell: shore frame + 1, then one nibble per patch direction (north|south<<4, east|west<<4)
 * holding the border ground row + 1. Unset patch grounds default to Desert like CellTerrain.setPatchBorder.
 */
function buildBorderData(
  appearanceData: string | undefined,
  size: number
): { data: Uint8Array; shores: number; patches: number } {
  const gridSize = size + 1
  const data = new Uint8Array(gridSize * gridSize * 4)
  let shores = 0
  let patches = 0
  if (!appearanceData) return { data, shores, patches }
  for (const entry of decodePreparedTerrain(decodeBase64(appearanceData), size)) {
    const target = (entry.j * gridSize + entry.i) * 4
    if (entry.water) {
      data[target] = Number(entry.water[1]) + 1
      shores++
    }
    const nibbles = PATCH_DIRECTIONS.map(direction => {
      if (!entry.patches?.includes(direction)) return 0
      patches++
      const ground = entry.grounds?.[direction] ?? entry.ground ?? 'Desert'
      return PATCH_GROUNDS.indexOf(ground) + 1
    })
    data[target + 1] = nibbles[0] | (nibbles[1] << 4)
    data[target + 2] = nibbles[2] | (nibbles[3] << 4)
  }
  return { data, shores, patches }
}

/** Corner heights in relief levels: land averages its present neighbours, any water contact pins the corner to the surface. */
function buildCornerHeights(types: Uint8Array, relief: Int8Array, gridSize: number): Float32Array {
  const cornerSize = gridSize + 1
  const heights = new Float32Array(cornerSize * cornerSize)
  for (let a = 0; a <= gridSize; a++) {
    for (let b = 0; b <= gridSize; b++) {
      let sum = 0
      let count = 0
      let touchesWater = false
      for (let di = -1; di <= 0; di++) {
        for (let dj = -1; dj <= 0; dj++) {
          const i = a + di
          const j = b + dj
          if (i < 0 || j < 0 || i >= gridSize || j >= gridSize) continue
          const type = types[i * gridSize + j]
          if (type === ABSENT) continue
          if (type === WATER) touchesWater = true
          sum += relief[i * gridSize + j]
          count++
        }
      }
      heights[a * cornerSize + b] = touchesWater ? WATER_LEVEL : count ? sum / count : 0
    }
  }
  return heights
}

function buildChunkMeshes(
  scene: BABYLON.Scene,
  material: BABYLON.Material,
  types: Uint8Array,
  heights: Float32Array,
  gridSize: number
): { meshes: BABYLON.Mesh[]; triangles: number } {
  const cornerSize = gridSize + 1
  const heightAt = (a: number, b: number) =>
    heights[Math.min(gridSize, Math.max(0, a)) * cornerSize + Math.min(gridSize, Math.max(0, b))]
  const meshes: BABYLON.Mesh[] = []
  let triangles = 0

  for (let i0 = 0; i0 < gridSize; i0 += CHUNK_CELLS) {
    for (let j0 = 0; j0 < gridSize; j0 += CHUNK_CELLS) {
      const i1 = Math.min(gridSize, i0 + CHUNK_CELLS)
      const j1 = Math.min(gridSize, j0 + CHUNK_CELLS)
      const span = j1 - j0 + 1
      const indices: number[] = []
      for (let i = i0; i < i1; i++) {
        for (let j = j0; j < j1; j++) {
          if (types[i * gridSize + j] === ABSENT) continue
          const v00 = (i - i0) * span + (j - j0)
          const v01 = v00 + 1
          const v10 = v00 + span
          const v11 = v10 + 1
          indices.push(v00, v10, v11, v00, v11, v01)
        }
      }
      if (!indices.length) continue

      const vertexCount = (i1 - i0 + 1) * span
      const positions = new Float32Array(vertexCount * 3)
      // Unscaled height gradient (x, z); the vertex shader turns it into a normal for the current height scale.
      const gradients = new Float32Array(vertexCount * 3)
      let minHeight = Infinity
      let maxHeight = -Infinity
      let vertex = 0
      for (let a = i0; a <= i1; a++) {
        for (let b = j0; b <= j1; b++) {
          const height = heightAt(a, b)
          minHeight = Math.min(minHeight, height)
          maxHeight = Math.max(maxHeight, height)
          // World x = i, world z = -j: a camera at alpha -45° then sees the game's isometric orientation.
          positions[vertex * 3] = a
          positions[vertex * 3 + 1] = height
          positions[vertex * 3 + 2] = -b
          gradients[vertex * 3] = (heightAt(a + 1, b) - heightAt(a - 1, b)) / 2
          gradients[vertex * 3 + 2] = -(heightAt(a, b + 1) - heightAt(a, b - 1)) / 2
          vertex++
        }
      }

      const vertexData = new BABYLON.VertexData()
      vertexData.positions = positions
      vertexData.normals = gradients
      vertexData.indices = new Uint16Array(indices)
      const mesh = new BABYLON.Mesh(`terrain ${i0}:${j0}`, scene)
      vertexData.applyToMesh(mesh, false)
      // Culling bounds cover every allowed height scale, since the scale is applied on the GPU.
      const low = Math.min(minHeight * MIN_HEIGHT_SCALE, minHeight * MAX_HEIGHT_SCALE)
      const high = Math.max(maxHeight * MIN_HEIGHT_SCALE, maxHeight * MAX_HEIGHT_SCALE)
      mesh.setBoundingInfo(
        new BABYLON.BoundingInfo(new BABYLON.Vector3(i0, low, -j1), new BABYLON.Vector3(i1, high, -j0))
      )
      mesh.doNotSyncBoundingInfo = true
      mesh.material = material
      mesh.isPickable = false
      mesh.freezeWorldMatrix()
      meshes.push(mesh)
      triangles += indices.length / 3
    }
  }
  return { meshes, triangles }
}

/** Terraces like the 2D game: every cell is a flat plateau at its own level, with vertical cliffs between levels. */
function buildCellHeights(types: Uint8Array, relief: Int8Array): Float32Array {
  const heights = new Float32Array(types.length)
  for (let index = 0; index < types.length; index++) {
    heights[index] = types[index] === WATER ? WATER_LEVEL : relief[index]
  }
  return heights
}

function buildTerraceMeshes(
  scene: BABYLON.Scene,
  material: BABYLON.Material,
  types: Uint8Array,
  cellHeights: Float32Array,
  gridSize: number
): { meshes: BABYLON.Mesh[]; triangles: number } {
  const meshes: BABYLON.Mesh[] = []
  let triangles = 0
  // Wall vertices sit a hair inside the higher cell so the shader samples that cell's ground type.
  const INSET = 0.001
  for (let i0 = 0; i0 < gridSize; i0 += CHUNK_CELLS) {
    for (let j0 = 0; j0 < gridSize; j0 += CHUNK_CELLS) {
      const positions: number[] = []
      const normals: number[] = []
      const indices: number[] = []
      let minHeight = Infinity
      let maxHeight = -Infinity
      const quad = (corners: number[][], normal: number[]) => {
        const first = positions.length / 3
        for (const corner of corners) {
          positions.push(...corner)
          normals.push(...normal)
        }
        indices.push(first, first + 1, first + 2, first, first + 2, first + 3)
      }
      for (let i = i0; i < Math.min(gridSize, i0 + CHUNK_CELLS); i++) {
        for (let j = j0; j < Math.min(gridSize, j0 + CHUNK_CELLS); j++) {
          const cell = i * gridSize + j
          if (types[cell] === ABSENT) continue
          const h = cellHeights[cell]
          minHeight = Math.min(minHeight, h)
          maxHeight = Math.max(maxHeight, h)
          quad(
            [
              [i, h, -j],
              [i + 1, h, -j],
              [i + 1, h, -(j + 1)],
              [i, h, -(j + 1)],
            ],
            [0, 0, 0]
          )
          // A wall on every side whose neighbour is lower (or outside the map), down to that neighbour.
          const sides: Array<[number, number, number[][], number[]]> = [
            [
              i + 1,
              j,
              [
                [i + 1 - INSET, 0, -j],
                [i + 1 - INSET, 0, -(j + 1)],
              ],
              [1, 1, 0],
            ],
            [
              i - 1,
              j,
              [
                [i + INSET, 0, -(j + 1)],
                [i + INSET, 0, -j],
              ],
              [-1, 1, 0],
            ],
            [
              i,
              j + 1,
              [
                [i, 0, -(j + 1 - INSET)],
                [i + 1, 0, -(j + 1 - INSET)],
              ],
              [0, 1, -1],
            ],
            [
              i,
              j - 1,
              [
                [i + 1, 0, -(j + INSET)],
                [i, 0, -(j + INSET)],
              ],
              [0, 1, 1],
            ],
          ]
          for (const [ni, nj, [a, b], normal] of sides) {
            const inside = ni >= 0 && nj >= 0 && ni < gridSize && nj < gridSize && types[ni * gridSize + nj] !== ABSENT
            const low = inside ? cellHeights[ni * gridSize + nj] : Math.min(h, WATER_LEVEL)
            if (low >= h) continue
            minHeight = Math.min(minHeight, low)
            quad(
              [
                [a[0], h, a[2]],
                [b[0], h, b[2]],
                [b[0], low, b[2]],
                [a[0], low, a[2]],
              ],
              normal
            )
          }
        }
      }
      if (!indices.length) continue
      const vertexData = new BABYLON.VertexData()
      vertexData.positions = positions
      vertexData.normals = normals
      vertexData.indices = new Uint32Array(indices)
      const mesh = new BABYLON.Mesh(`terrace ${i0}:${j0}`, scene)
      vertexData.applyToMesh(mesh, false)
      const i1 = Math.min(gridSize, i0 + CHUNK_CELLS)
      const j1 = Math.min(gridSize, j0 + CHUNK_CELLS)
      mesh.setBoundingInfo(
        new BABYLON.BoundingInfo(
          new BABYLON.Vector3(i0, Math.min(minHeight * MAX_HEIGHT_SCALE, minHeight), -j1),
          new BABYLON.Vector3(i1, Math.max(maxHeight * MAX_HEIGHT_SCALE, maxHeight), -j0)
        )
      )
      mesh.doNotSyncBoundingInfo = true
      mesh.material = material
      mesh.isPickable = false
      mesh.freezeWorldMatrix()
      meshes.push(mesh)
      triangles += indices.length / 3
    }
  }
  return { meshes, triangles }
}

// Sloped plateaus: flat terraces joined by ~45° ramps (at the iso relief scale) with rounded top and bottom.
const SLOPE_RUN = ISO_HEIGHT_SCALE // cells per relief level: one level rises as much as it runs at the default scale
const SLOPE_ROUND = 0 // cells over which the top edge eases into the ramp
const SLOPE_FOOT = 0 // relief levels over which the ramp eases onto the lower plateau
const SLOPE_RADIUS = 2 // cells searched around a point (covers two-level steps)
const SLOPE_SUBDIV = 3 // samples per cell side where a ramp passes

/** Levels dropped at a distance d (cells) from a plateau: quadratic ease-in, then linear (45°). */
function slopeDrop(d: number): number {
  if (d <= 0) return 0
  return d < SLOPE_ROUND ? (d * d) / (2 * SLOPE_ROUND * SLOPE_RUN) : (d - SLOPE_ROUND / 2) / SLOPE_RUN
}

/** Polynomial smooth maximum: rounds the crease where two surfaces meet. */
function smoothMax(a: number, b: number, k: number): number {
  if (k <= 0) return Math.max(a, b)
  const h = Math.max(k - Math.abs(a - b), 0) / k
  return Math.max(a, b) + (h * h * k) / 4
}

function createSlopeField(types: Uint8Array, relief: Int8Array, gridSize: number): (x: number, y: number) => number {
  const distanceToCell = (x: number, y: number, i: number, j: number) => {
    const dx = Math.max(i - x, 0, x - (i + 1))
    const dy = Math.max(j - y, 0, y - (j + 1))
    return Math.hypot(dx, dy)
  }
  return (x, y) => {
    const ci = Math.floor(x)
    const cj = Math.floor(y)
    // Land: the highest plateau reaching this point, per distinct level (equal plateaus must not bump each other).
    let best = -Infinity
    let bestLevel = NaN
    let second = -Infinity
    let water = Infinity
    for (let i = ci - SLOPE_RADIUS; i <= ci + SLOPE_RADIUS; i++) {
      if (i < 0 || i >= gridSize) continue
      for (let j = cj - SLOPE_RADIUS; j <= cj + SLOPE_RADIUS; j++) {
        if (j < 0 || j >= gridSize) continue
        const index = i * gridSize + j
        const type = types[index]
        if (type === ABSENT) continue
        const d = distanceToCell(x, y, i, j)
        if (type === WATER) {
          water = Math.min(water, WATER_LEVEL + slopeDrop(d))
          continue
        }
        const level = relief[index]
        const value = level - slopeDrop(d)
        if (level === bestLevel) {
          best = Math.max(best, value)
        } else if (value > best) {
          if (Number.isFinite(best)) second = Math.max(second, best)
          best = value
          bestLevel = level
        } else {
          second = Math.max(second, value)
        }
      }
    }
    let height = Number.isFinite(best)
      ? Number.isFinite(second)
        ? smoothMax(best, second, SLOPE_FOOT)
        : best
      : WATER_LEVEL
    // Water stays flat; land around it ramps down into it.
    if (Number.isFinite(water)) height = Math.min(height, water)
    return height
  }
}

function buildSlopeMeshes(
  scene: BABYLON.Scene,
  material: BABYLON.Material,
  types: Uint8Array,
  relief: Int8Array,
  gridSize: number,
  field: (x: number, y: number) => number
): { meshes: BABYLON.Mesh[]; triangles: number } {
  const meshes: BABYLON.Mesh[] = []
  let triangles = 0
  const S = SLOPE_SUBDIV
  const step = 1 / S
  // A land cell is a flat quad when every present cell within the search radius is land at its own level.
  const isFlat = (i: number, j: number) => {
    const index = i * gridSize + j
    if (types[index] === WATER) return true
    const level = relief[index]
    for (let a = i - SLOPE_RADIUS; a <= i + SLOPE_RADIUS; a++) {
      if (a < 0 || a >= gridSize) continue
      for (let b = j - SLOPE_RADIUS; b <= j + SLOPE_RADIUS; b++) {
        if (b < 0 || b >= gridSize) continue
        const type = types[a * gridSize + b]
        if (type === ABSENT) continue
        if (type === WATER || relief[a * gridSize + b] !== level) return false
      }
    }
    return true
  }
  for (let i0 = 0; i0 < gridSize; i0 += CHUNK_CELLS) {
    for (let j0 = 0; j0 < gridSize; j0 += CHUNK_CELLS) {
      const positions: number[] = []
      const normals: number[] = []
      const indices: number[] = []
      let minHeight = Infinity
      let maxHeight = -Infinity
      const i1 = Math.min(gridSize, i0 + CHUNK_CELLS)
      const j1 = Math.min(gridSize, j0 + CHUNK_CELLS)
      for (let i = i0; i < i1; i++) {
        for (let j = j0; j < j1; j++) {
          const index = i * gridSize + j
          if (types[index] === ABSENT) continue
          const first = positions.length / 3
          if (isFlat(i, j)) {
            const h = types[index] === WATER ? WATER_LEVEL : relief[index]
            minHeight = Math.min(minHeight, h)
            maxHeight = Math.max(maxHeight, h)
            positions.push(i, h, -j, i + 1, h, -j, i + 1, h, -(j + 1), i, h, -(j + 1))
            normals.push(0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0)
            indices.push(first, first + 1, first + 2, first, first + 2, first + 3)
            continue
          }
          // Sample (S+1)² heights plus a one-sample margin for the normals.
          const span = S + 3
          const samples = new Float32Array(span * span)
          for (let a = 0; a < span; a++) {
            for (let b = 0; b < span; b++) {
              samples[a * span + b] = field(i + (a - 1) * step, j + (b - 1) * step)
            }
          }
          for (let a = 0; a <= S; a++) {
            for (let b = 0; b <= S; b++) {
              const h = samples[(a + 1) * span + b + 1]
              minHeight = Math.min(minHeight, h)
              maxHeight = Math.max(maxHeight, h)
              positions.push(i + a * step, h, -(j + b * step))
              const dx = (samples[(a + 2) * span + b + 1] - samples[a * span + b + 1]) / (2 * step)
              const dj = (samples[(a + 1) * span + b + 2] - samples[(a + 1) * span + b]) / (2 * step)
              normals.push(dx, 0, -dj)
            }
          }
          for (let a = 0; a < S; a++) {
            for (let b = 0; b < S; b++) {
              const v00 = first + a * (S + 1) + b
              const v10 = v00 + S + 1
              indices.push(v00, v10, v10 + 1, v00, v10 + 1, v00 + 1)
            }
          }
        }
      }
      if (!indices.length) continue
      const vertexData = new BABYLON.VertexData()
      vertexData.positions = positions
      vertexData.normals = normals
      vertexData.indices = new Uint32Array(indices)
      const mesh = new BABYLON.Mesh(`slopes ${i0}:${j0}`, scene)
      vertexData.applyToMesh(mesh, false)
      mesh.setBoundingInfo(
        new BABYLON.BoundingInfo(
          new BABYLON.Vector3(i0, Math.min(minHeight * MAX_HEIGHT_SCALE, minHeight), -j1),
          new BABYLON.Vector3(i1, Math.max(maxHeight * MAX_HEIGHT_SCALE, maxHeight), -j0)
        )
      )
      mesh.doNotSyncBoundingInfo = true
      mesh.material = material
      mesh.isPickable = false
      mesh.freezeWorldMatrix()
      meshes.push(mesh)
      triangles += indices.length / 3
    }
  }
  return { meshes, triangles }
}

const VERTEX_SHADER = `
precision highp float;
attribute vec3 position;
attribute vec3 normal;
uniform mat4 worldViewProjection;
uniform mat4 shadowMatrix;
uniform float heightScale;
varying vec2 vCell;
varying vec3 vNormal;
varying float vWall;
varying vec3 vWorld;
varying vec4 vShadow;
void main(void) {
  vCell = vec2(position.x, -position.z);
  vWorld = vec3(position.x, position.y * heightScale, position.z);
  vShadow = shadowMatrix * vec4(vWorld, 1.0);
  // Terrace walls carry normal.y = 1 and their outward direction in xz; ground carries its height gradient.
  vWall = step(0.5, normal.y);
  vNormal = vWall > 0.5 ? vec3(normal.x, 0.15, normal.z) : vec3(-normal.x * heightScale, 1.0, -normal.z * heightScale);
  gl_Position = worldViewProjection * vec4(position.x, position.y * heightScale, position.z, 1.0);
}
`

const FRAGMENT_SHADER = `
#extension GL_OES_standard_derivatives : enable
precision highp float;
varying vec2 vCell;
varying vec3 vNormal;
varying float vWall;
varying vec3 vWorld;
varying vec4 vShadow;
uniform sampler2D cellData;
uniform sampler2D borderData;
uniform sampler2D atlas;
uniform sampler2D averageColors;
uniform sampler2D borderAtlas;
uniform sampler2D waterSurface;
uniform float gridSize;
uniform vec2 atlasGrid;
uniform vec3 sunDirection;
uniform vec3 waterColor;
uniform float waterPhase;
uniform float showGrid;
uniform float showBorders;
uniform float waterType;
uniform float slopeLight;
uniform float drawnRelief;
uniform float modelStyle;
uniform sampler2D shadowMap;
uniform vec2 shadowDepth;
uniform float shadowPacked;
uniform float shadowDebug;
const float TILE = ${TILE.toFixed(1)};
const vec2 BORDER_GRID = vec2(${BORDER_COLUMNS.toFixed(1)}, ${BORDER_ROWS.toFixed(1)});
const float SHORE_ROW = ${PATCH_GROUNDS.length.toFixed(1)};
const float WATER_PHASES = ${WATER_PHASES.toFixed(1)};

float byteAt(float value) { return floor(value * 255.0 + 0.5); }

float modelHash(vec2 point) {
  return fract(sin(dot(point, vec2(127.1, 311.7))) * 43758.5453);
}

float modelNoise(vec2 point) {
  vec2 cell = floor(point);
  vec2 blend = fract(point);
  blend = blend * blend * (3.0 - 2.0 * blend);
  return mix(
    mix(modelHash(cell), modelHash(cell + vec2(1.0, 0.0)), blend.x),
    mix(modelHash(cell + vec2(0.0, 1.0)), modelHash(cell + vec2(1.0, 1.0)), blend.x),
    blend.y
  );
}

vec3 modelGroundColor(float ground) {
  if (ground < 0.5) return vec3(0.51, 0.72, 0.24); // grass
  if (ground < 1.5) return vec3(0.93, 0.70, 0.40); // warm sand paths
  if (ground < 3.5) return vec3(0.35, 0.58, 0.23); // jungle
  if (ground < 4.5) return vec3(0.31, 0.52, 0.22); // dark forest
  if (ground < 5.5) return vec3(0.61, 0.44, 0.29); // dirt
  return vec3(0.87, 0.89, 0.83); // snow
}

vec3 modelGroundTexture(vec2 point, float ground) {
  vec3 base = modelGroundColor(ground);
  float broad = modelNoise(point * 1.7);
  float medium = modelNoise(point * 3.5 + vec2(13.0, 3.0));
  vec2 facetCell = floor(point * 5.0);
  float triangle = step(fract(point.x * 5.0), fract(point.y * 5.0));
  float facet = modelHash(facetCell + vec2(triangle * 0.37, triangle * 0.71));
  float variation = (broad - 0.5) * 0.09 + (medium - 0.5) * 0.02 + (facet - 0.5) * 0.065;
  return base * (1.0 + variation);
}

float unpackShadow(vec4 value) {
  return mix(value.r, dot(value, vec4(1.0 / 16581375.0, 1.0 / 65025.0, 1.0 / 255.0, 1.0)), shadowPacked);
}

float shadowVisibility() {
  vec3 clip = vShadow.xyz / vShadow.w;
  vec2 uv = clip.xy * 0.5 + 0.5;
  if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) return 1.0;
  float depth = (vShadow.z + shadowDepth.x) / shadowDepth.y - 0.0015;
  return step(depth, unpackShadow(texture2D(shadowMap, uv)));
}

vec4 borderTexel(float column, float row, vec2 local) {
  return texture2D(borderAtlas, (vec2(column, row) + local) / BORDER_GRID);
}

vec3 applyPatch(vec3 color, float ground, float column, vec2 local, float fade) {
  if (ground < 0.5) return color;
  vec4 texel = borderTexel(column, ground - 1.0, local);
  return mix(color, texel.rgb, texel.a * fade);
}

void main(void) {
  vec2 cellIndex = floor(vCell);
  vec2 cellUv = (cellIndex + 0.5) / gridSize;
  vec4 data = texture2D(cellData, cellUv);
  vec4 borders = texture2D(borderData, cellUv);
  float type = byteAt(data.r);
  float variant = byteAt(data.g);
  vec2 local = fract(vCell);
  float cellsPerPixel = max(fwidth(vCell.x), fwidth(vCell.y));
  // No mipmaps (fract() breaks derivatives at cell edges): fade detail out when texels start to alias.
  float far = smoothstep(2.5, 8.0, cellsPerPixel * TILE);

  // Water surface: environment colour + the game's tiling filter, laid out in isometric screen pixels.
  vec2 iso = vec2((vCell.x - vCell.y) * 32.0, (vCell.x + vCell.y) * 16.0);
  vec2 surfaceUv = fract(iso / vec2(116.0, 114.0));
  vec4 surface = texture2D(waterSurface, vec2((waterPhase + surfaceUv.x) / WATER_PHASES, surfaceUv.y));
  vec3 water = mix(waterColor, surface.rgb, surface.a * ${WATER_SURFACE_ALPHA} * (1.0 - far));

  vec3 color;
  if (abs(type - waterType) < 0.5) {
    color = water;
  } else {
    float shoreFrame = byteAt(borders.r);
    if (shoreFrame > 0.5 && showBorders > 0.5) {
      vec4 shore = borderTexel(shoreFrame - 1.0, SHORE_ROW + waterPhase, local);
      color = mix(water, shore.rgb, shore.a);
    } else {
      vec2 tile = vec2(variant, type);
      vec3 texel = texture2D(atlas, (tile + local) / atlasGrid).rgb;
      vec3 average = texture2D(averageColors, (tile + 0.5) / atlasGrid).rgb;
      color = mix(texel, average, far);
    }
    if (showBorders > 0.5) {
      float northSouth = byteAt(borders.g);
      float eastWest = byteAt(borders.b);
      float fade = 1.0 - far * 0.6;
      color = applyPatch(color, mod(northSouth, 16.0), 0.0, local, fade);
      color = applyPatch(color, floor(northSouth / 16.0), 1.0, local, fade);
      color = applyPatch(color, mod(eastWest, 16.0), 2.0, local, fade);
      color = applyPatch(color, floor(eastWest / 16.0), 3.0, local, fade);
    }
    // Face normal (not interpolated): every flat slope facet gets one single tone, like a pixel-art relief edge.
    vec3 faceNormal = normalize(cross(dFdx(vWorld), dFdy(vWorld)));
    if (faceNormal.y < 0.0) faceNormal = -faceNormal;
    vec3 shadingNormal = vWall > 0.5 ? normalize(vNormal) : faceNormal;
    float light = max(dot(shadingNormal, normalize(sunDirection)), 0.0);
    if (vWall > 0.5) {
      // Cliff face: the cell's own ground colour, darkened, with pixel-art strata.
      vec3 average = texture2D(averageColors, (vec2(variant, type) + 0.5) / atlasGrid).rgb;
      float strata = 0.85 + 0.15 * step(0.5, fract(floor(vCell.x * 8.0 + vCell.y * 8.0) * 0.37));
      color = mix(average, vec3(0.32, 0.24, 0.17), 0.45) * strata;
    }
    // Slope shading: without the 2D cliff sprites it is what makes the relief readable.
    // Relative to the flat ground, which keeps exactly its texture colour.
    float flatLight = max(dot(vec3(0.0, 1.0, 0.0), normalize(sunDirection)), 0.0);
    float sunShade = mix(1.0, (0.4 + 0.75 * light) / (0.4 + 0.75 * flatLight), slopeLight);
    // Drawn relief (iso view), like the 2D game's relief tiles: no sun shading, slopes in one flat darker tone,
    // and a light rim along the top edge of every plateau.
    float slope = step(faceNormal.y, 0.985) * (1.0 - vWall);
    float drawn = mix(1.0, 0.86, slope);
    if (slope < 0.5) {
      float level = byteAt(data.b);
      float rimWidth = 1.5 * cellsPerPixel;
      float rim = 0.0;
      for (int k = 0; k < 8; k++) {
        vec2 offset = k == 0 ? vec2(1.0, 0.0) : k == 1 ? vec2(-1.0, 0.0) : k == 2 ? vec2(0.0, 1.0) : k == 3 ? vec2(0.0, -1.0)
          : k == 4 ? vec2(1.0, 1.0) : k == 5 ? vec2(1.0, -1.0) : k == 6 ? vec2(-1.0, 1.0) : vec2(-1.0, -1.0);
        vec4 neighbour = texture2D(cellData, (cellIndex + offset + 0.5) / gridSize);
        if (neighbour.a < 0.5) continue;
        bool lower = abs(byteAt(neighbour.r) - waterType) < 0.5 ? abs(type - waterType) > 0.5 : byteAt(neighbour.b) < level;
        if (!lower) continue;
        // Distance from this fragment to the shared edge (or corner) with the lower cell.
        vec2 toEdge = vec2(offset.x > 0.5 ? 1.0 - local.x : offset.x < -0.5 ? local.x : 0.0,
                           offset.y > 0.5 ? 1.0 - local.y : offset.y < -0.5 ? local.y : 0.0);
        float distance = max(toEdge.x, toEdge.y);
        if (distance < rimWidth) rim = 1.0;
      }
      drawn = 1.0;
      // Rim: lighter and slightly desaturated (a highlight, not a neon stroke).
      color = mix(color, mix(color * 1.12, vec3(dot(color, vec3(0.33))) * 1.35, 0.35), rim * drawnRelief);
    }
    color *= mix(sunShade, drawn, drawnRelief);
    if (modelStyle > 0.5) {
      // Keep the blueprint's terrain types, but replace the pixel-art atlas with
      // a low-poly ground palette. Warping cell lookup breaks up straight tile
      // boundaries into the irregular grass/sand edges of the model style.
      vec2 warp = vec2(
        modelNoise(vCell * 4.2),
        modelNoise(vCell * 4.2 + vec2(17.3, 9.1))
      ) - 0.5;
      vec2 warpedCell = floor(clamp(vCell + warp * 0.30, vec2(0.0), vec2(gridSize - 1.0)));
      vec4 styledData = texture2D(cellData, (warpedCell + 0.5) / gridSize);
      float styledType = byteAt(styledData.r);
      if (styledData.a < 0.5 || abs(styledType - waterType) < 0.5 || vWall > 0.5) styledType = type;
      color = modelGroundTexture(vCell, styledType) * (vWall > 0.5 ? 0.68 : sunShade);
    }
  }

  if (showGrid > 0.5) {
    vec2 edge = min(local, 1.0 - local);
    if (min(edge.x, edge.y) < cellsPerPixel) color *= 0.6;
  }
  float visibility = shadowVisibility();
  color = shadowDebug > 0.5 ? vec3(visibility) : color * mix(0.38, 1.0, visibility);
  gl_FragColor = vec4(color, 1.0);
}
`

function createHud(parent: HTMLElement): HTMLDivElement {
  const hud = document.createElement('div')
  Object.assign(hud.style, {
    position: 'absolute',
    top: '8px',
    left: '8px',
    padding: '8px 10px',
    background: 'rgba(0, 0, 0, 0.65)',
    color: '#f2f2f2',
    font: '12px/1.45 monospace',
    whiteSpace: 'pre-wrap',
    maxWidth: 'min(360px, calc(100vw - 16px))',
    pointerEvents: 'none',
    zIndex: '10',
  })
  parent.appendChild(hud)
  return hud
}

function createBuddyEquipmentControls(parent: HTMLElement, buddy: TerrainBuddy): void {
  const panel = document.createElement('div')
  Object.assign(panel.style, {
    position: 'absolute', top: '8px', right: '8px', zIndex: '11',
    padding: '8px 10px', background: 'rgba(0, 0, 0, 0.65)', color: '#f2f2f2',
    font: '12px/1.45 monospace', display: 'grid', gap: '6px',
  })
  const addSelect = (label: string, choices: Array<[string, string]>, onChange: (value: string) => void) => {
    const row = document.createElement('label')
    row.textContent = `${label} `
    const select = document.createElement('select')
    select.style.maxWidth = '155px'
    for (const [value, name] of choices) {
      const option = document.createElement('option')
      option.value = value
      option.textContent = name
      select.appendChild(option)
    }
    select.addEventListener('change', () => onChange(select.value))
    row.appendChild(select)
    panel.appendChild(row)
    return select
  }
  const shield = addSelect('Bouclier', [
    ['iron', 'Fer'], ['bronze', 'Bronze'], ['wood', 'Bois'], ['none', 'Aucun'],
  ], kind => buddy.setShield(kind))
  const weapon = addSelect('Arme', [
    ['sword-iron', 'Épée fer'], ['sword-bronze', 'Épée bronze'],
    ['dagger-iron', 'Dague fer'], ['dagger-bronze', 'Dague bronze'],
    ['spear-iron', 'Lance fer'], ['spear-bronze', 'Lance bronze'],
    ['bow', 'Arc'], ['bow-recurve', 'Arc recourbé'], ['bow-great', 'Grand arc'], ['slingshot', 'Lance-pierre'],
    ['axe-iron', 'Hache fer'], ['axe-bronze', 'Hache bronze'], ['axe-ceramic', 'Hache céramique'],
    ['hammer-iron', 'Marteau fer'], ['hammer-bronze', 'Marteau bronze'], ['hammer-ceramic', 'Marteau céramique'],
    ['pickaxe-iron', 'Pioche fer'], ['pickaxe-bronze', 'Pioche bronze'], ['pickaxe-ceramic', 'Pioche céramique'],
    ['scythe-iron', 'Faux fer'], ['scythe-bronze', 'Faux bronze'], ['scythe-ceramic', 'Faux céramique'],
    ['longstick', 'Bâton'], ['catchingPole', 'Perche de capture'], ['none', 'Sans équipement'],
  ], kind => {
    buddy.setEquipment(kind)
    shield.disabled = kind === 'slingshot' || kind.startsWith('bow')
  })
  panel.prepend(weapon.parentElement!)
  parent.appendChild(panel)
}

function createRgbaTexture(scene: BABYLON.Scene, data: Uint8Array, width: number, height: number): BABYLON.RawTexture {
  const texture = new BABYLON.RawTexture(
    data,
    width,
    height,
    BABYLON.Engine.TEXTUREFORMAT_RGBA,
    scene,
    false,
    false,
    BABYLON.Texture.NEAREST_SAMPLINGMODE
  )
  texture.wrapU = BABYLON.Texture.CLAMP_ADDRESSMODE
  texture.wrapV = BABYLON.Texture.CLAMP_ADDRESSMODE
  return texture
}

function getPingPongFrame(frame: number, frameCount: number): number {
  const cycle = (frameCount - 1) * 2
  const position = frame % cycle
  return position < frameCount ? position : cycle - position
}

export async function mountBabylonTerrainPrototype(root: HTMLElement): Promise<void> {
  Object.assign(root.style, { position: 'relative', width: '100vw', height: '100vh', overflow: 'hidden' })
  document.body.style.margin = '0'
  const canvas = document.createElement('canvas')
  canvas.tabIndex = 0
  Object.assign(canvas.style, { width: '100%', height: '100%', display: 'block', outline: 'none' })
  root.appendChild(canvas)
  const hud = createHud(root)
  const timings: Array<[string, number]> = []
  const measure = async <T>(label: string, step: () => T | Promise<T>): Promise<T> => {
    hud.textContent = `Chargement : ${label}…`
    await new Promise(resolve => requestAnimationFrame(resolve))
    const startedAt = performance.now()
    const result = await step()
    timings.push([label, performance.now() - startedAt])
    return result
  }

  const params = new URLSearchParams(window.location.search)
  const mapPath = params.get('map') || DEFAULT_MAP_PATH
  const [blueprint, cells, resourcesConfig] = await measure('fetch + JSON', () =>
    Promise.all([
      fetchJson<TerrainBlueprint>(mapPath),
      fetchJson<CellsConfig>('assets/data/gameplay/cells.json'),
      fetchJson<ResourcesConfig>('assets/data/gameplay/resources.json'),
    ])
  )
  const gridSize = blueprint.size + 1
  const { types, relief } = await measure('décodage base64', () => {
    const types = decodeBase64(blueprint.terrain)
    const relief = new Int8Array(decodeBase64(blueprint.relief).buffer)
    if (types.length !== gridSize * gridSize || relief.length !== types.length) throw new Error('Invalid terrain size')
    for (let index = 0; index < types.length; index++) if (types[index] === LEGACY_WATER) types[index] = WATER
    return { types, relief }
  })
  const loadSheet = createSheetLoader()
  const atlas = await measure('atlas de tuiles', () => buildTerrainAtlas(cells, loadSheet))
  const borderAtlas = await measure('atlas de bordures', () => buildBorderAtlas(loadSheet))
  const waterSurface = await measure('surface de l’eau', async () => (await loadSheet(WATER_SURFACE_SHEET)).image)
  const cellData = await measure('texture de cellules', () =>
    buildCellData(types, relief, gridSize, atlas.variantCounts, blueprint.seed ?? 0)
  )
  const borders = await measure('bordures (cellules)', () =>
    buildBorderData(blueprint.terrainAppearanceData, blueprint.size)
  )
  const heights = await measure('hauteurs', () => buildCornerHeights(types, relief, gridSize))
  // Relief styles: sloped plateaus by default; ?terraces = vertical cliffs, ?smooth-relief = fully smoothed hills.
  const smoothRelief = params.has('smooth-relief')
  const terraces = params.has('terraces')
  const slopeField = createSlopeField(types, relief, gridSize)
  const cellHeights = terraces ? buildCellHeights(types, relief) : new Float32Array(types.length)
  if (!terraces) {
    for (let i = 0; i < gridSize; i++)
      for (let j = 0; j < gridSize; j++) cellHeights[i * gridSize + j] = slopeField(i + 0.5, j + 0.5)
  }

  // The canvas is rendered without MSAA; its low-resolution pixels stay crisp.
  const engine = new BABYLON.Engine(canvas, false, { stencil: false, preserveDrawingBuffer: false }, true)
  const scene = new BABYLON.Scene(engine)
  // Handy from the devtools console while the prototype is being tuned.
  ;(window as unknown as { babylonScene?: BABYLON.Scene }).babylonScene = scene
  scene.clearColor = new BABYLON.Color4(0.05, 0.06, 0.08, 1)
  scene.skipPointerMovePicking = true
  scene.autoClearDepthAndStencil = true

  const sunDirection = new BABYLON.Vector3(-0.5, 0.8, 0.35)
  const sky = new BABYLON.HemisphericLight('model sky', BABYLON.Vector3.Up(), scene)
  sky.intensity = 0.65
  sky.groundColor = new BABYLON.Color3(0.35, 0.35, 0.4)
  const sun = new BABYLON.DirectionalLight('model sun', sunDirection.normalizeToNew().scale(-1), scene)
  sun.intensity = 0.75
  sun.shadowFrustumSize = 32
  sun.shadowMinZ = 0.1
  sun.shadowMaxZ = 90
  const shadows = new BABYLON.ShadowGenerator(2048, sun)
  shadows.filter = BABYLON.ShadowGenerator.FILTER_NONE
  shadows.bias = 0.0005
  shadows.normalBias = 0.02
  shadows.setDarkness(0.38)
  const shadowTexture = shadows.getShadowMapForRendering()
  if (!shadowTexture) throw new Error('Shadow map could not be created')
  const buddyShadowCasters: BABYLON.AbstractMesh[] = []
  const castBuddyShadow = (mesh: BABYLON.AbstractMesh) => buddyShadowCasters.push(mesh)

  BABYLON.Effect.ShadersStore.babylonTerrainVertexShader = VERTEX_SHADER
  BABYLON.Effect.ShadersStore.babylonTerrainFragmentShader = FRAGMENT_SHADER
  const material = new BABYLON.ShaderMaterial(
    'terrain',
    scene,
    { vertex: 'babylonTerrain', fragment: 'babylonTerrain' },
    {
      attributes: ['position', 'normal'],
      uniforms: [
        'worldViewProjection',
        'shadowMatrix',
        'shadowDepth',
        'shadowPacked',
        'shadowDebug',
        'heightScale',
        'gridSize',
        'atlasGrid',
        'sunDirection',
        'waterColor',
        'waterPhase',
        'showGrid',
        'showBorders',
        'waterType',
        'slopeLight',
        'drawnRelief',
        'modelStyle',
      ],
      samplers: ['cellData', 'borderData', 'atlas', 'averageColors', 'borderAtlas', 'waterSurface', 'shadowMap'],
    }
  )
  material.backFaceCulling = false
  material.setTexture('cellData', createRgbaTexture(scene, cellData, gridSize, gridSize))
  material.setTexture('borderData', createRgbaTexture(scene, borders.data, gridSize, gridSize))
  material.setTexture('atlas', createRgbaTexture(scene, atlas.pixels, atlas.columns * TILE, atlas.rows * TILE))
  material.setTexture('averageColors', createRgbaTexture(scene, atlas.averages, atlas.columns, atlas.rows))
  material.setTexture('borderAtlas', createRgbaTexture(scene, borderAtlas, BORDER_COLUMNS * TILE, BORDER_ROWS * TILE))
  material.setTexture(
    'waterSurface',
    createRgbaTexture(scene, new Uint8Array(waterSurface.data.buffer), waterSurface.width, waterSurface.height)
  )
  material.setFloat('gridSize', gridSize)
  material.setVector2('atlasGrid', new BABYLON.Vector2(atlas.columns, atlas.rows))
  material.setVector3('sunDirection', sunDirection)
  material.setTexture('shadowMap', shadowTexture)
  const caps = engine.getCaps()
  const shadowPacked = caps.textureHalfFloatRender && caps.textureHalfFloatLinearFiltering ||
    caps.textureFloatRender && caps.textureFloatLinearFiltering ? 0 : 1
  material.setFloat('shadowPacked', shadowPacked)
  material.setFloat('shadowDebug', params.has('shadow-debug') ? 1 : 0)
  // Directional lights store orthographic depth in clip space (-1..1 on WebGL),
  // independent of their shadowMinZ/shadowMaxZ projection distances.
  const depthMin = sun.getDepthMinZ(null)
  const shadowDepth = new BABYLON.Vector2(depthMin, depthMin + sun.getDepthMaxZ(null))
  material.setVector2('shadowDepth', shadowDepth)
  material.setColor3(
    'waterColor',
    BABYLON.Color3.FromHexString(
      `#${getEnvironmentTerrainParams(blueprint.environment).waterBackgroundColor.toString(16).padStart(6, '0')}`
    )
  )
  material.setFloat('waterType', WATER)
  let heightScale = DEFAULT_HEIGHT_SCALE
  let showGrid = false
  let showBorders = true
  material.setFloat('heightScale', heightScale)
  material.setFloat('showGrid', 0)
  material.setFloat('showBorders', 1)
  material.setFloat('slopeLight', 1)
  material.setFloat('drawnRelief', 0)
  material.setFloat('modelStyle', 0)

  const { meshes, triangles } = await measure('meshes (chunks)', () =>
    smoothRelief
      ? buildChunkMeshes(scene, material, types, heights, gridSize)
      : terraces
        ? buildTerraceMeshes(scene, material, types, cellHeights, gridSize)
        : buildSlopeMeshes(scene, material, types, relief, gridSize, slopeField)
  )
  const resourceLayer = await measure('ressources', () =>
    createResourceLayer({
      scene,
      resources: blueprint.resources ?? [],
      config: resourcesConfig,
      loadSheet,
      types,
      heights,
      cellHeights: smoothRelief ? undefined : cellHeights,
      gridSize,
      chunkCells: CHUNK_CELLS,
      seed: blueprint.seed ?? 0,
      maxHeightScale: MAX_HEIGHT_SCALE,
    })
  )
  resourceLayer.setHeightScale(heightScale)
  const modelLayer = await measure('modèles 3D', () =>
    createModelLayer({
      scene,
      resources: blueprint.resources ?? [],
      heights,
      cellHeights: smoothRelief ? undefined : cellHeights,
      gridSize,
      seed: blueprint.seed ?? 0,
      sunDirection,
    })
  )
  modelLayer.setHeightScale(heightScale)
  const projectedLayer = await measure('modèles projetés', () =>
    createModelLayer({
      scene,
      resources: blueprint.resources ?? [],
      heights,
      cellHeights: smoothRelief ? undefined : cellHeights,
      gridSize,
      seed: blueprint.seed ?? 0,
      sunDirection,
      projectedSprites: true,
    })
  )
  projectedLayer.setHeightScale(heightScale)
  // M cycles sprites → Kenney models → Kenney models dressed in crops of the game sprites.
  // ?models / ?projected pick the starting mode.
  const resourceModes = [
    { label: 'sprites', layer: resourceLayer },
    { label: 'modèles 3D Kenney', layer: modelLayer },
    { label: 'modèles 3D + texture du sprite (sapins)', layer: projectedLayer },
  ]
  let showResources = true
  let resourceMode = params.has('projected') ? 2 : params.has('models') ? 1 : 0
  let modelGroundDetails: ReturnType<typeof createModelGroundDetails> | null = null
  const syncResourceLayers = () => {
    resourceModes.forEach((mode, index) => mode.layer.setVisible(showResources && index === resourceMode))
    material.setFloat('modelStyle', resourceMode === 1 ? 1 : 0)
    modelGroundDetails?.mesh.setEnabled(resourceMode === 1)
  }
  syncResourceLayers()

  const terrainCell = (x: number, z: number) => {
    const i = Math.floor(x)
    const j = Math.floor(-z)
    return i >= 0 && j >= 0 && i < gridSize && j < gridSize ? i * gridSize + j : -1
  }
  const canMoveTo = (x: number, z: number) => {
    const cell = terrainCell(x, z)
    return cell >= 0 && types[cell] !== WATER && types[cell] !== ABSENT
  }
  const groundHeight = (x: number, z: number) => {
    const i = Math.max(0, Math.min(gridSize - 1, Math.floor(x)))
    const j = Math.max(0, Math.min(gridSize - 1, Math.floor(-z)))
    if (terraces) return cellHeights[i * gridSize + j] * heightScale
    if (!smoothRelief) return slopeField(x, -z) * heightScale
    const a = Math.min(gridSize - 1, Math.max(0, x))
    const b = Math.min(gridSize - 1, Math.max(0, -z))
    const ai = Math.floor(a)
    const bi = Math.floor(b)
    const tx = a - ai
    const tz = b - bi
    const span = gridSize + 1
    const h00 = heights[ai * span + bi]
    const h10 = heights[(ai + 1) * span + bi]
    const h01 = heights[ai * span + bi + 1]
    const h11 = heights[(ai + 1) * span + bi + 1]
    return ((h00 * (1 - tx) + h10 * tx) * (1 - tz) + (h01 * (1 - tx) + h11 * tx) * tz) * heightScale
  }
  modelGroundDetails = createModelGroundDetails(scene, types, gridSize, groundHeight)
  syncResourceLayers()

  // Default: a locked isometric camera that reads like the 2D game (orthographic, 45° yaw / 30° pitch, pan + zoom,
  // optional 90° turns, pixel-snapped low-resolution rendering). ?free-camera restores the free perspective debug view.
  const freeCamera = params.has('free-camera')
  const ISO_ALPHA = -Math.PI / 4
  const ISO_BETA = Math.PI / 3
  const ISO_DISTANCE = 600 // far enough that the near plane never cuts trees, the zoom is the ortho size
  const camera = new BABYLON.ArcRotateCamera(
    'camera',
    ISO_ALPHA,
    ISO_BETA,
    freeCamera ? Number(params.get('distance')) || 30 : ISO_DISTANCE,
    new BABYLON.Vector3(gridSize / 2, 0, -gridSize / 2),
    scene
  )
  // ?at=i,j centres the camera on a cell.
  const [atI, atJ] = (params.get('at') ?? '').split(',').map(Number)
  if (Number.isFinite(atI) && Number.isFinite(atJ)) camera.target.set(atI, 0, -atJ)
  const requestedSpawn = Number.isFinite(atI) && Number.isFinite(atJ) && canMoveTo(atI + 0.5, -(atJ + 0.5))
    ? { i: atI, j: atJ } : null
  const spawn = requestedSpawn ?? blueprint.spawns?.find(cell => canMoveTo(cell.i + 0.5, -(cell.j + 0.5)))
  let buddy: TerrainBuddy | null = null
  let buddySprite: ReturnType<typeof createTerrainBuddySprite> | null = null
  const hero2D = params.has('hero2D')
  if (!freeCamera && !params.has('no-buddy') && spawn) {
    const start = new BABYLON.Vector3(spawn.i + 0.5, 0, -(spawn.j + 0.5))
    start.y = groundHeight(start.x, start.z)
    buddy = await measure('Buddy', () => createTerrainBuddy(scene, start, canMoveTo, groundHeight, castBuddyShadow, {
      texture: shadowTexture,
      matrix: () => shadows.getTransformMatrix(),
      depth: shadowDepth,
      packed: shadowPacked,
    }, { visualMode: hero2D ? '2d' : '3d' }))
    if (hero2D) buddySprite = createTerrainBuddySprite(scene)
    else if (params.has('buddy-pixels')) installBuddyPixelation(scene, camera, engine, buddyShadowCasters)
    camera.target.copyFrom(start)
    if (!hero2D) createBuddyEquipmentControls(root, buddy)
  }
  if (buddy && !params.has('hud')) {
    hud.style.display = 'none'
    const hudToggle = document.createElement('button')
    hudToggle.type = 'button'
    hudToggle.textContent = 'Aide / infos'
    hudToggle.setAttribute('aria-expanded', 'false')
    Object.assign(hudToggle.style, {
      position: 'absolute', top: '8px', left: '8px', zIndex: '11',
      padding: '6px 9px', background: 'rgba(0, 0, 0, 0.65)', color: '#f2f2f2',
      border: '1px solid rgba(255, 255, 255, 0.35)', borderRadius: '4px', cursor: 'pointer',
    })
    hudToggle.addEventListener('click', () => {
      const expanded = hud.style.display === 'none'
      hud.style.display = expanded ? 'block' : 'none'
      hud.style.top = expanded ? '40px' : '8px'
      hudToggle.setAttribute('aria-expanded', String(expanded))
    })
    root.appendChild(hudToggle)
  }
  camera.minZ = 0.5
  camera.maxZ = freeCamera ? gridSize * 4 : ISO_DISTANCE * 2 + gridSize * 2
  let rotation = 0
  // Half the visible height in world units; the mouse wheel scales it.
  let zoom = (Number(params.get('distance')) || 12) * 0.45
  const MIN_ZOOM = 2
  const MAX_ZOOM = gridSize * 0.7
  // Default to the display's native resolution so source sprite pixels keep
  // their sharp edges; coarser pixel scales remain available with P/?pixel=.
  const PIXEL_SCALES = [1, 2, 3]
  let pixelScale = freeCamera ? 1 : Math.max(1, Number(params.get('pixel')) || 1)
  const applyPixelScale = () => {
    engine.setHardwareScalingLevel(pixelScale / (window.devicePixelRatio || 1))
    canvas.style.imageRendering = 'pixelated'
  }
  applyPixelScale()
  // The logical target follows input; the camera sits on it snapped to whole screen pixels so the scene never shimmers.
  const logicalTarget = camera.target.clone()
  const shadowMap = shadows.getShadowMap()
  const modelShadowCandidates = [...modelLayer.meshes, ...projectedLayer.meshes]
  // Keep a spatial index so only nearby sprite silhouettes enter the shadow map.
  const shadowBuckets = new Map<number, typeof resourceLayer.shadowSources>()
  const bucketSide = 16
  const bucketsPerSide = Math.ceil(gridSize / bucketSide)
  for (const source of resourceLayer.shadowSources) {
    const key = Math.floor(source.x / bucketSide) * bucketsPerSide + Math.floor(-source.z / bucketSide)
    let bucket = shadowBuckets.get(key)
    if (!bucket) shadowBuckets.set(key, (bucket = []))
    bucket.push(source)
  }
  const refreshSpriteShadows = (center: BABYLON.Vector3, radius: number) => {
    const nearby: typeof resourceLayer.shadowSources = []
    const minI = Math.max(0, Math.floor((center.x - radius) / bucketSide))
    const maxI = Math.min(bucketsPerSide - 1, Math.floor((center.x + radius) / bucketSide))
    const minJ = Math.max(0, Math.floor((-center.z - radius) / bucketSide))
    const maxJ = Math.min(bucketsPerSide - 1, Math.floor((-center.z + radius) / bucketSide))
    for (let i = minI; i <= maxI; i++) for (let j = minJ; j <= maxJ; j++) {
      for (const source of shadowBuckets.get(i * bucketsPerSide + j) ?? []) {
        if ((source.x - center.x) ** 2 + (source.z - center.z) ** 2 > radius * radius) continue
        nearby.push(source)
      }
    }
    resourceLayer.refreshShadowCaster(nearby, camera, heightScale)
  }
  let shadowCasterRefresh = 0
  let pointerPosition: { x: number; y: number } | null = null
  let cursorPoint: BABYLON.Vector3 | null = null
  const rememberPointer = (event: PointerEvent) => {
    pointerPosition = { x: event.clientX, y: event.clientY }
  }
  if (buddy) {
    canvas.addEventListener('pointermove', rememberPointer)
    buddy.bindPointer(canvas, event => {
      rememberPointer(event)
      canvas.focus({ preventScroll: true })
    })
  }
  const projectPointer = () => {
    if (!buddy || !pointerPosition) return null
    const bounds = canvas.getBoundingClientRect()
    const ray = scene.createPickingRay(pointerPosition.x - bounds.left, pointerPosition.y - bounds.top,
      BABYLON.Matrix.Identity(), camera)
    let height = buddy.root.position.y
    let point: BABYLON.Vector3 | null = null
    for (let step = 0; step < 3; step++) {
      const distance = ray.intersectsPlane(new BABYLON.Plane(0, 1, 0, -height))
      if (distance === null || distance < 0) return null
      point = ray.origin.add(ray.direction.scale(distance))
      height = groundHeight(point.x, point.z)
    }
    return point
  }

  if (freeCamera) {
    camera.lowerRadiusLimit = 8
    camera.upperRadiusLimit = gridSize * 1.6
    camera.upperBetaLimit = Math.PI / 2.2
    camera.wheelDeltaPercentage = 0.02
    camera.mapPanning = true
    camera.attachControl()
    camera.keysUp = camera.keysDown = camera.keysLeft = camera.keysRight = []
  } else {
    camera.mode = BABYLON.Camera.ORTHOGRAPHIC_CAMERA
    material.setFloat('drawnRelief', 1)
    heightScale = ISO_HEIGHT_SCALE
    material.setFloat('heightScale', heightScale)
    for (const layer of [resourceLayer, modelLayer, projectedLayer]) layer.setHeightScale(heightScale)
    // The mouse aims and attacks when Buddy is present. Map dragging remains for terrain-only inspection.
    let dragging: { startX: number; startY: number; x: number; y: number; active: boolean } | null = null
    canvas.addEventListener('pointerdown', event => {
      if (buddy) return
      dragging = { startX: event.clientX, startY: event.clientY, x: event.clientX, y: event.clientY, active: false }
      canvas.setPointerCapture(event.pointerId)
    })
    canvas.addEventListener('pointerup', () => (dragging = null))
    canvas.addEventListener('pointercancel', () => (dragging = null))
    canvas.addEventListener('contextmenu', event => event.preventDefault())
    canvas.addEventListener('pointermove', event => {
      if (!dragging) return
      if (!dragging.active) {
        const dx = event.clientX - dragging.startX
        const dy = event.clientY - dragging.startY
        if (dx * dx + dy * dy < 16) return
        dragging.active = true
      }
      const worldPerCssPixel = (2 * zoom) / canvas.clientHeight
      panBy(-(event.clientX - dragging.x) * worldPerCssPixel, (event.clientY - dragging.y) * worldPerCssPixel)
      dragging.x = event.clientX
      dragging.y = event.clientY
    })
    canvas.addEventListener(
      'wheel',
      event => {
        event.preventDefault()
        zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom * Math.exp(event.deltaY * 0.0015)))
      },
      { passive: false }
    )
  }

  /** Ground directions for the current heading: screen-right, and screen-up (away from the viewer). */
  function groundAxes(): { right: BABYLON.Vector3; forward: BABYLON.Vector3 } {
    const forward = new BABYLON.Vector3(-Math.cos(camera.alpha), 0, -Math.sin(camera.alpha))
    return { right: new BABYLON.Vector3(forward.z, 0, -forward.x), forward }
  }

  /** Moves by a screen-space offset in world units (dy > 0 = up the screen). */
  function panBy(dx: number, dy: number): void {
    const { right, forward } = groundAxes()
    // A ground step away from the viewer shows up foreshortened by sin(30°) on screen.
    logicalTarget.addInPlace(right.scale(dx)).addInPlace(forward.scale(dy / Math.cos(ISO_BETA)))
  }

  const pressed = new Set<string>()
  window.addEventListener('keydown', event => {
    if (event.target instanceof HTMLElement && event.target.closest('input, select, button')) return
    pressed.add(event.code)
    if (event.code === 'Space' && buddy) event.preventDefault()
    if (event.code === 'KeyG') {
      showGrid = !showGrid
      material.setFloat('showGrid', showGrid ? 1 : 0)
    }
    if (event.code === 'KeyV') {
      showResources = !showResources
      syncResourceLayers()
    }
    if (event.code === 'KeyM') {
      resourceMode = (resourceMode + 1) % resourceModes.length
      syncResourceLayers()
    }
    if (event.code === 'KeyB') {
      showBorders = !showBorders
      material.setFloat('showBorders', showBorders ? 1 : 0)
    }
    if (freeCamera && event.code === 'KeyO') {
      camera.mode =
        camera.mode === BABYLON.Camera.ORTHOGRAPHIC_CAMERA
          ? BABYLON.Camera.PERSPECTIVE_CAMERA
          : BABYLON.Camera.ORTHOGRAPHIC_CAMERA
    }
    if (freeCamera && event.code === 'KeyR') {
      camera.alpha = ISO_ALPHA
      camera.beta = ISO_BETA
    }
    // Physical Q/E keys (A/E on AZERTY) turn the iso view by 90°.
    if (!freeCamera && (event.code === 'KeyQ' || event.code === 'KeyE')) {
      rotation = (rotation + (event.code === 'KeyE' ? 1 : 3)) % 4
    }
    if (!freeCamera && event.code === 'KeyP') {
      pixelScale = PIXEL_SCALES[(PIXEL_SCALES.indexOf(pixelScale) + 1) % PIXEL_SCALES.length] ?? 1
      applyPixelScale()
    }
    const heightStep =
      ['+', '='].includes(event.key) || event.code === 'NumpadAdd'
        ? 1.25
        : ['-', '_'].includes(event.key) || event.code === 'NumpadSubtract'
          ? 0.8
          : event.code === 'Digit0' || event.code === 'Numpad0'
            ? -1
            : 0
    if (heightStep) {
      // 0 toggles a perfectly flat map; +/- scale from there (flat restarts from the 2D game's relief).
      heightScale =
        heightStep < 0
          ? heightScale > 0
            ? 0
            : ISO_HEIGHT_SCALE
          : Math.min(MAX_HEIGHT_SCALE, Math.max(MIN_HEIGHT_SCALE, (heightScale || ISO_HEIGHT_SCALE) * heightStep))
      material.setFloat('heightScale', heightScale)
      for (const layer of [resourceLayer, modelLayer, projectedLayer]) layer.setHeightScale(heightScale)
      modelGroundDetails.invalidate()
    }
  })
  window.addEventListener('keyup', event => pressed.delete(event.code))
  window.addEventListener('blur', () => pressed.clear())

  let presentCells = 0
  for (const type of types) if (type !== ABSENT) presentCells++
  let elapsed = 0
  let hudRefresh = 0
  const loadSummary = timings.map(([label, ms]) => `  ${label.padEnd(20)} ${ms.toFixed(0).padStart(5)} ms`).join('\n')
  scene.onBeforeRenderObservable.add(() => {
    const delta = engine.getDeltaTime() / 1000
    elapsed += delta
    material.setFloat('waterPhase', getPingPongFrame(Math.floor(elapsed * WATER_FRAMES_PER_SECOND), WATER_PHASES))

    // ZQSD (AZERTY) / WASD / arrows pan along the ground relative to the camera's heading.
    const forward =
      Number(pressed.has('KeyW') || pressed.has('ArrowUp')) - Number(pressed.has('KeyS') || pressed.has('ArrowDown'))
    const right =
      Number(pressed.has('KeyD') || pressed.has('ArrowRight')) - Number(pressed.has('KeyA') || pressed.has('ArrowLeft'))

    let buddyTravel = 0
    if (buddy && !freeCamera) {
      const { right: side, forward: heading } = groundAxes()
      const previousX = buddy.root.position.x
      const previousZ = buddy.root.position.z
      buddy.move(delta, side.scale(right).addInPlace(heading.scale(forward)),
        pressed.has('ShiftLeft') || pressed.has('ShiftRight'), pressed.has('KeyC'), pressed.has('Space'), cursorPoint)
      buddyTravel = Math.hypot(buddy.root.position.x - previousX, buddy.root.position.z - previousZ)
      logicalTarget.copyFrom(buddy.root.position)
    }

    if (freeCamera) {
      camera.panningSensibility = 40000 / camera.radius
      if (forward || right) {
        const speed = camera.radius * 0.9 * delta
        const { right: side, forward: heading } = groundAxes()
        camera.target.addInPlace(heading.scale(forward * speed)).addInPlace(side.scale(right * speed))
      }
      if (camera.mode === BABYLON.Camera.ORTHOGRAPHIC_CAMERA) {
        const halfHeight = camera.radius * 0.45
        const aspect = engine.getRenderWidth() / engine.getRenderHeight()
        camera.orthoTop = halfHeight
        camera.orthoBottom = -halfHeight
        camera.orthoLeft = -halfHeight * aspect
        camera.orthoRight = halfHeight * aspect
      }
    } else {
      if (!buddy && (forward || right)) panBy(right * zoom * 1.6 * delta, forward * zoom * 1.6 * delta)
      // Turn smoothly to the requested quarter, then lock there.
      const goal = ISO_ALPHA + (rotation * Math.PI) / 2
      const turn = Math.atan2(Math.sin(goal - camera.alpha), Math.cos(goal - camera.alpha))
      camera.alpha = Math.abs(turn) < 0.002 ? goal : camera.alpha + turn * Math.min(1, delta * 10)
      camera.beta = ISO_BETA
      camera.radius = ISO_DISTANCE
      const aspect = engine.getRenderWidth() / engine.getRenderHeight()
      camera.orthoTop = zoom
      camera.orthoBottom = -zoom
      camera.orthoLeft = -zoom * aspect
      camera.orthoRight = zoom * aspect
      // Snap the view to whole rendered pixels (only once a turn has settled).
      const worldPerPixel = (2 * zoom) / engine.getRenderHeight()
      const { right: axisX, forward: axisY } = groundAxes()
      let x = BABYLON.Vector3.Dot(logicalTarget, axisX)
      let y = BABYLON.Vector3.Dot(logicalTarget, axisY) * Math.cos(ISO_BETA)
      if (camera.alpha === goal) {
        x = Math.round(x / worldPerPixel) * worldPerPixel
        y = Math.round(y / worldPerPixel) * worldPerPixel
      }
      camera.target.copyFrom(axisX.scale(x).add(axisY.scale(y / Math.cos(ISO_BETA))))
      camera.target.y = logicalTarget.y
    }

    if (buddy) {
      cursorPoint = projectPointer()
      buddy.aim(delta, cursorPoint)
      buddySprite?.update(buddy.root.position, buddy.facingWorld(), camera, buddyTravel,
        Boolean(cursorPoint) || buddyTravel > 0.0001, buddy.spriteAction())
    }

    const showModelGrass = resourceMode === 1 && zoom < 25
    if (modelGroundDetails.mesh.isEnabled() !== showModelGrass) modelGroundDetails.mesh.setEnabled(showModelGrass)
    if (showModelGrass) {
      const visibleRadius = Math.min(30, zoom * (engine.getRenderWidth() / engine.getRenderHeight() + 1) * 1.5)
      modelGroundDetails.update(camera.target.x, camera.target.z, visibleRadius, visibleRadius)
    }

    // A fixed, camera-local light frustum avoids stretching one shadow map over the entire 1501² world.
    const shadowAnchor = camera.target
    const lightOffset = sunDirection.normalizeToNew().scale(35)
    sun.position.copyFrom(shadowAnchor.add(lightOffset))
    sun.shadowFrustumSize = Math.max(32, Math.min(90, zoom * 3.2))
    material.setMatrix('shadowMatrix', shadows.getTransformMatrix())
    shadowCasterRefresh -= delta
    if (shadowCasterRefresh <= 0 && shadowMap?.renderList) {
      shadowCasterRefresh = 0.25
      const radius = sun.shadowFrustumSize * 0.75 + 8
      shadowMap.renderList.length = 0
      shadowMap.renderList.push(...buddyShadowCasters.filter(mesh => mesh.isEnabled()))
      if (showResources && resourceMode === 0) {
        refreshSpriteShadows(shadowAnchor, radius)
        shadowMap.renderList.push(resourceLayer.shadowCaster)
        shadowMap.renderList.push(resourceLayer.trunkShadowCaster)
      }
      for (const mesh of modelShadowCandidates) {
        if (!mesh.isEnabled()) continue
        const bounds = mesh.getBoundingInfo().boundingBox
        const dx = Math.max(0, Math.abs(bounds.centerWorld.x - shadowAnchor.x) - bounds.extendSizeWorld.x)
        const dz = Math.max(0, Math.abs(bounds.centerWorld.z - shadowAnchor.z) - bounds.extendSizeWorld.z)
        if (dx * dx + dz * dz < radius * radius) shadowMap.renderList.push(mesh)
      }
    }

    resourceLayer.update(camera)

    hudRefresh -= delta
    if (hudRefresh > 0) return
    hudRefresh = 0.25
    hud.textContent = [
      `Babylon ${BABYLON.Engine.Version} — ${engine.description}`,
      `${mapPath}`,
      `grille ${gridSize}×${gridSize}, ${presentCells.toLocaleString()} cellules présentes (${blueprint.environment ?? '?'})`,
      `${borders.shores.toLocaleString()} rivages, ${borders.patches.toLocaleString()} transitions de sol`,
      `${resourceLayer.count.toLocaleString()} ressources : ${resourceModes[resourceMode].label} (${resourceModes[resourceMode].layer.meshes.length} meshes)`,
      `${meshes.length} chunks de ${CHUNK_CELLS}², ${triangles.toLocaleString()} triangles au total`,
      '',
      `FPS ${engine.getFps().toFixed(0)}   meshes visibles ${scene.getActiveMeshes().length}/${scene.meshes.length}`,
      freeCamera
        ? `caméra libre ${camera.mode === BABYLON.Camera.ORTHOGRAPHIC_CAMERA ? 'ortho' : 'perspective'}, distance ${camera.radius.toFixed(0)}`
        : `caméra iso verrouillée, rotation ${rotation * 90}°, zoom ${zoom.toFixed(1)}, pixels ×${pixelScale}`,
      `relief ${heightScale === 0 ? 'plat' : `×${heightScale.toFixed(2)} par niveau`}   bordures ${showBorders ? 'oui' : 'non'}`,
      ...(params.has('shadow-debug') ? [
        `ombre z=${BABYLON.Vector3.TransformCoordinates(camera.target, shadows.getTransformMatrix()).z.toFixed(3)} ` +
          `min=${sun.getDepthMinZ(camera).toFixed(2)} max=${sun.getDepthMaxZ(camera).toFixed(2)} casters=${shadowMap?.renderList?.length ?? 0}`,
      ] : []),
      '',
      'Temps de chargement :',
      loadSummary,
      '',
      ...(freeCamera
        ? [
            'ZQSD/WASD/flèches : déplacer   molette : zoom',
            'clic gauche : orbiter   clic droit : glisser',
            'O : ortho/perspective   R : vue iso',
          ]
        : [
            buddy
              ? 'ZQSD/WASD/flèches : Buddy   Shift : courir   C : s’accroupir   Espace : bloquer'
              : 'ZQSD/WASD/flèches ou glisser : déplacer   molette : zoom',
            ...(buddy ? ['souris : viser   clic : attaquer   maintenir : charger   molette : zoom'] : []),
            'A/E (AZERTY) = Q/E (QWERTY) : tourner de 90°   P : taille des pixels',
          ]),
      'G : grille   B : bordures   V : ressources   M : sprites/3D/stylisé',
      '+ / - : hauteur du relief   0 : terrain plat',
    ].join('\n')
  })

  engine.runRenderLoop(() => scene.render())
  window.addEventListener('resize', () => engine.resize())
}
