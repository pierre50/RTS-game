import * as BABYLON from '@babylonjs/core'

/** Small, camera-local grass clusters for the illustrated 3D terrain mode. */
export function createModelGroundDetails(
  scene: BABYLON.Scene,
  types: Uint8Array,
  gridSize: number,
  groundHeight: (x: number, z: number) => number
): {
  mesh: BABYLON.Mesh
  update: (x: number, z: number, halfWidth: number, halfHeight: number, force?: boolean) => void
  invalidate: () => void
} {
  const positions: number[] = []
  const colors: number[] = []
  const indices: number[] = []
  const greens = [
    [0.40, 0.70, 0.23],
    [0.48, 0.81, 0.27],
    [0.56, 0.88, 0.31],
    [0.43, 0.75, 0.25],
    [0.61, 0.90, 0.33],
    [0.51, 0.84, 0.28],
    [0.38, 0.69, 0.22],
  ]
  for (let blade = 0; blade < greens.length; blade++) {
    const angle = blade * Math.PI * (3 - Math.sqrt(5))
    const direction = new BABYLON.Vector3(Math.cos(angle), 0, Math.sin(angle))
    const side = new BABYLON.Vector3(-direction.z, 0, direction.x)
    const radius = blade % 2 === 0 ? 0.23 : 0.17
    const height = 0.28 + (blade % 3) * 0.035
    const base = positions.length / 3
    const vertices = [
      direction.scale(0.025).add(side.scale(-0.035)),
      direction.scale(0.025).add(side.scale(0.035)),
      direction.scale(radius * 0.55).add(side.scale(-0.05)).add(new BABYLON.Vector3(0, height * 0.65, 0)),
      direction.scale(radius * 0.55).add(side.scale(0.05)).add(new BABYLON.Vector3(0, height * 0.65, 0)),
      direction.scale(radius).add(new BABYLON.Vector3(0, height, 0)),
    ]
    for (const vertex of vertices) {
      positions.push(vertex.x, vertex.y, vertex.z)
      colors.push(...greens[blade], 1)
    }
    indices.push(base, base + 1, base + 2, base + 1, base + 3, base + 2, base + 2, base + 3, base + 4)
  }
  const normals: number[] = []
  BABYLON.VertexData.ComputeNormals(positions, indices, normals)
  const mesh = new BABYLON.Mesh('illustrated grass tufts', scene)
  const geometry = new BABYLON.VertexData()
  geometry.positions = positions
  geometry.normals = normals
  geometry.colors = colors
  geometry.indices = indices
  geometry.applyToMesh(mesh)
  mesh.isPickable = false
  const material = new BABYLON.StandardMaterial('illustrated grass', scene)
  material.backFaceCulling = false
  material.specularColor = BABYLON.Color3.Black()
  material.diffuseColor = BABYLON.Color3.White()
  material.emissiveColor = new BABYLON.Color3(0.12, 0.18, 0.04)
  material.twoSidedLighting = true
  mesh.material = material

  const hash = (i: number, j: number, salt: number) => {
    let value = Math.imul(i + salt * 31, 374761393) ^ Math.imul(j - salt * 17, 668265263)
    value = Math.imul(value ^ (value >>> 13), 1274126177)
    return ((value ^ (value >>> 16)) >>> 0) / 4294967296
  }
  let lastBounds = ''
  const scale = new BABYLON.Vector3()
  const rotation = new BABYLON.Quaternion()
  const translation = new BABYLON.Vector3()
  const matrix = new BABYLON.Matrix()
  const update = (x: number, z: number, halfWidth: number, halfHeight: number, force = false) => {
    const minI = Math.max(0, Math.floor(x - halfWidth - 3))
    const maxI = Math.min(gridSize - 1, Math.ceil(x + halfWidth + 3))
    const minJ = Math.max(0, Math.floor(-z - halfHeight - 3))
    const maxJ = Math.min(gridSize - 1, Math.ceil(-z + halfHeight + 3))
    const bounds = `${minI}:${maxI}:${minJ}:${maxJ}`
    if (!force && bounds === lastBounds) return
    lastBounds = bounds
    const matrices: number[] = []
    for (let i = minI; i <= maxI; i++) {
      for (let j = minJ; j <= maxJ; j++) {
        const terrain = types[i * gridSize + j]
        if (terrain !== 0 && terrain !== 3 && terrain !== 4) continue
        if (hash(i, j, 0) > 0.27) continue
        const px = i + 0.18 + hash(i, j, 1) * 0.64
        const pz = -(j + 0.18 + hash(i, j, 2) * 0.64)
        const size = 0.75 + hash(i, j, 3) * 0.55
        scale.setAll(size)
        BABYLON.Quaternion.RotationYawPitchRollToRef(hash(i, j, 4) * Math.PI * 2, 0, 0, rotation)
        translation.set(px, groundHeight(px, pz) + 0.015, pz)
        BABYLON.Matrix.ComposeToRef(scale, rotation, translation, matrix)
        matrix.copyToArray(matrices, matrices.length)
      }
    }
    mesh.thinInstanceSetBuffer('matrix', new Float32Array(matrices), 16, false)
    mesh.thinInstanceRefreshBoundingInfo(false)
  }
  return { mesh, update, invalidate: () => { lastBounds = '' } }
}
