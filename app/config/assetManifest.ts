type AssetBundle = Record<string, string>

function toTextureBundle(basePath: string, ids: string[]): AssetBundle {
  return ids.reduce((bundle: AssetBundle, id) => {
    bundle[id] = `${basePath}/${id}/texture.json`
    return bundle
  }, {})
}

function toBuildingShadowBundle(ids: string[]): AssetBundle {
  return ids.reduce((bundle: AssetBundle, id) => {
    bundle[`${id}/shadow`] = `assets/graphics/${id}/texture_shadow.png`
    return bundle
  }, {})
}

function toOggSoundFolderBundle(folder: string, ids: string[]): AssetBundle {
  return ids.reduce((bundle: AssetBundle, id) => {
    bundle[id] = `assets/sounds/${folder}/${id}.ogg`
    return bundle
  }, {})
}

function toOggSoundBundle(ids: string[]): AssetBundle {
  return ids.reduce((bundle: AssetBundle, id) => {
    bundle[id] = `assets/sounds/${id}.ogg`
    return bundle
  }, {})
}

export const ASSET_BUNDLES: Record<string, AssetBundle> = {
  config: {
    caveBlueprints: 'maps/interiors/cave/catalog.json',
    buildingsData: 'assets/data/gameplay/buildings.json',
    unitsData: 'assets/data/gameplay/units.json',
    resourcesData: 'assets/data/gameplay/resources.json',
    animalsData: 'assets/data/gameplay/animals.json',
    projectilesData: 'assets/data/gameplay/projectiles.json',
    equipmentData: 'assets/data/gameplay/equipment.json',
    cellsData: 'assets/data/gameplay/cells.json',
    hellas: 'assets/data/civilizations/hellas.json',
    latium: 'assets/data/civilizations/latium.json',
    kemet: 'assets/data/civilizations/kemet.json',
    xia: 'assets/data/civilizations/xia.json',
    sumeria: 'assets/data/civilizations/sumeria.json',
    alba: 'assets/data/civilizations/alba.json',
    nord: 'assets/data/civilizations/nord.json',
    nobatia: 'assets/data/civilizations/nobatia.json',
  },
  interface: {
    'pointers/move-target': 'assets/interface/pointers/move-target/texture.json',
  },
  terrain: {
    'terrain/desert': 'assets/terrain/desert/texture.json',
    'terrain/grass': 'assets/terrain/grass/texture.json',
    'terrain/dark-grass': 'assets/terrain/dark-grass/texture.json',
    'terrain/jungle': 'assets/terrain/jungle/texture.json',
    'terrain/interior-walls/wood': 'assets/terrain/interior-walls/wood/texture.json',
    'terrain/interior-walls/dirt': 'assets/terrain/interior-walls/dirt/texture.json',
    'terrain/dirt': 'assets/terrain/dirt/texture.json',
    'terrain/snow': 'assets/terrain/snow/texture.json',
  },
  border: {
    'desert-sand-water-border': 'assets/border/desert-sand-water-border/texture.json',
    'desert-relief': 'assets/border/desert-relief/texture.json',
    'dark-grass-relief': 'assets/border/dark-grass-relief/texture.json',
    'dirt-relief': 'assets/border/dirt-relief/texture.json',
    'jungle-relief': 'assets/border/jungle-relief/texture.json',
    'snow-relief': 'assets/border/snow-relief/texture.json',
    'water-surface-filter': 'assets/border/water-surface-filter/texture.json',
  },
  graphics: {
    ...toTextureBundle('assets/graphics', [
      'buildings/age-0',
      'buildings/age-1',
      'buildings/wall/dithered',
      'resources/berrybush',
      'resources/wildgrass',
      'projectiles',
      'buildings/construction/size-2',
      'buildings/construction/size-3',
      'buildings/construction/size-5',
      'units/rider-legs',
      'effects/fire',
      'effects/smoke',
      'resources/wheat',
      'resources/tree/palm',
      'animals/boar',
      'animals/deer',
      'animals/hare',
      'animals/horse',
      'animals/black-grouse',
      'animals/fox',
      'animals/wolf',
      'resources/minerals',
      'resources/tree/grass',
      'resources/tree/dark-forest',
      'buildings/wall/construction-flag',
      'buildings/wall/level-1',
      'resources/tree/dead',
      'buildings/deco',
      'buildings/cave',
    ]),
    ...toBuildingShadowBundle([
      'buildings/cave',
      'buildings/age-0',
      'buildings/age-1',
      'buildings/wall/dithered',
      'buildings/wall/construction-flag',
      'buildings/wall/level-1',
      'resources/minerals',
    ]),
    'buildings/age-0/shadow': 'assets/graphics/buildings/age-0/texture_shadow.json',
    'buildings/age-1/shadow': 'assets/graphics/buildings/age-1/texture_shadow.json',
    'resources/minerals/shadow': 'assets/graphics/resources/minerals/texture_shadow.json',
  },
  sounds: {
    ...toOggSoundFolderBundle('ui', ['button-selected', 'attack-warning']),
    ...toOggSoundFolderBundle('player', ['next-age-reached']),
    ...toOggSoundFolderBundle('hero', ['heartbeat']),
    ...toOggSoundFolderBundle('combat', [
      'attack-swipe',
      'attack-class-2',
      'attack-class-2-2',
      'target-hit',
      'target-hit-2',
      'sword-attack',
      'sword-attack-2',
      'steel-attack',
      'swing-sword-attack',
      'tinkle-sword-attack',
    ]),
    ...toOggSoundFolderBundle('projectile', [
      'archer-attack',
      'arrow-shot',
      'ballista-bolt-shot',
      'ballista-bolt-shot-2',
      'ballista-bolt-shot-3',
      'ballista-bolt-shot-4',
      'ballista-bolt-shot-5',
      'catapult-stone-shot',
      'catapult-stone-shot-2',
      'catapult-stone-shot-3',
    ]),
    ...toOggSoundFolderBundle('villager', [
      'farming',
      'farming-2',
      'farming-3',
      'wood-chopping',
      'berry-gathering',
      'mining',
      'mining-2',
      'building',
    ]),
    ...toOggSoundFolderBundle('unit', [
      'deer-lion-killed',
      'elephant-alligator-killed',
      'elephant-selected',
      'elephant-selected-2',
      'elephant-unit-moving',
      'horse',
      'horse-2',
      'horse-3',
      'horse-4',
      'horse-moving',
      'horse-unit-attack',
      'horse-unit-die',
      'unknown-sound-2',
    ]),
    ...toOggSoundFolderBundle('building', [
      'building-burning',
      'building-burning-2',
      'building-burning-3',
      'building-destroyed',
      'building-destroyed-2',
      'building-destroyed-3',
      'constructing',
      'catapult-weapon-destroyed',
      'artifact-war-chest-moving',
    ]),
    ...toOggSoundFolderBundle('surface/water', ['water', 'small-splash']),
    ...toOggSoundBundle([
      'weather/light-rain',
      'weather/heavy-rain',
      'weather/light-wind',
      'weather/heavy-wind',
      'weather/morning-ambience',
      'weather/night-ambience',
      'weather/ocean-ambience',
      'building/campfire-crackle',
      'building/trap-recover',
      'building/chest-open',
      'building/door-open',
      'weather/thunder-1',
      'weather/thunder-2',
      'weather/thunder-3',
      'surface/hero-footstep-grass-1',
      'surface/hero-footstep-grass-2',
      'surface/hero-footstep-grass-3',
      'surface/hero-footstep-dirt-1',
      'surface/hero-footstep-dirt-2',
      'surface/hero-footstep-dirt-3',
      'surface/hero-footstep-stone-1',
      'surface/hero-footstep-stone-2',
      'surface/hero-footstep-stone-3',
      'surface/bush-rustling-1',
      'surface/bush-rustling-2',
      'surface/bush-rustling-3',
    ]),
  },
}

export const ASSET_LOAD_SEQUENCE = [
  { bundle: 'config', messageKey: 'loadingConfig' },
  { bundle: 'interface', messageKey: 'loadingInterface' },
  { bundle: 'terrain', messageKey: 'loadingTerrain' },
  { bundle: 'border', messageKey: 'loadingBorder' },
  { bundle: 'graphics', messageKey: 'loadingGraphics' },
  { bundle: 'sounds', messageKey: 'loadingSounds' },
]
