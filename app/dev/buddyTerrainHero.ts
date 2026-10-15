import * as BABYLON from '@babylonjs/core'
import '@babylonjs/loaders/glTF'
import { BuddySpriteShadow } from './buddySpriteShadow'
import '../../reports/buddy-3d-v0/foot-motion.js'
import '../../reports/buddy-3d-v0/buddy-actions.js'
import '../../reports/buddy-3d-v0/buddy-sword.js'
import '../../reports/buddy-3d-v0/buddy-shield.js'

type LoadedBuddy = Awaited<ReturnType<typeof BABYLON.SceneLoader.ImportMeshAsync>>
type AttackAction = 'SideSlash' | 'Slash' | 'Thrust' | 'Chop' | 'Shot' | 'ChargeSlash' | 'ReleaseSlash' | 'ChargeShot' | 'ReleaseShot' | 'CancelCharge'
type AttackOptions = {
  action?: string
  attackSpeed?: number
  walkSpeed?: number
  keepLegsMoving?: boolean
  prepare?: () => void
  stopCurrent?: () => void
}
type BuddyRig = {
  bodySway: BABYLON.TransformNode | null
  crouchPose: BABYLON.TransformNode | null
  walk: BABYLON.AnimationGroup | null
  shotUpper: BABYLON.AnimationGroup | null
  startWalk: (speed: number) => void
  stopWalk: () => void
  updateFootPlant: (dt: number) => void
  updateCrouch: (dt: number, crouching: boolean) => void
}
type BuddyWeapon = {
  root: BABYLON.TransformNode
  gripSockets: { left: BABYLON.TransformNode | null }
  setVariant: (kind: string) => void
  setProjectileTarget: (point: BABYLON.Vector3 | null) => void
  updatePose: (dt: number, walking: boolean, walkSpeed: number, guarding?: boolean, sideSlashProgress?: number | null, shotProgress?: number | null) => void
  aimDirectionWorld: () => BABYLON.Vector3
}
type BuddyAttack = {
  attacking: boolean
  charging: boolean
  blocking: boolean
  guarding: boolean
  spriteAction: string | null
  spriteProgress: number | null
  sideSlashProgress: number | null
  shotProgress: number | null
  start: (options: AttackOptions) => boolean
  startCharge: (options: AttackOptions) => boolean
  releaseCharge: () => number | false
  cancelCharge: () => boolean
  startBlock: (options: AttackOptions) => boolean
  releaseBlock: () => void
  setLegsMoving: (moving: boolean, speed: number) => void
  update: () => void
}
type PointerActions = { tap: AttackAction; hold?: AttackAction; holdRelease?: AttackAction; holdCancel?: AttackAction; holdDelay?: number }
type BuddyGlobals = Window & {
  BABYLON: typeof BABYLON
  tuneBuddyFeet: (result: LoadedBuddy, scene: BABYLON.Scene) => void
  createBuddyActionRig: (result: LoadedBuddy, scene: BABYLON.Scene) => BuddyRig
  createBuddySword: (scene: BABYLON.Scene, wrist: BABYLON.TransformNode, castShadow: (mesh: BABYLON.AbstractMesh) => void, offhand: BABYLON.TransformNode | null) => BuddyWeapon
  createBuddyShield: (scene: BABYLON.Scene, wrist: BABYLON.TransformNode, castShadow: (mesh: BABYLON.AbstractMesh) => void, gripSocket: BABYLON.TransformNode | null) => { setVariant: (kind: string) => void }
  createBuddyAttack: (rig: BuddyRig, weapon: BuddyWeapon, onEnd: () => void) => BuddyAttack
  buddyIsRangedEquipment: (kind: string) => boolean
  buddyPointerActionsForEquipment: (kind: string) => PointerActions
  bindBuddyAttackPointer: (canvas: HTMLCanvasElement, actions: () => PointerActions | null, trigger: (action: AttackAction) => void, options: { dragTolerance: number; onPointerDown: (event: PointerEvent) => void }) => void
}

export type TerrainBuddy = {
  root: BABYLON.TransformNode
  facingWorld: () => BABYLON.Vector3
  spriteAction: () => { kind: 'side' | 'slash'; progress: number } | null
  move: (dt: number, movement: BABYLON.Vector3, run: boolean, crouch: boolean, block: boolean, aimPoint: BABYLON.Vector3 | null) => void
  aim: (dt: number, point: BABYLON.Vector3 | null) => void
  bindPointer: (canvas: HTMLCanvasElement, onAim: (event: PointerEvent) => void) => void
  setEquipment: (kind: string) => void
  setShield: (kind: string) => void
}

/** Attach the same rig and action controls as the mini scene to the terrain's Babylon scene. */
export async function createTerrainBuddy(
  scene: BABYLON.Scene,
  position: BABYLON.Vector3,
  canMoveTo: (x: number, z: number) => boolean,
  groundHeight: (x: number, z: number) => number,
  castShadow: (mesh: BABYLON.AbstractMesh) => void,
  spriteShadow: {
    texture: BABYLON.BaseTexture
    matrix: () => BABYLON.Matrix
    depth: BABYLON.Vector2
    packed: number
  },
  options: { visualMode?: '3d' | '2d' } = {}
): Promise<TerrainBuddy> {
  const spriteMode = options.visualMode === '2d'
  const buddy = window as unknown as BuddyGlobals
  buddy.BABYLON = BABYLON
  const modelUrl = new URL('../../reports/buddy-3d-v0/buddy-antiquity-pixel-actions-v23.glb', import.meta.url).href
  const result = await BABYLON.SceneLoader.ImportMeshAsync('', '', modelUrl, scene)
  const root = new BABYLON.TransformNode('terrain Buddy', scene)
  root.scaling.setAll(0.21)
  root.position.copyFrom(position)
  result.meshes[0].parent = root
  result.meshes[0].position.y = -2.20
  const outlineColor = BABYLON.Color3.FromHexString('#261d20')
  const outlineBuddyPart = (mesh: BABYLON.AbstractMesh) => {
    mesh.renderOutline = true
    mesh.outlineColor = outlineColor
    // Keep a visible contour on the small model, including its separate hands and feet.
    mesh.outlineWidth = 0.08
  }
  const castEquippedShadow = (mesh: BABYLON.AbstractMesh) => {
    if (spriteMode) {
      mesh.isVisible = false
      return
    }
    outlineBuddyPart(mesh)
    castShadow(mesh)
  }
  result.meshes.forEach(mesh => {
    if (mesh.getTotalVertices() > 0) {
      if (spriteMode) {
        mesh.isVisible = false
        return
      }
      // Tree shadows are applied by BuddySpriteShadow below; Babylon's PBR
      // receiver would also draw the low-resolution map over Buddy's own face.
      mesh.receiveShadows = false
      outlineBuddyPart(mesh)
      castShadow(mesh)
    }
  })
  result.animationGroups.forEach(group => { group.stop(); group.goToFrame(0) })
  buddy.tuneBuddyFeet(result, scene)
  const rig = buddy.createBuddyActionRig(result, scene)
  const rightHand = result.transformNodes.find(node => node.name === 'Poignet droit') ?? null
  const leftHand = result.transformNodes.find(node => node.name === 'Poignet gauche') ?? null
  let torsoAim: BABYLON.TransformNode | null = null
  let wristAim: BABYLON.TransformNode | null = null
  let wristRest: BABYLON.Vector3 | null = null
  if (rig.bodySway && rig.crouchPose) {
    torsoAim = new BABYLON.TransformNode('terrain torso aim', scene)
    torsoAim.parent = rig.crouchPose
    torsoAim.position.z = 0.4
    const torsoOffset = new BABYLON.TransformNode('terrain torso aim offset', scene)
    torsoOffset.parent = torsoAim
    torsoOffset.position.z = -0.4
    rig.bodySway.parent = torsoOffset
    if (rightHand) {
      wristRest = rightHand.position.clone()
      wristAim = new BABYLON.TransformNode('terrain right hand aim', scene)
      wristAim.parent = rig.bodySway
      wristAim.position.copyFrom(wristRest)
      const wristOffset = new BABYLON.TransformNode('terrain right hand aim offset', scene)
      wristOffset.parent = wristAim
      wristOffset.position.copyFrom(wristRest).scaleInPlace(-1)
      rightHand.parent = wristOffset
    }
  }
  if (!rightHand) throw new Error('Buddy right wrist is missing')
  const weapon = buddy.createBuddySword(scene, rightHand, castEquippedShadow, leftHand)
  let equipment = 'sword-iron'
  let shieldKind = 'iron'
  weapon.setVariant(equipment)
  const shield = leftHand ? buddy.createBuddyShield(scene, leftHand, castEquippedShadow, weapon.gripSockets.left) : null
  shield?.setVariant(shieldKind)
  // Calibrate the model's visible forward axis to the ground-plane aim direction.
  const modelAimYawOffset = Math.PI * 7 / 9
  let bowAimYawOffset = Math.PI * 3 / 4
  if (rig.shotUpper) {
    weapon.setVariant('bow')
    const shot = rig.shotUpper
    shot.start(false, 1)
    shot.goToFrame(shot.from + (shot.to - shot.from) * .60)
    shot.pause()
    weapon.updatePose(1, false, 1, false, null, .60)
    const bowAxis = weapon.aimDirectionWorld()
    bowAimYawOffset = Math.atan2(bowAxis.z, bowAxis.x)
    shot.stop()
    shot.start(false, 1)
    shot.goToFrame(0)
    shot.stop()
    weapon.setVariant(equipment)
    weapon.updatePose(1, false, 1)
  }
  const importedMaterials = new Set(result.meshes.map(mesh => mesh.material))
  importedMaterials.forEach(material => {
    if (material instanceof BABYLON.PBRMaterial) {
      material.albedoTexture?.updateSamplingMode(BABYLON.Texture.NEAREST_SAMPLINGMODE)
      if (!spriteMode) new BuddySpriteShadow(material, spriteShadow.texture, spriteShadow.matrix, spriteShadow.depth, spriteShadow.packed)
    }
  })

  let moving = false
  let walkSpeed = 1.4
  let lastMovement = BABYLON.Vector3.Zero()
  const attack = buddy.createBuddyAttack(rig, weapon, () => {
    if (moving) rig.startWalk(walkSpeed)
    else rig.stopWalk()
  })
  const busy = () => attack.attacking || attack.charging || attack.blocking
  const positionSwordHand = () => {
    if (!wristAim || !wristRest) return
    const angle = wristAim.rotation.z
    wristAim.position.x = Math.cos(angle) * wristRest.x - Math.sin(angle) * wristRest.y
    wristAim.position.y = Math.sin(angle) * wristRest.x + Math.cos(angle) * wristRest.y
  }
  const aimSword = (point: BABYLON.Vector3 | null, lerp: number) => {
    if (!point || !wristAim || busy()) return
    if (buddy.buddyIsRangedEquipment(equipment)) {
      wristAim.rotation.z = 0
      positionSwordHand()
      return
    }
    const dx = point.x - root.position.x
    const dz = point.z - root.position.z
    if (Math.hypot(dx, dz) < 0.3) return
    const toCursor = new BABYLON.Vector3(dx, 0, dz).normalize()
    if (!wristAim.parent) return
    wristAim.parent.computeWorldMatrix(true)
    const fromWorld = wristAim.parent.getWorldMatrix().clone().invert()
    const targetLocal = BABYLON.Vector3.TransformNormal(toCursor, fromWorld).normalize()
    const bladeLocal = BABYLON.Vector3.TransformNormal(weapon.aimDirectionWorld(), fromWorld).normalize()
    const delta = Math.atan2(targetLocal.y, targetLocal.x) - Math.atan2(bladeLocal.y, bladeLocal.x)
    wristAim.rotation.z = BABYLON.Scalar.Clamp(wristAim.rotation.z + Math.atan2(Math.sin(delta), Math.cos(delta)) * lerp,
      -Math.PI * 2 / 3, Math.PI * 2 / 3)
    positionSwordHand()
  }
  const trigger = (action: AttackAction) => {
    const options: AttackOptions = {
      action: action === 'ChargeShot' ? 'Shot' : action === 'ChargeSlash' ? 'Slash' : action,
      walkSpeed,
      keepLegsMoving: moving,
      prepare: () => aimSword(currentAim, 1),
      stopCurrent: () => rig.stopWalk(),
    }
    if (action === 'ChargeSlash' || action === 'ChargeShot') attack.startCharge(options)
    else if (action === 'ReleaseSlash' || action === 'ReleaseShot') attack.releaseCharge()
    else if (action === 'CancelCharge') attack.cancelCharge()
    else attack.start({ ...options, attackSpeed: 2.4 })
  }
  let currentAim: BABYLON.Vector3 | null = null
  return {
    root,
    spriteAction: () => {
      const kind = attack.spriteAction === 'SideSlash' ? 'side' : attack.spriteAction === 'Slash' ? 'slash' : null
      const progress = attack.spriteProgress
      return kind && progress !== null ? { kind, progress } : null
    },
    facingWorld: () => {
      const angle = modelAimYawOffset - root.rotation.y
      return new BABYLON.Vector3(Math.cos(angle), 0, Math.sin(angle))
    },
    move(dt, movement, run, crouch, block, aimPoint) {
      const shouldMove = movement.lengthSquared() > 0.0001
      lastMovement = shouldMove ? movement.normalize() : BABYLON.Vector3.Zero()
      const toAim = aimPoint?.subtract(root.position)
      const backward = shouldMove && toAim && toAim.lengthSquared() > .09
        ? Math.max(0, -BABYLON.Vector3.Dot(lastMovement, toAim.normalize())) : 0
      const backpedal = 1 - .45 * backward
      const speed = (crouch ? 1.65 : run ? 5.95 : 3.4) * .5 * backpedal * dt
      walkSpeed = 1.4 * (crouch ? .68 : run ? 1.6 : 1) * backpedal
      if (shouldMove) {
        const x = root.position.x + lastMovement.x * speed
        const z = root.position.z + lastMovement.z * speed
        if (canMoveTo(x, z)) {
          root.position.x = x
          root.position.z = z
        } else {
          if (canMoveTo(x, root.position.z)) root.position.x = x
          if (canMoveTo(root.position.x, z)) root.position.z = z
        }
      }
      root.position.y = groundHeight(root.position.x, root.position.z)
      rig.updateCrouch(dt, crouch)
      if (block && !attack.blocking) {
        attack.startBlock({ walkSpeed, keepLegsMoving: shouldMove,
          prepare: () => { if (wristAim) { wristAim.rotation.z = 0; positionSwordHand() } },
          stopCurrent: () => rig.stopWalk() })
      } else if (!block && attack.blocking) attack.releaseBlock()
      if (moving !== shouldMove) {
        moving = shouldMove
        if (busy()) attack.setLegsMoving(moving, walkSpeed)
        else if (moving) rig.startWalk(walkSpeed)
        else rig.stopWalk()
      }
      if (moving) {
        if (busy()) attack.setLegsMoving(true, walkSpeed)
        else if (rig.walk) rig.walk.speedRatio = walkSpeed
      }
      rig.updateFootPlant(dt)
    },
    aim(dt, point) {
      currentAim = point?.clone() ?? null
      weapon.setProjectileTarget(currentAim)
      const dx = point ? point.x - root.position.x : 0
      const dz = point ? point.z - root.position.z : 0
      const hasAim = Math.hypot(dx, dz) > .3
      if (hasAim || moving) {
        const direction = hasAim ? new BABYLON.Vector3(dx, 0, dz).normalize() : lastMovement
        const offset = equipment.startsWith('bow') ? bowAimYawOffset : modelAimYawOffset
        const desiredYaw = offset - Math.atan2(direction.z, direction.x)
        const turn = Math.atan2(Math.sin(desiredYaw - root.rotation.y), Math.cos(desiredYaw - root.rotation.y))
        root.rotation.y += turn * Math.min(1, dt * 13)
      }
      attack.update()
      if (torsoAim) {
        const offset = equipment.startsWith('bow') ? bowAimYawOffset : modelAimYawOffset
        const desiredYaw = offset - Math.atan2(dz, dx)
        const relativeYaw = hasAim ? Math.atan2(Math.sin(desiredYaw - root.rotation.y), Math.cos(desiredYaw - root.rotation.y)) : 0
        const targetAngle = BABYLON.Scalar.Clamp(relativeYaw, -Math.PI / 3, Math.PI / 3)
        torsoAim.rotation.z += (-targetAngle - torsoAim.rotation.z) * Math.min(1, dt * 9)
      }
      if (!moving && !busy()) aimSword(point, Math.min(1, dt * 12))
      if (moving && !busy() && wristAim) {
        wristAim.rotation.z += (0 - wristAim.rotation.z) * Math.min(1, dt * 10)
        positionSwordHand()
      }
      weapon.updatePose(dt, moving && !busy(), walkSpeed, attack.guarding, attack.sideSlashProgress, attack.shotProgress)
    },
    bindPointer(canvas, onAim) {
      buddy.bindBuddyAttackPointer(canvas,
        () => !busy() ? buddy.buddyPointerActionsForEquipment(equipment) : null,
        trigger, { dragTolerance: Infinity, onPointerDown: onAim })
    },
    setEquipment(kind) {
      equipment = kind
      weapon.setVariant(kind)
      shield?.setVariant(buddy.buddyIsRangedEquipment(kind) ? 'none' : shieldKind)
    },
    setShield(kind) {
      shieldKind = kind
      shield?.setVariant(buddy.buddyIsRangedEquipment(equipment) ? 'none' : kind)
    },
  }
}
