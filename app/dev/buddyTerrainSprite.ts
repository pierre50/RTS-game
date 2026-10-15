import * as BABYLON from '@babylonjs/core'

const FRAMES = 12
const DIRECTIONS = 8
const SHEET = 'assets/prototypes/buddy-hero2d/walk-sword-shield-8dir.png'
const ACTION_PATH = 'assets/prototypes/buddy-hero2d/'
type SwordAction = { kind: 'side' | 'slash'; progress: number } | null

/** Camera-facing cutout of the exported Buddy, with one idle frame per direction. */
export function createTerrainBuddySprite(scene: BABYLON.Scene) {
  const sprite = BABYLON.MeshBuilder.CreatePlane('terrain Buddy 2D', { size: 2.1 }, scene)
  sprite.billboardMode = BABYLON.Mesh.BILLBOARDMODE_ALL
  sprite.isPickable = false
  sprite.receiveShadows = false
  const texture = new BABYLON.Texture(SHEET, scene, false, true, BABYLON.Texture.NEAREST_SAMPLINGMODE)
  texture.hasAlpha = true
  texture.wrapU = BABYLON.Texture.CLAMP_ADDRESSMODE
  texture.wrapV = BABYLON.Texture.CLAMP_ADDRESSMODE
  texture.uScale = 1 / FRAMES
  texture.vScale = 1 / DIRECTIONS
  const actionTexture = new BABYLON.DynamicTexture('terrain Buddy sword action frame',
    { width: 96, height: 96 }, scene, false, BABYLON.Texture.NEAREST_SAMPLINGMODE)
  actionTexture.hasAlpha = true
  actionTexture.wrapU = BABYLON.Texture.CLAMP_ADDRESSMODE
  actionTexture.wrapV = BABYLON.Texture.CLAMP_ADDRESSMODE
  const actionContext = actionTexture.getContext() as CanvasRenderingContext2D
  actionContext.imageSmoothingEnabled = false
  const images = {} as Record<'side' | 'slash', { body: HTMLImageElement; sword: HTMLImageElement }>
  for (const kind of ['side', 'slash'] as const) {
    const body = new Image()
    const sword = new Image()
    body.src = `${ACTION_PATH}body-${kind}-sword-shield-8dir.png`
    sword.src = `${ACTION_PATH}sword-${kind}-sword-shield-8dir.png`
    images[kind] = { body, sword }
  }
  const material = new BABYLON.StandardMaterial('terrain Buddy 2D material', scene)
  material.diffuseTexture = texture
  material.emissiveTexture = texture
  material.emissiveColor = BABYLON.Color3.White()
  material.diffuseColor = BABYLON.Color3.Black()
  material.useAlphaFromDiffuseTexture = true
  material.transparencyMode = BABYLON.Material.MATERIAL_ALPHATEST
  material.alphaCutOff = 0.5
  material.disableLighting = true
  material.backFaceCulling = false
  material.specularColor = BABYLON.Color3.Black()
  sprite.material = material

  const contact = BABYLON.MeshBuilder.CreateDisc('terrain Buddy 2D contact shadow', { radius: 0.48, tessellation: 24 }, scene)
  contact.rotation.x = Math.PI / 2
  contact.scaling.y = 0.55
  contact.isPickable = false
  const shadowMaterial = new BABYLON.StandardMaterial('terrain Buddy 2D contact shadow material', scene)
  shadowMaterial.diffuseColor = BABYLON.Color3.Black()
  shadowMaterial.emissiveColor = BABYLON.Color3.Black()
  shadowMaterial.alpha = 0.28
  shadowMaterial.disableLighting = true
  shadowMaterial.backFaceCulling = false
  contact.material = shadowMaterial

  let phase = 0
  let frame = -1
  let direction = -1
  let actionKey = ''
  let showingAction = false
  const select = (nextDirection: number, nextFrame: number) => {
    if (showingAction) {
      material.diffuseTexture = texture
      material.emissiveTexture = texture
      showingAction = false
    }
    if (nextDirection === direction && nextFrame === frame) return
    direction = nextDirection
    frame = nextFrame
    texture.uOffset = frame / FRAMES
    // Babylon inverts the PNG's vertical axis when uploading the texture.
    texture.vOffset = (DIRECTIONS - 1 - direction) / DIRECTIONS
  }
  const selectAction = (nextDirection: number, action: Exclude<SwordAction, null>) => {
    const { body, sword } = images[action.kind]
    if (!body.complete || !body.naturalWidth || !sword.complete || !sword.naturalWidth) return false
    const actionFrame = Math.min(FRAMES - 1, Math.floor(action.progress * (FRAMES - 1)))
    const nextKey = `${action.kind}:${nextDirection}:${actionFrame}`
    if (nextKey !== actionKey) {
      actionContext.clearRect(0, 0, 96, 96)
      actionContext.drawImage(body, actionFrame * 96, nextDirection * 96, 96, 96, 0, 0, 96, 96)
      actionContext.drawImage(sword, actionFrame * 96, nextDirection * 96, 96, 96, 0, 0, 96, 96)
      actionTexture.update()
      actionKey = nextKey
    }
    if (!showingAction) {
      material.diffuseTexture = actionTexture
      material.emissiveTexture = actionTexture
      showingAction = true
    }
    return true
  }
  select(4, 0)

  return {
    mesh: sprite,
    update(position: BABYLON.Vector3, facing: BABYLON.Vector3, camera: BABYLON.ArcRotateCamera,
      travel: number, hasDirection: boolean, action: SwordAction) {
      sprite.position.set(position.x, position.y + 0.44, position.z)
      contact.position.set(position.x, position.y + 0.02, position.z)
      const walking = travel > 0.0001
      if (walking) phase += Math.min(travel, 0.25) * 7.7
      else phase = 0
      let row = direction < 0 ? 4 : direction
      if (hasDirection) {
        const forward = new BABYLON.Vector3(-Math.cos(camera.alpha), 0, -Math.sin(camera.alpha))
        const right = new BABYLON.Vector3(forward.z, 0, -forward.x)
        const angle = Math.atan2(BABYLON.Vector3.Dot(facing, right), BABYLON.Vector3.Dot(facing, forward))
        row = (Math.round(angle / (Math.PI / 4)) + DIRECTIONS) % DIRECTIONS
      }
      if (action && selectAction(row, action)) return
      select(row, walking ? Math.floor(phase) % FRAMES : 0)
    },
  }
}
