import { MeshSimple, type Filter, type Texture } from 'pixi.js'
import { SHEET_TYPES } from '../../constants'
import type { UnitEntity } from '../../types/entities'

type PoseSprite = {
  alpha: number
  anchor: { x: number; y: number }
  currentFrame: number
  filters?: readonly Filter[] | null
  label?: string
  parent?: { addChild: (child: MeshSimple) => unknown } | null
  position: { x: number; y: number }
  scale: { x: number; y: number }
  texture: Texture
  textures: Texture[]
  visible: boolean
  zIndex: number
}

type LayeredUnit = UnitEntity & {
  appearanceLayerSprites?: Map<unknown, PoseSprite>
}

type PoseTarget = {
  compressLegs: boolean
  sprite: PoseSprite
}

type PoseState = {
  meshesBySprite: Map<PoseSprite, MeshSimple>
  previousAlphaBySprite: Map<PoseSprite, number>
  previousShadowScale?: { x: number; y: number }
  weight: number
}

const FRAME_HEIGHT = 64
const GRID_ROWS = 6
const GRID_COLUMNS = 2
const SOURCE_Y = [0, 16, 28, 42, 56, 64]
const BODY_POSE_Y = [4, 20, 32, 46, 57, 64]
const HELD_EQUIPMENT_OFFSET_Y = 4
const POSE_OFFSET_Y = 0
const STEALTH_WIDTH_SCALE = 1.03
const STEALTH_SHADOW_SCALE_X = 0.9
const STEALTH_SHADOW_SCALE_Y = 0.74
const SOURCE_DEBUG_ALPHA = 0
const MESH_DEBUG_ALPHA = 1
const POSE_TRANSITION_SPEED = 0.18

const crouchPoseStateByUnit = new WeakMap<UnitEntity, PoseState>()

function isHeldEquipmentKey(equipmentKey: string | undefined): boolean {
  return Boolean(
    equipmentKey &&
      (equipmentKey === 'bow' ||
        equipmentKey === 'bow_great' ||
        equipmentKey === 'bow_recurve' ||
        equipmentKey === 'halberd' ||
        equipmentKey === 'longsword' ||
        equipmentKey === 'cane' ||
        equipmentKey.startsWith('arrow_') ||
        equipmentKey.startsWith('axe_') ||
        equipmentKey.startsWith('hammer_') ||
        equipmentKey.startsWith('pickaxe_') ||
        equipmentKey.startsWith('round_shield_') ||
        equipmentKey.startsWith('scythe_') ||
        equipmentKey.startsWith('sword_'))
  )
}

function canApplyUnitCrouchPose(unit: UnitEntity): boolean {
  return Boolean(
    !unit.mountedOnHorse &&
      unit.sprite &&
      (unit.currentSheet === SHEET_TYPES.walking || unit.currentSheet === SHEET_TYPES.standing)
  )
}

function buildUvs(): Float32Array {
  const uvs: number[] = []
  const maxColumn = GRID_COLUMNS - 1
  for (let row = 0; row < GRID_ROWS; row++) {
    const v = SOURCE_Y[row] / FRAME_HEIGHT
    for (let column = 0; column < GRID_COLUMNS; column++) {
      uvs.push(column / maxColumn, v)
    }
  }
  return new Float32Array(uvs)
}

function buildIndices(): Uint32Array {
  const indices: number[] = []
  const maxColumn = GRID_COLUMNS - 1
  for (let row = 0; row < GRID_ROWS - 1; row++) {
    for (let column = 0; column < maxColumn; column++) {
      const topLeft = row * GRID_COLUMNS + column
      const topRight = topLeft + 1
      const bottomLeft = topLeft + GRID_COLUMNS
      const bottomRight = bottomLeft + 1
      indices.push(topLeft, topRight, bottomRight, topLeft, bottomRight, bottomLeft)
    }
  }
  return new Uint32Array(indices)
}

const MESH_UVS = buildUvs()
const MESH_INDICES = buildIndices()

function createPoseMesh(source: PoseSprite): MeshSimple {
  const mesh = new MeshSimple({
    texture: source.texture,
    vertices: new Float32Array(GRID_ROWS * GRID_COLUMNS * 2),
    uvs: MESH_UVS,
    indices: MESH_INDICES,
    topology: 'triangle-list',
  })
  mesh.label = `${source.label ?? 'unit'}-crouch-pose`
  mesh.eventMode = 'none'
  mesh.autoUpdate = true
  source.parent?.addChild(mesh)
  return mesh
}

function ensurePoseMesh(state: PoseState, source: PoseSprite): MeshSimple {
  let mesh = state.meshesBySprite.get(source)
  if (mesh) return mesh
  mesh = createPoseMesh(source)
  state.meshesBySprite.set(source, mesh)
  return mesh
}

function updateMeshVertices(
  mesh: MeshSimple,
  compressLegs: boolean,
  frameWidth: number,
  frameHeight: number,
  weight: number
): void {
  const vertices = mesh.vertices
  let index = 0
  const maxColumn = GRID_COLUMNS - 1
  const frameScale = frameHeight / FRAME_HEIGHT
  for (let row = 0; row < GRID_ROWS; row++) {
    const sourceY = SOURCE_Y[row]
    const bodyY = (sourceY + (BODY_POSE_Y[row] - sourceY) * weight) * frameScale
    const equipmentY = sourceY * frameScale + HELD_EQUIPMENT_OFFSET_Y * weight
    const y = compressLegs ? bodyY : equipmentY
    for (let column = 0; column < GRID_COLUMNS; column++) {
      vertices[index++] = (column / maxColumn) * frameWidth
      vertices[index++] = y
    }
  }
  mesh.vertices = vertices
}

function syncPoseSprite(unit: UnitEntity, state: PoseState, target: PoseTarget): void {
  const source = target.sprite
  const mesh = ensurePoseMesh(state, source)
  const texture = source.textures[source.currentFrame] ?? source.texture
  const frameWidth = texture.frame.width
  const frameHeight = texture.frame.height
  const sourceScaleX = source.scale.x
  const scaleX = sourceScaleX * (1 + (STEALTH_WIDTH_SCALE - 1) * state.weight)
  const scaleY = Math.abs(source.scale.y || 1)
  const centerX = source.position.x + (0.5 - source.anchor.x) * frameWidth * sourceScaleX
  const topY = source.position.y - source.anchor.y * frameHeight * scaleY

  if (!state.previousAlphaBySprite.has(source)) {
    state.previousAlphaBySprite.set(source, source.alpha)
  }

  const originalAlpha = state.previousAlphaBySprite.get(source) ?? 1
  source.alpha = originalAlpha * (1 - state.weight * (1 - SOURCE_DEBUG_ALPHA))
  mesh.texture = texture
  mesh.visible = source.visible
  mesh.alpha = originalAlpha * MESH_DEBUG_ALPHA * state.weight
  mesh.filters = source.filters ? [...source.filters] : null
  mesh.zIndex = source.zIndex
  mesh.position.x = centerX - (frameWidth * scaleX) / 2
  mesh.position.y = topY + POSE_OFFSET_Y * scaleY
  mesh.scale.x = scaleX
  mesh.scale.y = scaleY
  updateMeshVertices(
    mesh,
    target.compressLegs,
    frameWidth,
    frameHeight,
    state.weight
  )
}

function hideMissingSourceMeshes(state: PoseState, liveSprites: Set<PoseSprite>): void {
  for (const [source, mesh] of state.meshesBySprite.entries()) {
    if (liveSprites.has(source)) continue
    mesh.visible = false
    source.alpha = state.previousAlphaBySprite.get(source) ?? source.alpha
  }
}

export function resetUnitCrouchPose(unit: UnitEntity): void {
  const state = crouchPoseStateByUnit.get(unit)
  if (!state) return

  for (const [source, mesh] of state.meshesBySprite.entries()) {
    source.alpha = state.previousAlphaBySprite.get(source) ?? source.alpha
    mesh.parent?.removeChild(mesh)
    mesh.destroy({ children: true, texture: false })
  }
  if (state.previousShadowScale && unit.shadow) {
    unit.shadow.scale.x = state.previousShadowScale.x
    unit.shadow.scale.y = state.previousShadowScale.y
  }
  crouchPoseStateByUnit.delete(unit)
}

export function applyUnitCrouchPose(unit: UnitEntity, active: boolean): void {
  unit.isCrouching = active
  const state = crouchPoseStateByUnit.get(unit)
  if (!canApplyUnitCrouchPose(unit)) {
    resetUnitCrouchPose(unit)
    return
  }

  const nextState =
    state ?? {
      meshesBySprite: new Map<PoseSprite, MeshSimple>(),
      previousAlphaBySprite: new Map<PoseSprite, number>(),
      weight: 0,
    }
  nextState.weight = Math.max(
    0,
    Math.min(1, nextState.weight + (active ? POSE_TRANSITION_SPEED : -POSE_TRANSITION_SPEED))
  )
  if (!active && nextState.weight <= 0) {
    resetUnitCrouchPose(unit)
    return
  }
  crouchPoseStateByUnit.set(unit, nextState)

  const liveSprites = new Set<PoseSprite>()
  const layerSprites = [...((unit as LayeredUnit).appearanceLayerSprites?.entries() ?? [])]
  const targets: PoseTarget[] = [
    { sprite: unit.sprite as PoseSprite, compressLegs: true },
    ...layerSprites.map(([key, sprite]) => ({
      sprite,
      compressLegs: !isHeldEquipmentKey(unit.appearance?.layers[Number(key)]?.equipmentKey),
    })),
  ]
  for (const { sprite, compressLegs } of targets) {
    if (!sprite.parent || (sprite.visible === false && !nextState.meshesBySprite.has(sprite))) continue
    liveSprites.add(sprite)
    syncPoseSprite(unit, nextState, { sprite, compressLegs })
  }
  hideMissingSourceMeshes(nextState, liveSprites)

  if (unit.shadow && !nextState.previousShadowScale) {
    nextState.previousShadowScale = { x: unit.shadow.scale.x, y: unit.shadow.scale.y }
  }
  if (unit.shadow && nextState.previousShadowScale) {
    unit.shadow.scale.x = nextState.previousShadowScale.x * (1 + (STEALTH_SHADOW_SCALE_X - 1) * nextState.weight)
    unit.shadow.scale.y = nextState.previousShadowScale.y * (1 + (STEALTH_SHADOW_SCALE_Y - 1) * nextState.weight)
  }
}
