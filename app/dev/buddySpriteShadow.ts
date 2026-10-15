import * as BABYLON from '@babylonjs/core'

/** Lets the imported buddy use the same hard sprite shadows as the terrain shader. */
export class BuddySpriteShadow extends BABYLON.MaterialPluginBase {
  constructor(
    material: BABYLON.PBRMaterial,
    private readonly shadowMap: BABYLON.BaseTexture,
    private readonly shadowMatrix: () => BABYLON.Matrix,
    private readonly shadowDepth: BABYLON.Vector2,
    private readonly shadowPacked: number
  ) {
    super(material, 'BuddySpriteShadow', 200, undefined, true)
    this._enable(true)
  }

  override isCompatible(shaderLanguage: BABYLON.ShaderLanguage): boolean {
    return shaderLanguage === BABYLON.ShaderLanguage.GLSL
  }

  override getSamplers(samplers: string[]): void {
    samplers.push('buddySpriteShadowMap')
  }

  override getUniforms() {
    return {
      ubo: [
        { name: 'buddySpriteShadowMatrix', size: 16, type: 'mat4' },
        { name: 'buddySpriteShadowDepth', size: 2, type: 'vec2' },
        { name: 'buddySpriteShadowPacked', size: 1, type: 'float' },
      ],
      fragment: `
uniform mat4 buddySpriteShadowMatrix;
uniform vec2 buddySpriteShadowDepth;
uniform float buddySpriteShadowPacked;
`,
    }
  }

  override bindForSubMesh(uniformBuffer: BABYLON.UniformBuffer): void {
    uniformBuffer.updateMatrix('buddySpriteShadowMatrix', this.shadowMatrix())
    uniformBuffer.updateFloat2('buddySpriteShadowDepth', this.shadowDepth.x, this.shadowDepth.y)
    uniformBuffer.updateFloat('buddySpriteShadowPacked', this.shadowPacked)
    uniformBuffer.setTexture('buddySpriteShadowMap', this.shadowMap)
  }

  override getCustomCode(shaderType: string) {
    if (shaderType !== 'fragment') return null
    return {
      CUSTOM_FRAGMENT_DEFINITIONS: `
uniform sampler2D buddySpriteShadowMap;
`,
      CUSTOM_FRAGMENT_BEFORE_FRAGCOLOR: `
vec4 buddyShadowPosition = buddySpriteShadowMatrix * vec4(vPositionW, 1.0);
vec3 buddyShadowClip = buddyShadowPosition.xyz / buddyShadowPosition.w;
vec2 buddyShadowUv = buddyShadowClip.xy * 0.5 + 0.5;
if (all(greaterThanEqual(buddyShadowUv, vec2(0.0))) && all(lessThanEqual(buddyShadowUv, vec2(1.0)))) {
  vec4 buddyShadowSample = texture2D(buddySpriteShadowMap, buddyShadowUv);
  float buddyShadowStoredDepth = mix(
    buddyShadowSample.r,
    dot(buddyShadowSample, vec4(1.0 / 16581375.0, 1.0 / 65025.0, 1.0 / 255.0, 1.0)),
    buddySpriteShadowPacked
  );
  // The hero is also in this map so it can cast on the ground. Clear its own
  // depth before testing taller scenery shadows against the small model.
  float buddyShadowDepth = (buddyShadowPosition.z + buddySpriteShadowDepth.x) / buddySpriteShadowDepth.y - 0.006;
  finalColor.rgb *= mix(0.42, 1.0, step(buddyShadowDepth, buddyShadowStoredDepth));
}
`,
    }
  }
}
