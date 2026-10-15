import * as BABYLON from '@babylonjs/core'
import '@babylonjs/loaders/glTF'
import { createDeterministicCellVariantPicker } from '../lib/random'
import { parseTextureName, type BlueprintResource, type ResourceLayer } from './babylonResourceLayer'

/**
 * Static resources drawn with low-poly CC0 models (Kenney Nature Kit) instead of 2D billboards.
 * Every model is merged into one mesh and drawn with thin instances, split into large map regions
 * so off-screen regions are still frustum-culled.
 */

const MODEL_ROOT = 'assets/prototypes/kenney-nature/'
// Models produced by scripts/sprite_to_model.py: Kenney geometry dressed in patchwork tiles cut from the game sprite.
const PROJECTED_PREFIX = 'projected:'
const PROJECTED_ROOT = 'assets/prototypes/sprite-projected/'
// Same granularity as the terrain chunks: a barely visible region still draws all its instances.
const REGION_CELLS = 64

type Category = {
  models: string[]
  /** Target height in cells (the average model of the category is scaled to it). */
  height: number
  /** Leafy trees follow the sprite frame so autumn sprites keep autumn models. */
  byFrame?: boolean
  tint?: [number, number, number]
}

const CATEGORIES: Record<string, Category> = {
  pine: {
    models: [
      'tree_pineTallA',
      'tree_pineTallB',
      'tree_pineTallC',
      'tree_pineTallD',
      'tree_pineRoundA',
      'tree_pineRoundC',
      'tree_pineDefaultA',
      'tree_pineDefaultB',
    ],
    height: 3.4,
  },
  leafy: { models: ['tree_default', 'tree_oak', 'tree_oak_fall', 'tree_detailed_fall'], height: 3, byFrame: true },
  palm: { models: ['tree_palmTall', 'tree_palmBend', 'tree_palmDetailedTall', 'tree_palmShort'], height: 3.3 },
  Stone: { models: ['stone_largeA', 'stone_largeB', 'stone_largeC', 'stone_largeD'], height: 0.6 },
  Gold: { models: ['stone_largeA', 'stone_largeC', 'stone_largeE'], height: 0.55, tint: [1.25, 1.0, 0.35] },
  Copper: { models: ['stone_largeB', 'stone_largeD', 'stone_largeF'], height: 0.55, tint: [1.15, 0.6, 0.4] },
  Iron: { models: ['stone_largeA', 'stone_largeB', 'stone_largeE'], height: 0.55, tint: [0.6, 0.6, 0.68] },
  Tin: { models: ['stone_largeC', 'stone_largeD', 'stone_largeF'], height: 0.55, tint: [1.05, 1.0, 0.88] },
  GroundStone: { models: ['stone_smallA', 'stone_smallB', 'stone_smallC', 'stone_smallD'], height: 0.2 },
  GroundWood: { models: ['log', 'stump_round', 'log_large'], height: 0.3 },
  Berrybush: { models: ['plant_bushDetailed', 'plant_bush'], height: 0.7 },
  herb: { models: ['grass_large', 'plant_flatTall', 'plant_bushSmall'], height: 0.5 },
  Wheat: { models: ['crops_wheatStageB'], height: 0.9 },
}

const PROJECTED_CATEGORIES: Record<string, Category> = {
  pine: {
    models: [0, 1, 2, 3].map(frame => `${PROJECTED_PREFIX}tree_dark-forest_00${frame}`),
    // Stylized crowns are as wide as ~90% of the tree's height: this keeps them about the sprite's width.
    height: 2.4,
    byFrame: true,
  },
}

// Kenney's palette leans teal; pull leaves toward the game's greens. Unlisted materials keep their glTF colour.
const PALETTE: Record<string, string> = {
  leafsDark: '#438937',
  leafsGreen: '#72b941',
  grass: '#7aae45',
}

function categoryOf(
  resource: BlueprintResource,
  categories: Record<string, Category>
): { key: string; frame: number } | null {
  if (resource.type === 'Tree') {
    const ref = resource.textureName ? parseTextureName(resource.textureName) : null
    const key = ref?.sheet.endsWith('/palm') ? 'palm' : ref?.sheet.endsWith('/grass') ? 'leafy' : 'pine'
    return { key, frame: ref?.frame ?? 0 }
  }
  if (['MedicinalHerb', 'ToxicHerb', 'FiberPlant'].includes(resource.type)) return { key: 'herb', frame: 0 }
  return categories[resource.type] ? { key: resource.type, frame: 0 } : null
}

type Template = { parts: BABYLON.Mesh[]; height: number; minY: number }

async function loadTemplate(
  scene: BABYLON.Scene,
  name: string,
  materials: Map<string, BABYLON.StandardMaterial>
): Promise<Template> {
  const projected = name.startsWith(PROJECTED_PREFIX)
  const result = await BABYLON.SceneLoader.ImportMeshAsync(
    '',
    projected ? PROJECTED_ROOT : MODEL_ROOT,
    `${projected ? name.slice(PROJECTED_PREFIX.length) : name}.glb`,
    scene
  )
  const parts = result.meshes.filter(
    (mesh): mesh is BABYLON.Mesh => mesh instanceof BABYLON.Mesh && mesh.getTotalVertices() > 0
  )
  // Swap the glTF PBR materials (metallic 1, unlit without an environment) for shared flat ones, keyed by name.
  // Projected models get their sprite texture straight from the PNG written beside the GLB (nearest, unlit:
  // the sprite already carries its pixel-art shading).
  for (const part of parts) {
    const source = part.material
    const key = projected ? `${name}:${source?.name ?? 'default'}` : (source?.name ?? 'default')
    let material = materials.get(key)
    if (!material) {
      material = new BABYLON.StandardMaterial(`model ${key}`, scene)
      material.specularColor = BABYLON.Color3.Black()
      // The baked glTF root is a mirror (determinant -1), which reverses every triangle's winding.
      material.sideOrientation = BABYLON.Material.CounterClockWiseSideOrientation
      if (projected) {
        // Patchwork models carry their own tiles (scripts/sprite_to_model.py): keep them, lit like the rest.
        const texture = source instanceof BABYLON.PBRMaterial ? source.albedoTexture : null
        if (texture instanceof BABYLON.Texture) texture.updateSamplingMode(BABYLON.Texture.NEAREST_SAMPLINGMODE)
        material.diffuseTexture = texture
        // Like the terrain shader: the sprite colour stays close to as drawn (≈×0.95 in shade, ≈×1.2 in full
        // sun) and the lights only add a little volume. Mostly-lit materials turned the dark palette near black.
        material.emissiveColor = new BABYLON.Color3(0.8, 0.8, 0.8)
        material.diffuseColor = new BABYLON.Color3(0.35, 0.35, 0.35)
      } else {
        const base = source instanceof BABYLON.PBRMaterial ? source.albedoColor : new BABYLON.Color3(0.7, 0.7, 0.7)
        material.diffuseColor = PALETTE[key] ? BABYLON.Color3.FromHexString(PALETTE[key]) : base.clone()
      }
      materials.set(key, material)
    }
    part.material = material
    // Keep the textures alive: the patchwork tiles now belong to the flat material.
    source?.dispose(false, !projected)
  }
  if (!parts.length) throw new Error(`Model ${name} has no geometry`)
  // Parts stay separate (MergeMeshes garbles some multi-primitive models); each gets the glTF root transform
  // (right- to left-handed conversion) baked into its vertices.
  let minY = Infinity
  let maxY = -Infinity
  // The glTF loader hands every primitive of a mesh the same position/normal arrays (one accessor). Baking
  // transforms those arrays in place, so give each part its own copy first, or the root transform would be
  // applied once per part (twice = undone, three times = mirrored).
  for (const part of parts) part.setParent(null)
  for (const part of parts) {
    for (const kind of [BABYLON.VertexBuffer.PositionKind, BABYLON.VertexBuffer.NormalKind]) {
      const data = part.getVerticesData(kind, true, true)
      if (data) part.setVerticesData(kind, Float32Array.from(data), false)
    }
    part.bakeCurrentTransformIntoVertices()
    // Opaque models: vertex alpha would push them into the sorted transparent pass (trees behind popping in front).
    part.hasVertexAlpha = false
    part.refreshBoundingInfo()
    const bounds = part.getBoundingInfo().boundingBox
    minY = Math.min(minY, bounds.minimum.y)
    maxY = Math.max(maxY, bounds.maximum.y)
    part.setEnabled(false)
    part.isPickable = false
  }
  result.meshes.forEach(mesh => parts.includes(mesh as BABYLON.Mesh) || mesh.dispose())
  return { parts, height: Math.max(0.01, maxY - minY), minY }
}

type Placement = {
  x: number
  z: number
  ground: number
  lift: number
  scale: number
  rotation: number
  tint?: Category['tint']
}

export async function createModelLayer(options: {
  scene: BABYLON.Scene
  resources: BlueprintResource[]
  heights: Float32Array
  /** Terraced terrain: each cell's own height (gridSize²), used instead of averaging its corners. */
  cellHeights?: Float32Array
  gridSize: number
  seed: string | number
  sunDirection: BABYLON.Vector3
  /** Swap the dark-forest pines for the sprite-projected models. */
  projectedSprites?: boolean
}): Promise<ResourceLayer> {
  const { cellHeights, scene, resources, heights, gridSize, seed, sunDirection, projectedSprites } = options
  const categories = projectedSprites ? { ...CATEGORIES, ...PROJECTED_CATEGORIES } : CATEGORIES
  // Several model layers can coexist (Kenney / projected); they share one pair of lights.
  if (!scene.getLightByName('model sun')) {
    const sky = new BABYLON.HemisphericLight('model sky', new BABYLON.Vector3(0, 1, 0), scene)
    sky.intensity = 0.65
    sky.groundColor = new BABYLON.Color3(0.35, 0.35, 0.4)
    const sun = new BABYLON.DirectionalLight('model sun', sunDirection.normalizeToNew().scale(-1), scene)
    sun.intensity = 0.75
  }

  const materials = new Map<string, BABYLON.StandardMaterial>()
  const modelNames = [...new Set(Object.values(categories).flatMap(category => category.models))]
  const templates = new Map(
    await Promise.all(modelNames.map(async name => [name, await loadTemplate(scene, name, materials)] as const))
  )
  materials.forEach(material => material.freeze())
  const categoryHeights = new Map(
    Object.entries(categories).map(([key, category]) => [
      key,
      category.models.reduce((sum, name) => sum + templates.get(name)!.height, 0) / category.models.length,
    ])
  )

  const cornerSize = gridSize + 1
  const groundHeight = (i: number, j: number) =>
    cellHeights
      ? cellHeights[i * gridSize + j]
      : (heights[i * cornerSize + j] +
          heights[(i + 1) * cornerSize + j] +
          heights[i * cornerSize + j + 1] +
          heights[(i + 1) * cornerSize + j + 1]) /
        4
  const pick = createDeterministicCellVariantPicker(seed)
  const jitter = createDeterministicCellVariantPicker(`${seed}:jitter`)
  const steps = Array.from({ length: 64 }, (_, index) => index / 63)
  const regionsPerSide = Math.ceil(gridSize / REGION_CELLS)

  const groups = new Map<string, { model: string; placements: Placement[] }>()
  let count = 0
  for (const resource of resources) {
    const match = categoryOf(resource, categories)
    if (!match) continue
    const category = categories[match.key]
    const model = category.byFrame
      ? category.models[match.frame % category.models.length]
      : pick(category.models, resource.i, resource.j)!
    const template = templates.get(model)!
    const size = 0.85 + 0.3 * jitter(steps, resource.i, resource.j)!
    const scale = (category.height / categoryHeights.get(match.key)!) * size
    const region = Math.floor(resource.i / REGION_CELLS) * regionsPerSide + Math.floor(resource.j / REGION_CELLS)
    const key = `${model}|${region}`
    let group = groups.get(key)
    if (!group) groups.set(key, (group = { model, placements: [] }))
    group.placements.push({
      x: resource.i + 0.5,
      z: -(resource.j + 0.5),
      // Ground follows the GPU relief scale; the model's own base lift does not.
      ground: groundHeight(resource.i, resource.j),
      lift: -template.minY * scale,
      scale,
      rotation: jitter(steps, resource.j, resource.i)! * Math.PI * 2,
      tint: category.tint,
    })
    count++
  }

  const meshes: BABYLON.Mesh[] = []
  const instanced: Array<{ mesh: BABYLON.Mesh; placements: Placement[]; matrices: Float32Array }> = []
  const matrix = new BABYLON.Matrix()
  const scaling = new BABYLON.Vector3()
  const rotation = new BABYLON.Quaternion()
  const translation = new BABYLON.Vector3()
  let heightScale = 1

  for (const { model, placements } of groups.values()) {
    const matrices = new Float32Array(placements.length * 16)
    const tinted = placements.some(placement => placement.tint)
    const colors = new Float32Array(tinted ? placements.length * 4 : 0)
    if (tinted) placements.forEach((placement, index) => colors.set([...(placement.tint ?? [1, 1, 1]), 1], index * 4))
    for (const part of templates.get(model)!.parts) {
      const mesh = part.clone(`${part.name} region`)
      // Thin-instance buffers live on the geometry: shared geometry would let regions overwrite each other's matrices.
      mesh.makeGeometryUnique()
      mesh.setEnabled(true)
      mesh.isPickable = false
      mesh.receiveShadows = true
      instanced.push({ mesh, placements, matrices })
      if (tinted) mesh.thinInstanceSetBuffer('color', colors, 4, true)
      meshes.push(mesh)
    }
  }

  const refresh = () => {
    for (const { mesh, placements, matrices } of instanced) {
      placements.forEach((placement, index) => {
        scaling.setAll(placement.scale)
        BABYLON.Quaternion.RotationYawPitchRollToRef(placement.rotation, 0, 0, rotation)
        translation.set(placement.x, placement.ground * heightScale + placement.lift, placement.z)
        BABYLON.Matrix.ComposeToRef(scaling, rotation, translation, matrix)
        matrix.copyToArray(matrices, index * 16)
      })
      mesh.thinInstanceSetBuffer('matrix', matrices, 16, false)
      mesh.thinInstanceRefreshBoundingInfo(false)
    }
  }
  refresh()

  return {
    meshes,
    count,
    setHeightScale: scale => {
      heightScale = scale
      refresh()
    },
    setVisible: visible => meshes.forEach(mesh => mesh.setEnabled(visible)),
    update: () => {},
  }
}
