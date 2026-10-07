const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')

test('opening the trap menu leaves it intact; dismantling is explicit and rechecks reach', () => {
  let dismantled = 0
  let closed = 0
  const { heroTrapButton } = loadTsModule('app/ui/hero-building/HeroTrapButton.ts', {
    mocks: {
      '../../lib/hero/heroActionRange': {
        isHeroInteractionTargetReachable: (_hero, _action, target) => target.reachable,
      },
      '../../lib/grid/visibility': { instanceIsInActiveOrTeamSight: target => target.visible },
      '../../lib/lang': { t: key => key },
      '../../services/world/TrapHarvestSystem': {
        dismantleTrapBuilding: (_hero, building) => {
          dismantled++
          building.isDead = true
          return true
        },
      },
    },
  })
  const building = { isBuilt: true, reachable: true, visible: true, requiresActiveSightInteraction: true }
  const button = heroTrapButton({ context: { controls: { heroUnit: {} } } }, building, () => closed++)
  assert.equal(dismantled, 0)
  building.reachable = false
  button.onClick()
  assert.equal(dismantled, 0)
  building.reachable = true
  button.onClick()
  button.onClick()
  assert.equal(dismantled, 1)
  assert.equal(closed, 1)
})
