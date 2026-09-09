import type { TerrainContext } from './TerrainGenerationContext'

export function initializeTerrain(this: TerrainContext): void {
  const waterThreshold = 0.28

  for (let i = 0; i < this.gridSize; i++) {
    this.terrainMap[i] = []
    for (let j = 0; j < this.gridSize; j++) {
      // Match the original Float32 height buffer rounding.
      let h = Math.fround(this.fbm(i * this.scale, j * this.scale))
      const fo = this.radialFalloff(i, j)

      h += (fo - 0.5) * 0.75

      this.terrainRow(i)[j] = h < waterThreshold ? 2 : this.groundTypeValue
    }
  }
}

export function smoothCoast(this: TerrainContext): void {
  for (let pass = 0; pass < 2; pass++) {
    for (let i = 1; i < this.gridSize - 1; i++) {
      for (let j = 1; j < this.gridSize - 1; j++) {
        const wn =
          (this.terrainRow(i - 1)[j] === 2 ? 1 : 0) +
          (this.terrainRow(i + 1)[j] === 2 ? 1 : 0) +
          (this.terrainRow(i)[j - 1] === 2 ? 1 : 0) +
          (this.terrainRow(i)[j + 1] === 2 ? 1 : 0)
        if (this.terrainRow(i)[j] !== 2 && wn >= 3) this.terrainRow(i)[j] = 2
        if (this.terrainRow(i)[j] === 2 && wn <= 1) this.terrainRow(i)[j] = this.groundTypeValue
      }
    }
  }

  this.forceOuterWater()
}

export function addLakes(this: TerrainContext): void {
  const lakes = this.params.lakes
  if (lakes && lakes.count > 0) {
    const shoreValue = lakes.shoreType ? this.terrainValueByType[lakes.shoreType] : null
    for (let index = 0; index < this.featureCount(lakes.count); index++) {
      const salt = 5000 + index * 43
      const margin = this.borderWaterWidth + Math.ceil(lakes.maxRadius + lakes.shoreRadius) + 5
      const centerI = this.randomInt(margin, this.gridSize - margin - 1, salt)
      const centerJ = this.randomInt(margin, this.gridSize - margin - 1, salt + 11)
      const radius = this.randomRange(lakes.minRadius, lakes.maxRadius, salt + 19)
      this.applyLake(centerI, centerJ, radius, lakes.shoreRadius, shoreValue, salt)
    }
  }
}

export function addGroundPatches(this: TerrainContext): void {
  const patchwork = this.params.patchwork
  if (patchwork && patchwork.count > 0) {
    const terrainValue = this.terrainValueByType[patchwork.terrainType]
    const requireWaterClearance = patchwork.terrainType === 'Dirt' || patchwork.terrainType === 'Snow'
    for (let index = 0; index < this.featureCount(patchwork.count); index++) {
      const salt = 1000 + index * 31
      const margin = this.borderWaterWidth + Math.ceil(patchwork.maxRadius) + 4
      const radius = this.randomRange(patchwork.minRadius, patchwork.maxRadius, salt + 13)
      const waterClearance = Math.ceil(radius * 1.5) + 3
      let centerI = 0
      let centerJ = 0
      let placed = false
      for (let attempt = 0; attempt < 12; attempt++) {
        const attemptSalt = salt + attempt * 101
        centerI = this.randomInt(margin, this.gridSize - margin - 1, attemptSalt)
        centerJ = this.randomInt(margin, this.gridSize - margin - 1, attemptSalt + 7)
        if (!requireWaterClearance || !this.hasWaterWithin(centerI, centerJ, waterClearance)) {
          placed = true
          break
        }
      }
      if (placed) this.applyGroundPatch(centerI, centerJ, radius, terrainValue, salt)
    }
  }
}
