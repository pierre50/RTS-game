export const SOUND_CUES = {
  ui: {
    buttonPress: 'button-selected',
    menuClick: 'completed-unknown',
    underAttack: 'attack-warning',
  },
  player: {
    ageAdvance: 'next-age-reached',
  },
  hero: {
    heartbeat: 'heartbeat',
    footstepGrass: [
      'surface/hero-footstep-grass-1',
      'surface/hero-footstep-grass-2',
      'surface/hero-footstep-grass-3',
    ],
    footstepDirt: [
      'surface/hero-footstep-dirt-1',
      'surface/hero-footstep-dirt-2',
      'surface/hero-footstep-dirt-3',
    ],
    footstepStone: [
      'surface/hero-footstep-stone-1',
      'surface/hero-footstep-stone-2',
      'surface/hero-footstep-stone-3',
    ],
    meleeWhiff: 'attack-swipe',
  },
  projectile: {
    arrowLaunch: ['archer-attack', 'archer-attack-2', 'archer-attack-3', 'archer-attack-4'],
  },
  unit: {
    fallbackCreate: null,
    horseMoving: 'horse-moving',
    militaryCommand: null,
    swordAttack: ['sword-attack', 'sword-attack-2'],
  },
  surface: {
    bushRustle: ['surface/bush-rustling-1', 'surface/bush-rustling-2', 'surface/bush-rustling-3'],
  },
  villager: {
    command: null,
    gatherFood: 'farming-3',
    chopWood: 'wood-chopping',
    forageBerry: 'berry-gathering',
    mineOre: 'mining-2',
    buildLoop: 'building',
    shootArrow: 'arrow-shot',
    takeMeat: 'berry-gathering',
  },
  building: {
    burning: ['building-burning', 'building-burning-2', 'building-burning-3'],
    flame: 'building/campfire-crackle',
    collapse: ['building-destroyed', 'building-destroyed-2', 'building-destroyed-3'],
  },
  weather: {
    rainLight: 'weather/light-rain',
    rainHeavy: 'weather/heavy-rain',
    windLight: 'weather/light-wind',
    windHeavy: 'weather/heavy-wind',
    night: 'weather/night-ambience',
    ocean: 'weather/ocean-ambience',
    thunder: ['weather/thunder-1', 'weather/thunder-2', 'weather/thunder-3'],
  },
}
