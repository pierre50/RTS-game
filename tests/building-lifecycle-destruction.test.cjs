const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')

test('destroyed buildings immediately drop shadow and solid footprint while rubble stays below units', () => {
  const calls = []
  let timeoutCallback = null
  const footprintCells = [
    { i: 4, j: 4, has: null, solid: true, corpses: new Set() },
    { i: 4, j: 5, has: null, solid: true, corpses: new Set() },
    { i: 5, j: 4, has: null, solid: true, corpses: new Set() },
    { i: 5, j: 5, has: null, solid: true, corpses: new Set() },
  ]
  const owner = {
    buildings: [],
    isPlayed: false,
    populationMax: 0,
  }
  const map = {
    grid: [],
    removeFromInstanceBucket: building => calls.push(['removeFromInstanceBucket', building.type]),
  }
  const menu = {
    updatePlayerMiniMapEvt: player => calls.push(['updatePlayerMiniMapEvt', player === owner]),
  }
  const player = {
    unselectAll: () => calls.push(['unselectAll']),
  }
  const building = {
    type: 'Barracks',
    i: 5,
    j: 5,
    size: 2,
    isDead: false,
    isDestroyed: false,
    selected: true,
    visible: true,
    hitPoints: 0,
    totalHitPoints: 100,
    owner,
    context: {
      map,
      player,
      players: [],
      menu,
      controls: {
        instanceIsAudible: () => false,
      },
      checkDefeat: () => calls.push(['checkDefeat']),
    },
    sprite: {
      eventMode: 'static',
      texture: null,
    },
    getChildByLabel: () => null,
    stopInterval: () => calls.push(['stopInterval']),
    clearRallyPoint: () => calls.push(['clearRallyPoint']),
    stopTimeout: () => calls.push(['stopTimeout']),
    startTimeout(callback, time) {
      timeoutCallback = callback
      calls.push(['startTimeout', time])
    },
    updateShadow: () => calls.push(['updateShadow', building.isDead]),
  }
  owner.buildings.push(building)
  for (const cell of footprintCells) cell.has = building

  const { BuildingLifecycle } = loadTsModule('app/classes/building/BuildingLifecycle.ts', {
    mocks: {
      'pixi.js': {
        AnimatedSprite: class {},
        Assets: {},
        Container: class {},
        Polygon: class {},
      },
      '../../constants': {
        ACTION_TYPES: { attack: 'attack', build: 'build' },
        BUILDING_TYPES: { banditCamp: 'BanditCamp' },
        LABEL_TYPES: {
          color: 'color',
          deco: 'deco',
          fire: 'fire',
          campfireDecorationFire: 'campfireDecorationFire',
        },
        MENU_INFO_IDS: { populationText: 'populationText' },
        PLAYER_TYPES: { ai: 'AI' },
        POPULATION_MAX: 200,
        RUBBLE_TIME: 12,
        SOUND_CUES: { building: { burning: 'burning', collapse: 'collapse' } },
      },
      '../../lib': {
        bindAnimatedSpriteToTicker: () => {},
        canUpdateMinimap: () => true,
        changeSpriteColorDirectly: () => {},
        getAnimationFrames: () => [],
        getBuildingAsset: () => ({ images: { final: { sheet: 'building', frame: 0 } } }),
        getBuildingAssetOwner: entity => entity.owner,
        getBuildingFootprintCells: (_i, _j, _grid, _size, callback) => {
          if (callback) footprintCells.forEach(callback)
          return footprintCells
        },
        getBuildingFootprintRadius: () => 0,
        getBuildingRubbleTextureNameWithSize: () => ({ sheet: 'buildings/rubble/size-2', frame: 0 }),
        getBuildingTextureNameWithSize: () => ({ sheet: 'buildings/construction/size-2', frame: 0 }),
        getPercentage: () => 0,
        getTexture: textureRef => ({ textureRef }),
        getTextureByFrame: () => ({}),
        getTextureSheet: textureRef => textureRef.sheet || textureRef,
        playAudibleSoundCue: () => {},
        playSoundCue: () => {},
        textureRefToString: textureRef => `${textureRef.sheet}:${textureRef.frame}`,
        updateInstanceVisibility: entity => calls.push(['updateInstanceVisibility', entity.type]),
      },
      '../../lib/buildings/walls': {
        getAdjacentWalls: () => [],
        isWall: () => false,
        updateWallAndNeighbours: () => {},
        updateWallTexture: () => {},
      },
    },
  })

  new BuildingLifecycle(building).die()

  assert.equal(building.isDead, true)
  assert.equal(building.sprite.eventMode, 'none')
  assert.equal(building.textureName, 'buildings/rubble/size-2:0')
  assert.equal(building.zIndex, 9.9)
  assert.ok(building.zIndex < building.i + building.j)
  assert.equal(owner.buildings.length, 0)
  assert.equal(typeof timeoutCallback, 'function')
  assert.deepEqual(
    footprintCells.map(cell => ({ has: cell.has, solid: cell.solid, hasCorpse: cell.corpses.has(building) })),
    [
      { has: null, solid: false, hasCorpse: true },
      { has: null, solid: false, hasCorpse: true },
      { has: null, solid: false, hasCorpse: true },
      { has: null, solid: false, hasCorpse: true },
    ]
  )
  assert.ok(calls.some(call => call[0] === 'updateShadow' && call[1] === true))
  assert.ok(calls.some(call => call[0] === 'updateInstanceVisibility'))
})
