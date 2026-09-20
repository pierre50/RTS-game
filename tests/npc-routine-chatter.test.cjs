const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')
let language = 'fr'
let choice = 0
const { pickNpcRoutineChatterLine: pick } = loadTsModule('app/lib/npc/npcRoutineChatter.ts', {
  mocks: {
    '../lang': { getLang: () => language },
    '../random': { pickRandomItem: lines => lines[choice % lines.length] },
  },
})
const { NPC_ROUTINE_LINES } = loadTsModule('app/lib/npc/npcRoutineLines.ts')

function scenario({
  own = true,
  chief = true,
  speakerChief = false,
  hour = 12,
  minute = 0,
  job = 'wood',
  relation = 'neutral',
} = {}) {
  const owner = { isPlayed: true }
  const hero = { type: 'Hero', isChief: chief, owner }
  const unit = {
    type: 'Villager',
    label: 'speaker',
    i: 0,
    j: 0,
    isChief: speakerChief,
    owner: own ? owner : { isPlayed: false, factionId: 'other' },
    autonomousJob: job,
    dailySchedule: { wakeMinute: 370, workStartMinute: 430, workEndMinute: 1090, bedMinute: 1330 },
    context: {
      dayNight: { state: { hour, minute } },
      getCampaignFactions: () => ({ other: { relationState: relation } }),
    },
  }
  return { unit, hero }
}

test('morning and evening have distinct lines for own chief, peers, visiting chiefs and visitors in both languages', () => {
  for (language of ['fr', 'en']) {
    for (const [phase, hour] of [
      ['morning', 6],
      ['evening', 19],
    ]) {
      const firstLines = new Set()
      for (const [audience, own, chief] of [
        ['ownChief', true, true],
        ['ownPeer', true, false],
        ['foreignChief', false, true],
        ['visitor', false, false],
      ]) {
        const { unit, hero } = scenario({ own, chief, hour, minute: 30 })
        const expected = NPC_ROUTINE_LINES[language].rest[phase][audience]
        for (choice = 0; choice < expected.length; choice++) assert.equal(pick(unit, hero), expected[choice])
        firstLines.add(expected[0])
      }
      assert.equal(firstLines.size, 4)
    }
  }
})

test('every autonomous job has work lines with chief address only for the actual own chief', () => {
  for (language of ['fr', 'en']) {
    const catalog = NPC_ROUTINE_LINES[language]
    for (const job of ['food', 'wood', 'stone', 'gold', 'copper', 'iron', 'construction', 'horseCapture']) {
      for (const own of [true, false])
        for (const chief of [true, false]) {
          const { unit, hero } = scenario({ own, chief, job })
          for (choice = 0; choice < catalog.jobs[job].length; choice++) {
            const line = pick(unit, hero)
            const address = own && chief ? (language === 'fr' ? ', chef' : ', chief') : ''
            assert.ok(line.startsWith(catalog.jobs[job][choice].replace('{address}', address)))
            assert.ok(!line.includes('{address}'))
            if (!own) assert.ok(line.includes(catalog.foreignWork.neutral[chief ? 'foreignChief' : 'visitor'][0]))
          }
        }
    }
  }
})

test('the personal schedule selects exact rest and work boundaries without requiring shelter state', () => {
  language = 'fr'
  choice = 0
  const { unit, hero } = scenario({ chief: false })
  for (const [minute, phase] of [
    [370, 'morning'],
    [429, 'morning'],
    [430, 'work'],
    [1089, 'work'],
    [1090, 'evening'],
    [1329, 'evening'],
  ]) {
    unit.context.dayNight.state = { hour: Math.floor(minute / 60), minute: minute % 60 }
    const line = pick(unit, hero)
    assert.equal(
      line,
      phase === 'work'
        ? NPC_ROUTINE_LINES.fr.jobs.wood[0].replace('{address}', '')
        : NPC_ROUTINE_LINES.fr.rest[phase].ownPeer[0]
    )
  }
  unit.context.dayNight.state = { hour: 22, minute: 10 }
  assert.notEqual(pick(unit, hero), NPC_ROUTINE_LINES.fr.rest.evening.ownPeer[0])
})

test('a chief speaks for their village instead of offering a worker greeting', () => {
  for (language of ['fr', 'en'])
    for (const own of [true, false])
      for (const chief of [true, false]) {
        for (const [hour, phase] of [
          [6, 'morning'],
          [12, 'work'],
          [19, 'evening'],
          [23, 'idle'],
        ]) {
          choice = 0
          const { unit, hero } = scenario({ own, chief, speakerChief: true, hour, minute: 30 })
          const audience = own ? (chief ? 'ownChief' : 'ownPeer') : chief ? 'foreignChief' : 'visitor'
          assert.equal(
            pick(unit, hero),
            `${NPC_ROUTINE_LINES[language].chief[phase][0]} ${NPC_ROUTINE_LINES[language].chiefGreeting[audience][0]}`
          )
        }
      }
})

test('foreign workers preserve faction relations without treating the visitor as their chief', () => {
  language = 'fr'
  choice = 0
  for (const [relation, mood] of [
    ['wary', 'wary'],
    ['neutral', 'neutral'],
    ['friendly', 'friendly'],
    ['allied', 'friendly'],
  ]) {
    const { unit, hero } = scenario({ own: false, relation })
    assert.ok(pick(unit, hero).endsWith(NPC_ROUTINE_LINES.fr.foreignWork[mood].foreignChief[0]))
  }
})

test('sleep overrides routines and only an own chief gets a chief-addressed wake response', () => {
  language = 'fr'
  choice = 0
  for (const own of [true, false])
    for (const chief of [true, false]) {
      const { unit, hero } = scenario({ own, chief, hour: 6, minute: 30 })
      unit.shelterState = { reason: 'sleep' }
      unit.sleepVisualState = 'sleeping'
      assert.equal(pick(unit, hero), own && chief ? 'Zzz... hein ? Quoi, chef ?' : 'Zzz... zzz...')
      unit.sleepVisualState = null
      assert.equal(pick(unit, hero, { sleeping: true }), own && chief ? 'Zzz... hein ? Quoi, chef ?' : 'Zzz... zzz...')
    }
})

test('idle, unsupported jobs, non-villagers and missing heroes have usable fallback lines', () => {
  language = 'fr'
  choice = 0
  for (const job of [null, 'future-job']) {
    const { unit, hero } = scenario({ job })
    assert.equal(pick(unit, hero, { playerName: 'Ada' }), 'Que puis-je faire pour vous, Ada ?')
    assert.ok(pick(unit, undefined))
  }
  const { unit, hero } = scenario({ hour: 6, minute: 30 })
  unit.type = 'Fantassin'
  assert.equal(pick(unit, hero), 'Que puis-je faire pour vous, chef ?')
})

test('AI work without autonomousJob uses its active assignment, including mining interrupted by talking', () => {
  language = 'fr'
  choice = 0
  for (const [work, job] of [
    ['woodcutter', 'wood'],
    ['stoneminer', 'stone'],
    ['goldminer', 'gold'],
    ['builder', 'construction'],
    ['horseCapture', 'horseCapture'],
    ['farmer', 'food'],
    ['hunter', 'food'],
    ['forager', 'food'],
  ]) {
    const { unit, hero } = scenario({ own: false, chief: false, job: null })
    unit.work = work
    assert.ok(pick(unit, hero).startsWith(NPC_ROUTINE_LINES.fr.jobs[job][0].replace('{address}', '')))
  }
  for (const [resource, job] of [
    ['Copper', 'copper'],
    ['Iron', 'iron'],
  ]) {
    const { unit, hero } = scenario({ own: false, chief: false, job: null })
    unit.work = 'goldminer'
    unit.lookingAtHero = true
    unit.previousDest = { type: resource }
    assert.ok(pick(unit, hero).startsWith(NPC_ROUTINE_LINES.fr.jobs[job][0].replace('{address}', '')))
  }
})

test('legacy Chief units also use morning and evening dialogue', () => {
  language = 'fr'
  choice = 0
  const { unit, hero } = scenario({ own: false, hour: 6, minute: 30 })
  unit.type = 'Chief'
  assert.ok(pick(unit, hero).startsWith(NPC_ROUTINE_LINES.fr.chief.morning[0]))
  unit.context.dayNight.state.hour = 19
  assert.ok(pick(unit, hero).startsWith(NPC_ROUTINE_LINES.fr.chief.evening[0]))
})

test('an autonomous assignment takes priority over a previous work animation role', () => {
  language = 'fr'
  choice = 0
  const { unit, hero } = scenario({ job: 'construction' })
  unit.work = 'woodcutter'
  assert.equal(pick(unit, hero), NPC_ROUTINE_LINES.fr.jobs.construction[0].replace('{address}', ', chef'))
})

test('foreign morning and evening rest reflects faction relations for visitors and visiting chiefs', () => {
  for (language of ['fr', 'en']) {
    const catalog = NPC_ROUTINE_LINES[language]
    for (const chief of [false, true]) {
      const audience = chief ? 'foreignChief' : 'visitor'
      for (const [hour, phase] of [
        [6, 'morning'],
        [19, 'evening'],
      ]) {
        const variants = new Set()
        for (const [relation, mood] of [
          ['wary', 'wary'],
          ['neutral', 'neutral'],
          ['friendly', 'friendly'],
          ['allied', 'friendly'],
        ]) {
          const { unit, hero } = scenario({ own: false, chief, hour, minute: 30, relation })
          const expected =
            mood === 'neutral' ? catalog.rest[phase][audience] : catalog.foreignRest[mood][phase][audience]
          for (choice = 0; choice < expected.length; choice++) assert.equal(pick(unit, hero), expected[choice])
          variants.add(expected[0])
        }
        assert.equal(variants.size, 3)
      }
    }
  }
})

test('foreign chiefs adapt their greeting to relations throughout their daily routine', () => {
  for (language of ['fr', 'en']) {
    const catalog = NPC_ROUTINE_LINES[language]
    for (const chief of [false, true]) {
      const audience = chief ? 'foreignChief' : 'visitor'
      for (const [hour, phase] of [
        [6, 'morning'],
        [12, 'work'],
        [19, 'evening'],
        [23, 'idle'],
      ]) {
        const variants = new Set()
        for (const [relation, mood] of [
          ['wary', 'wary'],
          ['neutral', 'neutral'],
          ['friendly', 'friendly'],
          ['allied', 'friendly'],
        ]) {
          const { unit, hero } = scenario({ own: false, chief, speakerChief: true, hour, minute: 30, relation })
          const expected =
            mood === 'neutral' ? catalog.chiefGreeting[audience] : catalog.foreignChiefGreeting[mood][audience]
          for (choice = 0; choice < Math.max(expected.length, catalog.chief[phase].length); choice++) {
            assert.equal(
              pick(unit, hero),
              `${catalog.chief[phase][choice % catalog.chief[phase].length]} ${expected[choice % expected.length]}`
            )
          }
          variants.add(expected[0])
        }
        assert.equal(variants.size, 3)
      }
    }
  }
})

test('relation changes apply on the next conversation, with neutral fallback for missing diplomacy', () => {
  language = 'fr'
  choice = 0
  for (const speakerChief of [false, true]) {
    const { unit, hero } = scenario({ own: false, speakerChief, hour: 19, relation: 'wary' })
    const wary = pick(unit, hero)
    unit.context.getCampaignFactions = () => ({ other: { relationState: 'friendly' } })
    assert.notEqual(pick(unit, hero), wary)
    unit.context.getCampaignFactions = () => ({ other: { relationState: 'neutral' } })
    const neutral = pick(unit, hero)
    delete unit.context.getCampaignFactions
    assert.equal(pick(unit, hero), neutral)
    delete unit.owner.factionId
    assert.equal(pick(unit, hero), neutral)
  }
})

test('diplomacy does not change own-group rest, chief greetings or sleeping responses', () => {
  for (language of ['fr', 'en'])
    for (const chief of [false, true])
      for (const speakerChief of [false, true]) {
        choice = 0
        const { unit, hero } = scenario({ chief, speakerChief, hour: 19 })
        unit.owner.factionId = 'other'
        const baseline = pick(unit, hero)
        for (const relation of ['wary', 'friendly', 'allied']) {
          unit.context.getCampaignFactions = () => ({ other: { relationState: relation } })
          assert.equal(pick(unit, hero), baseline)
        }
        unit.owner = { factionId: 'other', isPlayed: false }
        const sleeping = pick(unit, hero, { sleeping: true })
        unit.context.getCampaignFactions = () => ({ other: { relationState: 'wary' } })
        assert.equal(pick(unit, hero, { sleeping: true }), sleeping)
      }
})
