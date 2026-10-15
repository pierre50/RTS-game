import * as BABYLON from '@babylonjs/core'
import { WORLD_PER_PIXEL } from './babylonResourceLayer'

/** Pixelate Buddy's screen silhouette while leaving the terrain at native resolution. */
export function installBuddyPixelation(
  scene: BABYLON.Scene,
  camera: BABYLON.ArcRotateCamera,
  engine: BABYLON.Engine,
  meshes: BABYLON.AbstractMesh[]
): void {
  const maskMaterial = new BABYLON.StandardMaterial('Buddy pixel mask material', scene)
  maskMaterial.disableLighting = true
  maskMaterial.emissiveColor = BABYLON.Color3.White()
  maskMaterial.backFaceCulling = false

  const mask = new BABYLON.RenderTargetTexture('Buddy pixel mask', { ratio: 0.5 }, scene, {
    samplingMode: BABYLON.Texture.NEAREST_SAMPLINGMODE,
    generateDepthBuffer: true,
  })
  mask.activeCamera = camera
  mask.clearColor = new BABYLON.Color4(0, 0, 0, 0)
  mask.renderParticles = false
  mask.renderSprites = false
  mask.renderList = meshes
  mask.setMaterialForRendering(meshes, maskMaterial)
  scene.customRenderTargets.push(mask)

  BABYLON.Effect.ShadersStore.buddyPixelationFragmentShader = `
precision highp float;
varying vec2 vUV;
uniform sampler2D textureSampler;
uniform sampler2D buddyMask;
uniform vec2 screenSize;
uniform float blockSize;
void main(void) {
  vec2 block = floor(vUV * screenSize / blockSize);
  vec2 center = (block + 0.5) * blockSize / screenSize;
  vec2 halfBlock = vec2(blockSize * 0.49) / screenSize;
  float coverage = texture2D(buddyMask, center).r;
  coverage = max(coverage, texture2D(buddyMask, center + vec2(halfBlock.x, halfBlock.y)).r);
  coverage = max(coverage, texture2D(buddyMask, center + vec2(-halfBlock.x, halfBlock.y)).r);
  coverage = max(coverage, texture2D(buddyMask, center + vec2(halfBlock.x, -halfBlock.y)).r);
  coverage = max(coverage, texture2D(buddyMask, center - halfBlock).r);
  gl_FragColor = texture2D(textureSampler, mix(vUV, center, step(0.5, coverage)));
}
`
  const pixelation = new BABYLON.PostProcess(
    'Buddy pixel silhouette', 'buddyPixelation', ['screenSize', 'blockSize'], ['buddyMask'], 1,
    camera, BABYLON.Texture.NEAREST_SAMPLINGMODE, engine
  )
  pixelation.onApply = effect => {
    effect.setTexture('buddyMask', mask)
    effect.setFloat2('screenSize', pixelation.width, pixelation.height)
    // Match the projected size of the terrain sprites' source pixels.
    const visibleHeight = (camera.orthoTop ?? 0) - (camera.orthoBottom ?? 0)
    const spritePixelSize = visibleHeight > 0
      ? pixelation.height * WORLD_PER_PIXEL / visibleHeight
      : 4
    effect.setFloat('blockSize', Math.max(2, Math.round(spritePixelSize)))
  }
}
