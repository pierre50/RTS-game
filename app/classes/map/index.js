import { Container } from 'pixi.js'
import { BUCKET_SIZE } from '../../constants'
import { MapGeneration } from './MapGeneration'
import { MapResources } from './MapResources'
import { MapTerrain } from './MapTerrain'
import { MapFog } from './MapFog'

export default class Map extends Container {
  constructor(context) {
    super()

    this.context = context
    this.size
    this.reliefRange = [
      1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2, 2,
      3,
    ]
    this.chanceOfRelief = 0.06
    this.chanceOfSets = 0.02

    this.ready = false
    this.grid = []
    this.sortableChildren = true

    this.allTechnologies = false
    this.noAI = false

    this.instantMode = false
    this.difficulty = 'medium'
    this.startingResources = { wood: 200, food: 200, stone: 150, gold: 0 }
    this.resourceDensity = 'moderate'
    this.revealEverything = false
    this.revealTerrain = false
    this.showResources = true
    this.debugSolidVisible = false
    this.debugPathVisible = false
    this.debugVisionVisible = false
    this.debugGridVisible = false
    this.debugCoordsVisible = false
    this.debugPerfVisible = false

    this.x = 0
    this.y = 0
    this.startingUnits = 3

    this.playersPos = []
    this.positionsCount = 2
    this.gaia = null
    this.resources = new Set()
    this.instanceBuckets = null

    this.eventMode = 'auto'
    this.allowMove = false
    this.allowClick = false
    this.totalCells

    this.mapGeneration = new MapGeneration(this)
    this.mapResources = new MapResources(this)
    this.mapTerrain = new MapTerrain(this)
    this.mapFog = new MapFog(this)
  }

  setCoordinate(x, y) {
    this.x = x
    this.y = y
  }

  _ensureBuckets() {
    if (this.instanceBuckets) return
    const bw = Math.ceil(this.grid.length / BUCKET_SIZE)
    const bh = Math.ceil(this.grid[0].length / BUCKET_SIZE)
    this.instanceBuckets = Array.from({ length: bw }, () => Array.from({ length: bh }, () => new Set()))
  }

  addToInstanceBucket(instance) {
    this._ensureBuckets()
    const bi = Math.floor(instance.i / BUCKET_SIZE)
    const bj = Math.floor(instance.j / BUCKET_SIZE)
    this.instanceBuckets[bi]?.[bj]?.add(instance)
  }

  removeFromInstanceBucket(instance) {
    if (!this.instanceBuckets) return
    const bi = Math.floor(instance.i / BUCKET_SIZE)
    const bj = Math.floor(instance.j / BUCKET_SIZE)
    this.instanceBuckets[bi]?.[bj]?.delete(instance)
  }

  updateInstanceBucket(instance, oldI, oldJ) {
    if (!this.instanceBuckets) return
    const oldBi = Math.floor(oldI / BUCKET_SIZE),
      oldBj = Math.floor(oldJ / BUCKET_SIZE)
    const newBi = Math.floor(instance.i / BUCKET_SIZE),
      newBj = Math.floor(instance.j / BUCKET_SIZE)
    if (oldBi !== newBi || oldBj !== newBj) {
      this.instanceBuckets[oldBi]?.[oldBj]?.delete(instance)
      this.instanceBuckets[newBi]?.[newBj]?.add(instance)
    }
  }

  // MapGeneration
  generateFromJSON(data) {
    return this.mapGeneration.generateFromJSON(data)
  }

  generateMap(positionsCountOverride = null, repeat = 0) {
    return this.mapGeneration.generateMap(positionsCountOverride, repeat)
  }

  stylishMap() {
    return this.mapGeneration.stylishMap()
  }

  generatePlayers(playersConfig = null) {
    return this.mapGeneration.generatePlayers(playersConfig)
  }

  placePlayers() {
    return this.mapGeneration.placePlayers()
  }

  generateCells() {
    return this.mapGeneration.generateCells()
  }

  generateTerrain(gridSize = 120, mapType = 'plain') {
    return this.mapGeneration.generateTerrain(gridSize, mapType)
  }

  generateSets() {
    return this.mapGeneration.generateSets()
  }

  findPlayerPlaces() {
    return this.mapGeneration.findPlayerPlaces()
  }

  // MapResources
  generateForestAroundPlayer(
    player,
    treeCount,
    clusterCount,
    minClusterRadius,
    maxClusterRadius,
    safeDistance,
    clearingProbability
  ) {
    return this.mapResources.generateForestAroundPlayer(
      player,
      treeCount,
      clusterCount,
      minClusterRadius,
      maxClusterRadius,
      safeDistance,
      clearingProbability
    )
  }

  placeAnimalHerd(player, quantity, range) {
    return this.mapResources.placeAnimalHerd(player, quantity, range)
  }

  generateAnimalsAroundPlayers(playersPos) {
    return this.mapResources.generateAnimalsAroundPlayers(playersPos)
  }

  generateResourcesAroundPlayers(playersPos) {
    return this.mapResources.generateResourcesAroundPlayers(playersPos)
  }

  generateNeutralResourceGroups(playersPos) {
    return this.mapResources.generateNeutralResourceGroups(playersPos)
  }

  findNeutralResourceCenter(playersPos, placedCenters, playerSafeDistance, minNeutralDistance) {
    return this.mapResources.findNeutralResourceCenter(
      playersPos,
      placedCenters,
      playerSafeDistance,
      minNeutralDistance
    )
  }

  placeResourceGroup(player, instance, quantity, range) {
    return this.mapResources.placeResourceGroup(player, instance, quantity, range)
  }

  placeResourceGroupAt(center, instance, quantity, clusterRadius) {
    return this.mapResources.placeResourceGroupAt(center, instance, quantity, clusterRadius)
  }

  // MapTerrain
  generateMapRelief() {
    return this.mapTerrain.generateMapRelief()
  }

  flattenPlayerStartZones(radius) {
    return this.mapTerrain.flattenPlayerStartZones(radius)
  }

  getReliefCoastDistances() {
    return this.mapTerrain.getReliefCoastDistances()
  }

  getMaxReliefLevelFromCoastDistance(distance) {
    return this.mapTerrain.getMaxReliefLevelFromCoastDistance(distance)
  }

  setCellReliefLevelDirect(cell, level) {
    return this.mapTerrain.setCellReliefLevelDirect(cell, level)
  }

  clampReliefAroundWater(dist) {
    return this.mapTerrain.clampReliefAroundWater(dist)
  }

  enforceReliefStepContinuity(dist) {
    return this.mapTerrain.enforceReliefStepContinuity(dist)
  }

  formatCellsRelief() {
    return this.mapTerrain.formatCellsRelief()
  }

  formatCellsWaterBorder() {
    return this.mapTerrain.formatCellsWaterBorder()
  }

  formatCellsDesert() {
    return this.mapTerrain.formatCellsDesert()
  }

  // MapFog
  bakeTerrainToChunks() {
    return this.mapFog.bakeTerrainToChunks()
  }

  _initFogChunks() {
    return this.mapFog._initFogChunks()
  }

  _indexFogChunkCells() {
    return this.mapFog._indexFogChunkCells()
  }

  _createFogPatternSprite(x, y, width, height) {
    return this.mapFog._createFogPatternSprite(x, y, width, height)
  }

  _getFogMapBounds() {
    return this.mapFog._getFogMapBounds()
  }

  _getFogCellBounds(cell) {
    return this.mapFog._getFogCellBounds(cell)
  }

  _getFogChunksForCell(cell) {
    return this.mapFog._getFogChunksForCell(cell)
  }

  _drawFogCellShape(graphics, cell) {
    return this.mapFog._drawFogCellShape(graphics, cell)
  }

  _getFogCellOpenSides(cell) {
    return this.mapFog._getFogCellOpenSides(cell)
  }

  _signedDistanceToFogSide(point, from, to, cell) {
    return this.mapFog._signedDistanceToFogSide(point, from, to, cell)
  }

  _clipFogErasePolygonBySide(points, from, to, cell, inset) {
    return this.mapFog._clipFogErasePolygonBySide(points, from, to, cell, inset)
  }

  _drawFogEraseCellShape(graphics, cell, inset) {
    return this.mapFog._drawFogEraseCellShape(graphics, cell, inset)
  }

  _getFogEraseRefreshCells(cell) {
    return this.mapFog._getFogEraseRefreshCells(cell)
  }

  _getFogCellCenter(cell) {
    return this.mapFog._getFogCellCenter(cell)
  }

  _getFogCellPoints(cell) {
    return this.mapFog._getFogCellPoints(cell)
  }

  _redrawFogEdgesInChunk(renderer, chunk) {
    return this.mapFog._redrawFogEdgesInChunk(renderer, chunk)
  }

  _drawVisibleCellsInChunk(graphics, chunk) {
    return this.mapFog._drawVisibleCellsInChunk(graphics, chunk)
  }

  _flushFogQueue() {
    return this.mapFog._flushFogQueue()
  }
}
