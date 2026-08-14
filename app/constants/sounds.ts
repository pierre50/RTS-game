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
    meleeWhiff: 'attack-swipe',
  },
  projectile: {
    arrowLaunch: ['archer-attack', 'archer-attack-2', 'archer-attack-3', 'archer-attack-4'],
  },
  unit: {
    fallbackCreate: 'human-unit-completed',
    horseMoving: 'horse-moving',
    militaryCommand: ['eventide', 'arectus', 'conan', 'werebus'],
  },
  villager: {
    command: 'olmars',
    gatherFood: 'farming-3',
    chopWood: 'wood-chopping',
    forageBerry: 'berry-gathering',
    mineOre: 'mining-2',
    buildLoop: 'building',
    throwSpear: 'arrow-shot',
    takeMeat: 'berry-gathering',
  },
  building: {
    burning: ['building-burning', 'building-burning-2', 'building-burning-3'],
    collapse: ['building-destroyed', 'building-destroyed-2', 'building-destroyed-3'],
  },
  weather: {
    rainLight: 'weather/light-rain',
    rainHeavy: 'weather/heavy-rain',
    windLight: 'weather/light-wind',
    windHeavy: 'weather/heavy-wind',
    thunder: ['weather/thunder-1', 'weather/thunder-2', 'weather/thunder-3'],
  },
}
