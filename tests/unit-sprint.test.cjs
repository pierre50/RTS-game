const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')
const sprint = loadTsModule('app/lib/units/movement/unitSprint.ts')
const energy = loadTsModule('app/lib/units/unitEnergy.ts')
function unit(extra = {}) {
  return { energy: 10, totalEnergy: 10, i: 0, j: 0, context: { scheduler: { elapsedMs: 0 } }, ...extra }
}
function run(actor, frames = 20, npc = false, distance = 2) {
  for (let n = 0; n < frames; n++) {
    actor.context.scheduler.elapsedMs += 20
    const factor = sprint.getSprintMoveFactor(actor, true, npc)
    sprint.recordSprintMovement(actor, distance, 20, factor)
  }
}
test('running spends energy only for real movement and stops at exhaustion without restarting itself', () => {
  const hero = unit()
  sprint.toggleHeroSprint(hero)
  run(hero, 20, false, 0)
  assert.equal(hero.energy, 10)
  assert.equal(sprint.takeSprintAttackMultiplier(hero), 1)
  sprint.toggleHeroSprint(hero)
  run(hero, 50)
  assert.ok(Math.abs(hero.energy - 8) < 1e-8)
  run(hero, 250)
  assert.equal(hero.energy, 0)
  hero.energy = 10
  assert.equal(sprint.getSprintMoveFactor(hero, true), 1)
})
test('momentum requires an actual run and is paid and consumed once, even on a miss', () => {
  const hero = unit()
  sprint.toggleHeroSprint(hero)
  run(hero, 2)
  assert.equal(sprint.takeSprintAttackMultiplier(hero), 1)
  sprint.toggleHeroSprint(hero)
  run(hero)
  const before = hero.energy
  assert.equal(sprint.takeSprintAttackMultiplier(hero), 1.35)
  assert.equal(hero.energy, before - 2)
  assert.equal(sprint.takeSprintAttackMultiplier(hero), 1)
  assert.equal(sprint.getSprintMoveFactor(hero, true), 1)
})
test('no momentum survives a stopped, crouched, mounted, guarded, dead or interrupted run', () => {
  for (const patch of [
    { isCrouching: true },
    { mountedOnHorse: true },
    { heroDefenseActive: true },
    { actionLocked: true },
    { isDead: true },
  ]) {
    const hero = unit()
    sprint.toggleHeroSprint(hero)
    run(hero)
    Object.assign(hero, patch)
    assert.equal(sprint.getSprintMoveFactor(hero, true), 1)
    assert.equal(sprint.takeSprintAttackMultiplier(hero), 1)
  }
  const hero = unit()
  sprint.toggleHeroSprint(hero)
  run(hero)
  hero.context.scheduler.elapsedMs += 200
  assert.equal(sprint.takeSprintAttackMultiplier(hero), 1)
})
test('NPCs sprint only during distant attacks and keep an attack reserve with a restart delay', () => {
  const npc = unit({ action: 'attack', dest: { family: 'unit', i: 6, j: 0 } })
  assert.equal(sprint.getSprintMoveFactor(npc, true, true), 1.6)
  run(npc, 150, true)
  assert.ok(npc.energy >= 6)
  assert.equal(sprint.getSprintMoveFactor(npc, true, true), 1)
  npc.energy = 10
  assert.equal(sprint.getSprintMoveFactor(npc, true, true), 1)
  npc.context.scheduler.elapsedMs += 2000
  assert.equal(sprint.getSprintMoveFactor(npc, true, true), 1.6)
  for (const extra of [
    { action: 'build' },
    { dest: { family: 'unit', i: 1, j: 0 } },
    { combatMode: 'recover' },
    { energy: 5 },
  ]) {
    const other = unit({ action: 'attack', dest: npc.dest, ...extra })
    assert.equal(sprint.getSprintMoveFactor(other, true, true), 1)
  }
})
test('continuous sprint suppresses regeneration and low energy cannot purchase a bonus', () => {
  const hero = unit()
  sprint.toggleHeroSprint(hero)
  run(hero)
  const before = hero.energy
  energy.updateUnitEnergy(hero, 20)
  assert.equal(hero.energy, before)
  hero.energy = 3
  assert.equal(sprint.takeSprintAttackMultiplier(hero), 1)
  assert.equal(hero.energy, 3)
})
