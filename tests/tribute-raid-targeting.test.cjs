const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')

const constants = {
  ACTION_TYPES: { attack: 'attack' },
  FADE_DURATION_MS: 200,
  PLAYER_TYPES: { ai: 'AI', bandits: 'Bandits', human: 'Human' },
  UNIT_TYPES: {
    banditArcher: 'BanditArcher',
    banditChief: 'BanditChief',
    banditSword: 'BanditSword',
    bowman: 'Bowman',
    chief: 'Chief',
    hero: 'Hero',
    infantry: 'Fantassin',
    villager: 'Villager',
  },
  WORK_TYPES: { attacker: 'attacker' },
}

function loadTributeRaidTargeting() {
  return loadTsModule('app/services/TributeRaidTargeting.ts', {
    mocks: {
      '../constants': constants,
      '../lib/chief': {
        hasLivingChief: player =>
          Boolean(player?.units?.some(unit => unit.type === constants.UNIT_TYPES.chief && !unit.isDead && !unit.isDestroyed)),
        isLivingChief: unit =>
          Boolean(unit?.type === constants.UNIT_TYPES.chief && !unit.isDead && !unit.isDestroyed),
      },
    },
  })
}

test('bandit raids are blocked when an active bandit camp already controls the map', () => {
  const { hasActiveBanditCampPresence } = loadTributeRaidTargeting()
  const context = {
    players: [
      {
        type: constants.PLAYER_TYPES.bandits,
        units: [{ hitPoints: 12 }],
        buildings: [],
      },
    ],
  }

  assert.equal(hasActiveBanditCampPresence(context), true)
})

test('destroyed bandit camps do not block later bandit raids', () => {
  const { hasActiveBanditCampPresence } = loadTributeRaidTargeting()
  const context = {
    players: [
      {
        type: constants.PLAYER_TYPES.bandits,
        units: [{ isDead: true, hitPoints: 0 }],
        buildings: [{ isDestroyed: true, hitPoints: 0 }],
      },
    ],
  }

  assert.equal(hasActiveBanditCampPresence(context), false)
})

test('bandit raids target a living allied ai chief before the hero', () => {
  const { findRaidTarget } = loadTributeRaidTargeting()
  const heroOwner = { isEnemy: () => false }
  const hero = { type: constants.UNIT_TYPES.hero, owner: heroOwner }
  const chief = { type: constants.UNIT_TYPES.chief }
  const alliedChiefOwner = {
    type: constants.PLAYER_TYPES.ai,
    isPlayed: false,
    isEnemy: () => false,
    units: [chief, { type: constants.UNIT_TYPES.villager }],
    buildings: [{ hitPoints: 150 }],
  }
  chief.owner = alliedChiefOwner
  const context = {
    controls: { heroUnit: hero },
    player: heroOwner,
    players: [heroOwner, alliedChiefOwner],
  }

  assert.equal(findRaidTarget(context, 'bandit'), chief)
})

test('bandit raids fall back to the hero without a credible local chief', () => {
  const { findRaidTarget } = loadTributeRaidTargeting()
  const heroOwner = { isEnemy: () => false }
  const hero = { type: constants.UNIT_TYPES.hero, owner: heroOwner }
  const enemyChiefOwner = {
    type: constants.PLAYER_TYPES.ai,
    isPlayed: false,
    isEnemy: () => true,
    units: [{ type: constants.UNIT_TYPES.chief }],
    buildings: [{ hitPoints: 150 }],
  }
  const context = {
    controls: { heroUnit: hero },
    player: heroOwner,
    players: [heroOwner, enemyChiefOwner],
  }

  assert.equal(findRaidTarget(context, 'bandit'), hero)
})

test('bandit raids keep targeting the hero when the player has the stronger local presence', () => {
  const { findRaidTarget } = loadTributeRaidTargeting()
  const heroOwner = {
    isEnemy: () => false,
    units: [
      { type: constants.UNIT_TYPES.hero },
      { type: constants.UNIT_TYPES.villager },
      { type: constants.UNIT_TYPES.villager },
    ],
    buildings: [{ hitPoints: 150 }, { hitPoints: 150 }],
  }
  const hero = { type: constants.UNIT_TYPES.hero, owner: heroOwner }
  heroOwner.units[0] = hero
  const chief = { type: constants.UNIT_TYPES.chief }
  const alliedChiefOwner = {
    type: constants.PLAYER_TYPES.ai,
    isPlayed: false,
    isEnemy: () => false,
    units: [chief],
    buildings: [{ hitPoints: 150 }],
  }
  chief.owner = alliedChiefOwner
  const context = {
    controls: { heroUnit: hero },
    player: heroOwner,
    players: [heroOwner, alliedChiefOwner],
  }

  assert.equal(findRaidTarget(context, 'bandit'), hero)
})
