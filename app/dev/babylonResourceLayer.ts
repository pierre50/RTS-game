import * as BABYLON from '@babylonjs/core'
import { TERRAIN_TYPES } from '../constants/blueprintTerrain'
import { createDeterministicCellVariantPicker } from '../lib/random'
import { getFrame, type Sheet } from './babylonSheets'

/**
 * Static resources of a map blueprint drawn as upright camera-facing sprites (cylindrical billboards),
 * one static mesh per terrain chunk so they share the terrain's frustum culling. All frames live in one atlas,
 * so the whole layer is a single material and a few hundred draw calls at most.
 */

type TextureRef = { sheet: string; frame: number }
type ResourceAssets = string | TextureRef | TextureRef[] | Record<string, TextureRef[]>
export type ResourcesConfig = Record<string, { assets?: ResourceAssets; spriteScale?: number; isAnimated?: boolean }>
export type BlueprintResource = { type: string; i: number; j: number; textureName?: string; startsMature?: boolean }

// One world unit is a cell side; the game draws a cell diagonal (√2 units) as 64px.
export const WORLD_PER_PIXEL = 1 / (32 * Math.SQRT2)
// Upright quads are foreshortened by cos(30°) under the isometric camera; stretch them back to their 2D height.
const UPRIGHT_STRETCH = 1 / Math.cos(Math.PI / 6)
const ATLAS_WIDTH = 2048
const ATLAS_PADDING = 2
const BOUNDS_MARGIN = 4

const VERTEX_SHADER = `
precision highp float;
attribute vec3 position;
attribute vec2 corner;
attribute vec4 sprite;
attribute vec4 uvRect;
uniform mat4 viewProjection;
uniform vec3 cameraRight;
uniform vec3 cameraToward;
uniform float heightScale;
varying vec2 vUv;
void main(void) {
  // sprite = (width, height, anchorX, foot): the part of the sprite below its anchor is ground depth in 2D,
  // so the quad steps toward the camera by that much and the anchor lands back on the cell centre.
  vec3 base = vec3(position.x, position.y * heightScale, position.z) + cameraToward * sprite.w;
  vec3 world = base + cameraRight * ((corner.x - sprite.z) * sprite.x) + vec3(0.0, corner.y * sprite.y, 0.0);
  vUv = vec2(mix(uvRect.x, uvRect.z, corner.x), mix(uvRect.w, uvRect.y, corner.y));
  gl_Position = viewProjection * vec4(world, 1.0);
}
`

const FRAGMENT_SHADER = `
precision highp float;
varying vec2 vUv;
uniform sampler2D atlas;
void main(void) {
  vec4 color = texture2D(atlas, vUv);
  if (color.a < 0.5) discard;
  gl_FragColor = vec4(color.rgb, 1.0);
}
`

export function parseTextureName(textureName: string): TextureRef {
  const separator = textureName.indexOf('_')
  return { sheet: textureName.slice(separator + 1), frame: Number(textureName.slice(0, separator)) }
}

function resolveTexture(
  resource: BlueprintResource,
  config: ResourcesConfig,
  terrainType: string,
  pickVariant: <T>(items: T[] | undefined, i: number, j: number) => T | null,
  frameCounts: Map<string, number>
): TextureRef | null {
  if (resource.textureName) return parseTextureName(resource.textureName)
  const assets = config[resource.type]?.assets
  if (!assets) return null
  // A whole sheet is a growth animation (wheat): show its last frame when the blueprint says it starts mature.
  if (typeof assets === 'string') {
    return { sheet: assets, frame: resource.startsMature ? Math.max(0, (frameCounts.get(assets) ?? 1) - 1) : 0 }
  }
  if (Array.isArray(assets)) return pickVariant(assets, resource.i, resource.j)
  if ('sheet' in assets && typeof assets.sheet === 'string') return assets as TextureRef
  const byTerrain = assets as Record<string, TextureRef[]>
  return pickVariant(byTerrain[terrainType] ?? Object.values(byTerrain)[0], resource.i, resource.j)
}

function collectSheets(config: ResourcesConfig, resources: BlueprintResource[]): Set<string> {
  const sheets = new Set<string>()
  const add = (assets: ResourceAssets | undefined) => {
    if (!assets) return
    if (typeof assets === 'string') sheets.add(assets)
    else if (Array.isArray(assets)) assets.forEach(ref => sheets.add(ref.sheet))
    else if ('sheet' in assets && typeof assets.sheet === 'string') sheets.add(assets.sheet)
    else Object.values(assets as Record<string, TextureRef[]>).forEach(add)
  }
  Object.values(config).forEach(definition => add(definition.assets))
  for (const resource of resources) if (resource.textureName) sheets.add(parseTextureName(resource.textureName).sheet)
  return sheets
}

type AtlasEntry = {
  uv: [number, number, number, number]
  width: number
  height: number
  anchorX: number
  anchorY: number
}

/** Shelf-packs every frame actually referenced into one RGBA atlas. */
function packAtlas(
  refs: Iterable<TextureRef>,
  sheets: Map<string, Sheet>
): { pixels: Uint8Array; width: number; height: number; entries: Map<string, AtlasEntry> } {
  const placements: Array<{ key: string; sheet: Sheet; ref: TextureRef; x: number; y: number }> = []
  const entries = new Map<string, AtlasEntry>()
  let cursorX = 0
  let cursorY = 0
  let shelfHeight = 0
  for (const ref of refs) {
    const key = `${ref.sheet}#${ref.frame}`
    if (entries.has(key)) continue
    const sheet = sheets.get(ref.sheet)
    if (!sheet) continue
    const frame = getFrame(sheet, ref.frame, ref.sheet)
    if (cursorX + frame.frame.w + ATLAS_PADDING > ATLAS_WIDTH) {
      cursorX = 0
      cursorY += shelfHeight + ATLAS_PADDING
      shelfHeight = 0
    }
    placements.push({ key, sheet, ref, x: cursorX, y: cursorY })
    entries.set(key, {
      uv: [cursorX, cursorY, cursorX + frame.frame.w, cursorY + frame.frame.h],
      width: frame.frame.w,
      height: frame.frame.h,
      anchorX: frame.anchor?.x ?? 0.5,
      anchorY: frame.anchor?.y ?? 1,
    })
    cursorX += frame.frame.w + ATLAS_PADDING
    shelfHeight = Math.max(shelfHeight, frame.frame.h)
  }
  const height = 2 ** Math.ceil(Math.log2(Math.max(1, cursorY + shelfHeight)))
  const pixels = new Uint8Array(ATLAS_WIDTH * height * 4)
  for (const { key, sheet, ref, x, y } of placements) {
    const rect = getFrame(sheet, ref.frame, ref.sheet).frame
    for (let row = 0; row < rect.h; row++) {
      const source = ((rect.y + row) * sheet.image.width + rect.x) * 4
      pixels.set(sheet.image.data.subarray(source, source + rect.w * 4), ((y + row) * ATLAS_WIDTH + x) * 4)
    }
    const entry = entries.get(key)!
    entry.uv = [entry.uv[0] / ATLAS_WIDTH, entry.uv[1] / height, entry.uv[2] / ATLAS_WIDTH, entry.uv[3] / height]
  }
  return { pixels, width: ATLAS_WIDTH, height, entries }
}

export type ResourceLayer = {
  meshes: BABYLON.Mesh[]
  count: number
  setHeightScale(scale: number): void
  setVisible(visible: boolean): void
  update(camera: BABYLON.ArcRotateCamera): void
}

export type SpriteResourceLayer = ResourceLayer & {
  shadowSources: Array<{
    x: number; z: number; y: number; width: number; height: number; anchorX: number; foot: number
    isTree: boolean
    uv: [number, number, number, number]
  }>
  shadowCaster: BABYLON.Mesh
  trunkShadowCaster: BABYLON.Mesh
  refreshShadowCaster(sources: SpriteResourceLayer['shadowSources'], camera: BABYLON.ArcRotateCamera, heightScale: number): void
}

export async function createResourceLayer(options: {
  scene: BABYLON.Scene
  resources: BlueprintResource[]
  config: ResourcesConfig
  loadSheet: (sheet: string) => Promise<Sheet>
  types: Uint8Array
  heights: Float32Array
  /** Terraced terrain: each cell's own height (gridSize²), used instead of averaging its corners. */
  cellHeights?: Float32Array
  gridSize: number
  chunkCells: number
  seed: string | number
  maxHeightScale: number
}): Promise<SpriteResourceLayer> {
  const {
    cellHeights,
    scene,
    resources,
    config,
    loadSheet,
    types,
    heights,
    gridSize,
    chunkCells,
    seed,
    maxHeightScale,
  } = options
  const sheetNames = collectSheets(config, resources)
  const sheets = new Map<string, Sheet>()
  await Promise.all([...sheetNames].map(async name => sheets.set(name, await loadSheet(`graphics/${name}`))))
  const frameCounts = new Map([...sheets].map(([name, sheet]) => [name, Object.keys(sheet.json.frames).length]))

  const pickVariant = createDeterministicCellVariantPicker(seed)
  const placed: Array<{ resource: BlueprintResource; ref: TextureRef; key: string }> = []
  for (const resource of resources) {
    const cell = resource.i * gridSize + resource.j
    const terrainType = TERRAIN_TYPES[types[cell]] ?? ''
    const ref = resolveTexture(resource, config, terrainType, pickVariant, frameCounts)
    if (ref && sheets.has(ref.sheet)) placed.push({ resource, ref, key: `${ref.sheet}#${ref.frame}` })
  }
  const atlas = packAtlas(
    placed.map(entry => entry.ref),
    sheets
  )

  BABYLON.Effect.ShadersStore.babylonResourceVertexShader = VERTEX_SHADER
  BABYLON.Effect.ShadersStore.babylonResourceFragmentShader = FRAGMENT_SHADER
  const material = new BABYLON.ShaderMaterial(
    'resources',
    scene,
    { vertex: 'babylonResource', fragment: 'babylonResource' },
    {
      attributes: ['position', 'corner', 'sprite', 'uvRect'],
      uniforms: ['viewProjection', 'cameraRight', 'cameraToward', 'heightScale'],
      samplers: ['atlas'],
    }
  )
  material.backFaceCulling = false
  const texture = new BABYLON.RawTexture(
    atlas.pixels,
    atlas.width,
    atlas.height,
    BABYLON.Engine.TEXTUREFORMAT_RGBA,
    scene,
    true,
    false,
    BABYLON.Texture.NEAREST_LINEAR_MIPLINEAR
  )
  texture.wrapU = BABYLON.Texture.CLAMP_ADDRESSMODE
  texture.wrapV = BABYLON.Texture.CLAMP_ADDRESSMODE
  texture.hasAlpha = true
  material.setTexture('atlas', texture)

  // A local batch of alpha-tested upright quads casts each sprite's actual
  // silhouette. It has no colour/depth pass in the camera view.
  const shadowMaterial = new BABYLON.StandardMaterial('sprite shadow silhouettes', scene)
  shadowMaterial.diffuseTexture = texture
  shadowMaterial.transparencyMode = BABYLON.Material.MATERIAL_ALPHATEST
  shadowMaterial.alphaCutOff = 0.5
  shadowMaterial.backFaceCulling = false
  shadowMaterial.disableColorWrite = true
  shadowMaterial.disableDepthWrite = true
  const shadowCaster = new BABYLON.Mesh('nearby sprite shadow silhouettes', scene)
  shadowCaster.material = shadowMaterial
  shadowCaster.isPickable = false
  shadowCaster.setVerticesData(BABYLON.VertexBuffer.PositionKind, [], true, 3)
  shadowCaster.setVerticesData(BABYLON.VertexBuffer.UVKind, [], true, 2)
  shadowCaster.setIndices([])
  const trunkShadowMaterial = new BABYLON.StandardMaterial('sprite trunk shadows', scene)
  trunkShadowMaterial.backFaceCulling = false
  trunkShadowMaterial.disableColorWrite = true
  trunkShadowMaterial.disableDepthWrite = true
  const trunkShadowCaster = new BABYLON.Mesh('nearby sprite trunk shadows', scene)
  trunkShadowCaster.material = trunkShadowMaterial
  trunkShadowCaster.isPickable = false
  trunkShadowCaster.setVerticesData(BABYLON.VertexBuffer.PositionKind, [], true, 3)
  trunkShadowCaster.setIndices([])

  const cornerSize = gridSize + 1
  const groundHeight = (i: number, j: number) =>
    cellHeights
      ? cellHeights[i * gridSize + j]
      : (heights[i * cornerSize + j] +
          heights[(i + 1) * cornerSize + j] +
          heights[i * cornerSize + j + 1] +
          heights[(i + 1) * cornerSize + j + 1]) /
        4

  const chunksPerSide = Math.ceil(gridSize / chunkCells)
  const byChunk = new Map<number, typeof placed>()
  for (const entry of placed) {
    const chunk = Math.floor(entry.resource.i / chunkCells) * chunksPerSide + Math.floor(entry.resource.j / chunkCells)
    let list = byChunk.get(chunk)
    if (!list) byChunk.set(chunk, (list = []))
    list.push(entry)
  }

  const meshes: BABYLON.Mesh[] = []
  const shadowSources: SpriteResourceLayer['shadowSources'] = []
  for (const [chunk, list] of byChunk) {
    const count = list.length
    const positions = new Float32Array(count * 12)
    const corners = new Float32Array(count * 8)
    const sprites = new Float32Array(count * 16)
    const uvRects = new Float32Array(count * 16)
    const indices = new Uint32Array(count * 6)
    let minY = Infinity
    let maxY = -Infinity
    let maxSprite = 0
    list.forEach(({ resource, key }, index) => {
      const entry = atlas.entries.get(key)!
      const scale = config[resource.type]?.spriteScale ?? 1
      const width = entry.width * scale * WORLD_PER_PIXEL
      const height = entry.height * scale * WORLD_PER_PIXEL * UPRIGHT_STRETCH
      const foot = (1 - entry.anchorY) * entry.height * scale * WORLD_PER_PIXEL * 2
      const y = groundHeight(resource.i, resource.j)
      shadowSources.push({
        x: resource.i + 0.5, z: -(resource.j + 0.5), y, width, height,
        anchorX: entry.anchorX, foot, isTree: resource.type === 'Tree', uv: entry.uv,
      })
      minY = Math.min(minY, y)
      maxY = Math.max(maxY, y)
      maxSprite = Math.max(maxSprite, height, width)
      for (let vertex = 0; vertex < 4; vertex++) {
        const at = index * 4 + vertex
        positions.set([resource.i + 0.5, y, -(resource.j + 0.5)], at * 3)
        corners.set([vertex & 1, vertex >> 1], at * 2)
        sprites.set([width, height, entry.anchorX, foot], at * 4)
        uvRects.set(entry.uv, at * 4)
      }
      const first = index * 4
      indices.set([first, first + 1, first + 3, first, first + 3, first + 2], index * 6)
    })

    const mesh = new BABYLON.Mesh(`resources ${chunk}`, scene)
    mesh.setVerticesData(BABYLON.VertexBuffer.PositionKind, positions, false, 3)
    mesh.setVerticesData('corner', corners, false, 2)
    mesh.setVerticesData('sprite', sprites, false, 4)
    mesh.setVerticesData('uvRect', uvRects, false, 4)
    mesh.setIndices(indices)
    const i0 = Math.floor(chunk / chunksPerSide) * chunkCells
    const j0 = (chunk % chunksPerSide) * chunkCells
    // Billboards turn with the camera and the height scale lives on the GPU: bound them generously.
    mesh.setBoundingInfo(
      new BABYLON.BoundingInfo(
        new BABYLON.Vector3(
          i0 - BOUNDS_MARGIN,
          Math.min(minY * maxHeightScale, minY),
          -(j0 + chunkCells + BOUNDS_MARGIN)
        ),
        new BABYLON.Vector3(
          i0 + chunkCells + BOUNDS_MARGIN,
          Math.max(maxY * maxHeightScale, maxY) + maxSprite,
          -(j0 - BOUNDS_MARGIN)
        )
      )
    )
    mesh.doNotSyncBoundingInfo = true
    mesh.material = material
    mesh.isPickable = false
    mesh.freezeWorldMatrix()
    meshes.push(mesh)
  }

  const right = new BABYLON.Vector3()
  const toward = new BABYLON.Vector3()
  return {
    meshes,
    shadowSources,
    shadowCaster,
    trunkShadowCaster,
    count: placed.length,
    setHeightScale: scale => material.setFloat('heightScale', scale),
    setVisible: visible => meshes.forEach(mesh => mesh.setEnabled(visible)),
    update: camera => {
      toward.set(Math.cos(camera.alpha), 0, Math.sin(camera.alpha))
      right.set(-toward.z, 0, toward.x)
      material.setVector3('cameraToward', toward)
      material.setVector3('cameraRight', right)
    },
    refreshShadowCaster: (sources, camera, heightScale) => {
      const towardX = Math.cos(camera.alpha)
      const towardZ = Math.sin(camera.alpha)
      const rightX = -towardZ
      const rightZ = towardX
      const positions: number[] = []
      const uvs: number[] = []
      const indices: number[] = []
      const trunkPositions: number[] = []
      const trunkIndices: number[] = []
      for (const source of sources) {
        const first = positions.length / 3
        const x = source.x + towardX * source.foot
        const z = source.z + towardZ * source.foot
        const y = source.y * heightScale
        const left = -source.anchorX * source.width
        const right = left + source.width
        positions.push(
          x + rightX * left, y, z + rightZ * left,
          x + rightX * right, y, z + rightZ * right,
          x + rightX * left, y + source.height, z + rightZ * left,
          x + rightX * right, y + source.height, z + rightZ * right,
        )
        const [u0, v0, u1, v1] = source.uv
        uvs.push(u0, v1, u1, v1, u0, v0, u1, v0)
        indices.push(first, first + 1, first + 3, first, first + 3, first + 2)
        if (source.isTree) {
          // The sprite foliage casts the long canopy shadow. A narrow upright
          // trunk joins it to the same visual foot used by the sprite.
          const trunkFirst = trunkPositions.length / 3
          const halfWidth = Math.min(0.16, source.width * 0.07)
          const trunkHeight = source.height * 0.72
          trunkPositions.push(
            x - rightX * halfWidth, y, z - rightZ * halfWidth,
            x + rightX * halfWidth, y, z + rightZ * halfWidth,
            x - rightX * halfWidth, y + trunkHeight, z - rightZ * halfWidth,
            x + rightX * halfWidth, y + trunkHeight, z + rightZ * halfWidth,
          )
          trunkIndices.push(trunkFirst, trunkFirst + 1, trunkFirst + 3, trunkFirst, trunkFirst + 3, trunkFirst + 2)
        }
      }
      shadowCaster.setVerticesData(BABYLON.VertexBuffer.PositionKind, positions, true, 3)
      shadowCaster.setVerticesData(BABYLON.VertexBuffer.UVKind, uvs, true, 2)
      shadowCaster.setIndices(indices)
      shadowCaster.refreshBoundingInfo()
      trunkShadowCaster.setVerticesData(BABYLON.VertexBuffer.PositionKind, trunkPositions, true, 3)
      trunkShadowCaster.setIndices(trunkIndices)
      trunkShadowCaster.refreshBoundingInfo()
    },
  }
}
