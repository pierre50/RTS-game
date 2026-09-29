const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')

const destructionCases = [
  { name: 'storage building', type: 'Granary', inventory: { resources: { food: 9, wood: 3 }, equipment: ['trap'] } },
  { name: 'cancelled wheat sowing', type: 'Farm', delivered: {} },
  { name: 'cancelled empty house', type: 'House', delivered: {} },
  { name: 'cancelled spent materials', type: 'House', delivered: { wood: 0 } },
  {
    name: 'cancelled stocked construction',
    type: 'House',
    delivered: { wood: 3 },
  },
  { name: 'standalone chest', type: 'Chest', inventory: { resources: { wood: 12 } } },
  { name: 'equipment-only storage', type: 'Granary', inventory: { equipment: ['trap'] } },
]

for (const scenario of destructionCases) {
  test(`${scenario.name}: destruction frees the footprint, animates fragments and never spawns a chest`, () => {
    const calls = []
    const createdBuildings = []
    let timeoutCallback = null
    const constructionRevealSprite = {
      destroyed: false,
      parent: {
        removeChild: child => calls.push(['removeConstructionRevealChild', child === constructionRevealSprite]),
      },
      destroy: options => {
        constructionRevealSprite.destroyed = true
        calls.push(['destroyConstructionReveal', options])
      },
    }
    const constructionRevealMask = {
      destroyed: false,
      parent: {
        removeChild: child => calls.push(['removeConstructionRevealMaskChild', child === constructionRevealMask]),
      },
      destroy: options => {
        constructionRevealMask.destroyed = true
        calls.push(['destroyConstructionRevealMask', options])
      },
    }
    const shadow = {
      destroyed: false,
      parent: {
        removeChild: child => calls.push(['removeShadowChild', child === shadow]),
      },
      destroy: options => {
        shadow.destroyed = true
        calls.push(['destroyShadow', options])
      },
    }
    const footprintCells = [
      { i: 4, j: 4, x: 0, y: 128, zIndex: 8, has: null, solid: true, corpses: new Set() },
      { i: 4, j: 5, x: -32, y: 144, zIndex: 9, has: null, solid: true, corpses: new Set() },
      { i: 5, j: 4, x: 32, y: 144, zIndex: 9, has: null, solid: true, corpses: new Set() },
      { i: 5, j: 5, x: 0, y: 160, zIndex: 10, has: null, solid: true, corpses: new Set() },
    ]
    const owner = {
      wood: 0,
      buildings: [],
      createBuilding: options => {
        createdBuildings.push(options)
        const chest = { ...options, isDestroyed: false, isDead: false }
        owner.buildings.push(chest)
        return chest
      },
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
      inventory: scenario.inventory ? structuredClone(scenario.inventory) : undefined,
      type: scenario.type,
      isBuilt: !scenario.delivered,
      constructionMaterials: scenario.delivered
        ? { cost: { wood: 5 }, delivered: { ...scenario.delivered }, consumed: { wood: 2 } }
        : undefined,
      label: 'granary-1',
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
        visible: true,
        destroyed: false,
        mask: constructionRevealMask,
        alpha: 0.28,
        tint: 0x9f9888,
        destroy: options => {
          building.sprite.destroyed = true
          calls.push(['destroySprite', options])
        },
        parent: {
          removeChild: child => calls.push(['removeSpriteChild', child === building.sprite]),
        },
      },
      shadow,
      constructionRevealSprite,
      constructionRevealMask,
      getChildByLabel: () => null,
      stopInterval: () => calls.push(['stopInterval']),
      stopTimeout: () => calls.push(['stopTimeout']),
      cancelAllUnitTraining: () => calls.push(['cancelAllUnitTraining', building.isDead]),
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
        './BuildingSowing': { finishSowingTile: () => false },
        'pixi.js': {
          AnimatedSprite: class {},
          Assets: {},
          Container: class {},
          Polygon: class {},
        },
        '@pixi/sound': {
          sound: {
            play: () => ({ stop: () => {}, volume: 0 }),
          },
        },
        '../../constants': {
          ACTION_TYPES: { attack: 'attack', build: 'build' },
          BUILDING_TYPES: { chest: 'Chest', fireCamp: 'FireCamp' },
          LABEL_TYPES: {
            color: 'color',
            deco: 'deco',
            fire: 'fire',
            campfireDecorationFire: 'campfireDecorationFire',
          },
          MENU_INFO_IDS: { populationText: 'populationText' },
          PLAYER_TYPES: { ai: 'AI' },
          POPULATION_MAX: 200,
          SOUND_CUES: { building: { burning: 'burning', collapse: 'collapse', flame: 'flame' } },
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
          getHeroDistanceSoundVolume: () => 0,
          getBuildingTextureNameWithSize: () => ({ sheet: 'buildings/construction/size-2', frame: 0 }),
          getPercentage: () => 0,
          getTexture: textureRef => ({ textureRef }),
          getTextureByFrame: () => ({}),
          getTextureSheet: textureRef => textureRef.sheet || textureRef,
          playAudibleSoundCue: () => {},
          playSoundCue: () => {},
          spawnSpriteFragmentBurst: options => {
            assert.equal(options.sprite.alpha, 1)
            assert.equal(options.sprite.tint, 0xffffff)
            assert.equal(options.sprite.mask, null)
            assert.equal(options.sprite.destroyed, false)
            assert.equal(building.constructionRevealSprite, null)
            calls.push(['spawnSpriteFragmentBurst', options])
          },
          textureRefToString: textureRef => `${textureRef.sheet}:${textureRef.frame}`,
          updateInstanceVisibility: entity => calls.push(['updateInstanceVisibility', entity.type]),
        },
        '../../lib/buildings/walls': {
          getAdjacentWalls: () => [],
          isWall: () => false,
          updateWallAndNeighbours: () => {},
          updateWallTexture: () => {},
        },
        '../../services/BuildingInteriorSpaceSystem': {
          expelBuildingInteriorOccupants: (_context, target) =>
            calls.push(['expelBuildingInteriorOccupants', target.type]),
          destroyBuildingInteriorInventory: (_context, target) => {
            calls.push(['destroyBuildingInteriorInventory', target.type])
            if (target.inventory) target.inventory = { resources: {}, equipment: [] }
          },
        },
      },
    })

    const lifecycle = new BuildingLifecycle(building)
    lifecycle.die()
    // Repeated cancellation/destruction cannot refund or animate twice.
    lifecycle.die()
    assert.equal(owner.wood, 0)
    if (scenario.inventory) assert.deepEqual(building.inventory, { resources: {}, equipment: [] })
    assert.equal(calls.filter(call => call[0] === 'spawnSpriteFragmentBurst').length, 1)

    assert.equal(building.isDead, true)
    assert.equal(building.sprite.eventMode, 'none')
    assert.equal(building.sprite.visible, false)
    assert.equal(building.sprite.destroyed, true)
    assert.equal(constructionRevealSprite.destroyed, true)
    assert.equal(constructionRevealMask.destroyed, true)
    assert.equal(building.constructionRevealSprite, null)
    assert.equal(building.constructionRevealMask, null)
    assert.equal(building.sprite.mask, null)
    assert.equal(building.sprite.alpha, 1)
    assert.equal(building.sprite.tint, 0xffffff)
    assert.equal(shadow.destroyed, true)
    assert.equal(building.shadow, null)
    assert.equal(building.textureName, undefined)
    assert.equal(owner.buildings.length, 0)
    if (scenario.delivered) assert.deepEqual(building.constructionMaterials.delivered, {})
    assert.equal(typeof timeoutCallback, 'function')
    assert.ok(calls.some(call => call[0] === 'destroyBuildingInteriorInventory'))
    assert.ok(calls.some(call => call[0] === 'expelBuildingInteriorOccupants'))
    assert.deepEqual(
      calls.filter(call => call[0] === 'cancelAllUnitTraining'),
      [['cancelAllUnitTraining', false]]
    )
    assert.ok(
      calls.findIndex(call => call[0] === 'cancelAllUnitTraining') <
        calls.findIndex(call => call[0] === 'expelBuildingInteriorOccupants')
    )
    assert.deepEqual(
      footprintCells.map(cell => ({ has: cell.has, solid: cell.solid, hasCorpse: cell.corpses.has(building) })),
      [
        { has: null, solid: false, hasCorpse: false },
        { has: null, solid: false, hasCorpse: false },
        { has: null, solid: false, hasCorpse: false },
        { has: null, solid: false, hasCorpse: false },
      ]
    )
    const burstCall = calls.find(call => call[0] === 'spawnSpriteFragmentBurst')
    assert.equal(burstCall?.[1].host, building)
    assert.equal(burstCall?.[1].sprite, building.sprite)
    assert.equal(burstCall?.[1].lockX, true)
    assert.equal(burstCall?.[1].maxFragments, 60)
    assert.deepEqual(burstCall?.[1].groundTargets, [
      { x: 0, y: 128, zIndex: 8 },
      { x: -32, y: 144, zIndex: 9 },
      { x: 32, y: 144, zIndex: 9 },
      { x: 0, y: 160, zIndex: 10 },
    ])
    assert.deepEqual(createdBuildings, [])
    assert.ok(calls.some(call => call[0] === 'destroySprite'))
    assert.ok(calls.some(call => call[0] === 'destroyShadow'))
    assert.ok(calls.some(call => call[0] === 'updateInstanceVisibility'))
  })
}
