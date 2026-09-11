const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')

function loadTheft(reports = []) {
  return loadTsModule('app/lib/theft/theft.ts', {
    mocks: {
      '../../ai/AITheftDefense': { reportInteriorTheft: (...args) => reports.push(args) },
      '../combat/diplomaticAggression': {
        applyDiplomaticAggression: (source, target, options) => ({
          changed: Boolean(source?.owner && target?.owner),
          hostileNow: false,
          relation: source?.owner && target?.owner ? 'neutral' : 'unchanged',
          reason: options?.reason,
        }),
      },
    },
  })
}

test('horse theft applies diplomatic consequences against a foreign owner', () => {
  const { applyTheftConsequences, THEFT_SUBJECT_TYPES } = loadTheft()
  const actorOwner = { isPlayed: true, label: 'player' }
  const horseOwner = { label: 'neutral-ai' }

  assert.deepEqual(
    applyTheftConsequences({
      actor: { owner: actorOwner },
      owner: horseOwner,
      subject: THEFT_SUBJECT_TYPES.horse,
    }),
    {
      diplomatic: { changed: true, hostileNow: false, relation: 'neutral', reason: 'theft:horse' },
      stolen: true,
      subject: 'horse',
    }
  )
})

test('own horses are not theft', () => {
  const { applyTheftConsequences, THEFT_SUBJECT_TYPES } = loadTheft()
  const owner = { isPlayed: true, label: 'player' }

  assert.deepEqual(
    applyTheftConsequences({
      actor: { owner },
      owner,
      subject: THEFT_SUBJECT_TYPES.horse,
    }),
    {
      diplomatic: { changed: false, hostileNow: false, relation: 'unchanged' },
      stolen: false,
      subject: 'horse',
    }
  )
})

test('foreign chest transfers apply chest theft consequences', () => {
  const { applyTheftConsequences, THEFT_SUBJECT_TYPES } = loadTheft()
  const actorOwner = { isPlayed: true, label: 'player' }
  const chestOwner = { label: 'neutral-ai' }

  assert.deepEqual(
    applyTheftConsequences({
      actor: { owner: actorOwner },
      owner: chestOwner,
      subject: THEFT_SUBJECT_TYPES.chest,
    }),
    {
      diplomatic: { changed: true, hostileNow: false, relation: 'neutral', reason: 'theft:chest' },
      stolen: true,
      subject: 'chest',
    }
  )
})


test('foreign theft reports the actual actor after applying diplomatic consequences', () => {
  const reports = []
  const { applyTheftConsequences } = loadTheft(reports)
  const owner = { label: 'ai' }
  const actor = { family: 'unit', owner: { label: 'hero', isPlayed: true } }
  applyTheftConsequences({ actor, owner, subject: 'chest' })
  assert.deepEqual(reports, [[owner, actor]])
  applyTheftConsequences({ actor, owner: actor.owner, subject: 'chest' })
  assert.equal(reports.length, 1)
})
