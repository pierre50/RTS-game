const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')
const { PLAYER_TYPES } = loadTsModule('app/constants/entities.ts')
const { territoryBoundaryPaths, resolveWorldMapTerritories, renderWorldMapTerritories } = loadTsModule(
  require.resolve('../app/ui/worldMap/WorldMapTerritories.ts'),
  {
    mocks: {
      '../../lib/graphics/colors': { getHexColor: color => color },
      '../../lib/campaign/playerRoster': { factionIdForCivilization: civ => `civ-${civ.toLowerCase()}` },
      './WorldMapLegend': { settlementPlayerColor: () => '#f00' },
    },
  }
)
const territory = (x, y, key = 'a') => ({ key, color: '#f00', region: { x, y } })
const edges = paths => paths.reduce((sum, item) => sum + (item.path.match(/M/g) ?? []).length, 0)

test('adjacent maps share an outer contour with no internal border', () => {
  const paths = territoryBoundaryPaths([territory(0, 0), territory(1, 0)])
  assert.equal(paths.length, 1)
  assert.equal(edges(paths), 6)
  assert.ok(!paths[0].path.includes('M1,0V1'))
  assert.ok(!paths[0].path.includes('M1,1V0'))
})

test('contours follow concave territories and preserve holes', () => {
  assert.equal(edges(territoryBoundaryPaths([territory(0, 0), territory(1, 0), territory(0, 1)])), 8)
  const ring = []
  for (let x = 0; x < 3; x++) for (let y = 0; y < 3; y++) if (x !== 1 || y !== 1) ring.push(territory(x, y))
  assert.equal(edges(territoryBoundaryPaths(ring)), 16)
})

test('different owners with identical colors keep their shared border', () => {
  assert.equal(edges(territoryBoundaryPaths([territory(0, 0), territory(1, 0, 'b')])), 8)
})

function setup() {
  const settlement = { kind: 'village', civ: 'Hellas', region: { x: 0, y: 0 } }
  const manifest = {
    regionsWide: 2,
    regionsHigh: 1,
    settlements: [settlement],
    maps: [{ id: 'r0-0', region: { x: 0, y: 0 }, size: 144 }],
  }
  const owner = {
    type: PLAYER_TYPES.ai,
    civ: 'Hellas',
    color: '#f00',
    units: [{ hitPoints: 100 }],
    buildings: [{ hitPoints: 100 }],
  }
  const menu = { context: { map: { worldRegionId: 'r1-0' }, players: [], getWorldGraph: () => ({ nodes: {} }) } }
  return { manifest, menu, owner }
}

test('unvisited territories use settlements; saved defeated owners never reappear', () => {
  const { manifest, menu, owner } = setup()
  assert.equal(resolveWorldMapTerritories(menu, manifest)[0].key, 'civ-hellas')
  menu.context.getWorldGraph = () => ({ nodes: { saved: { id: 'saved' } } })
  menu.context.getCampaignWorldState = () => ({ config: { worldRegionId: 'r0-0' }, players: [owner] })
  assert.equal(resolveWorldMapTerritories(menu, manifest)[0].key, 'civ-hellas')
  owner.units = []
  assert.deepEqual(resolveWorldMapTerritories(menu, manifest), [])
})

test('live capture overrides both the manifest and stale saved state', () => {
  const { manifest, menu, owner } = setup()
  menu.context.map.worldRegionId = 'r0-0'
  menu.context.getWorldGraph = () => ({ nodes: { saved: { id: 'saved' } } })
  menu.context.getCampaignWorldState = () => ({ world: { worldRegionId: 'r0-0' }, players: [owner] })
  const captor = {
    factionId: 'self',
    colorHex: '#00f',
    isPlayed: true,
    units: [{ hitPoints: 100 }],
    buildings: [{ hitPoints: 100 }],
  }
  menu.context.players = [captor]
  assert.equal(resolveWorldMapTerritories(menu, manifest)[0].key, 'self')
  assert.equal(resolveWorldMapTerritories(menu, manifest)[0].color, '#00f')
  menu.context.players = []
  assert.deepEqual(resolveWorldMapTerritories(menu, manifest), [])
})

test('SVG overlay renders colored paths without intercepting map interaction', () => {
  const previous = global.document
  global.document = {
    createElementNS: () => ({
      attrs: {},
      children: [],
      classList: { add() {} },
      setAttribute(key, value) {
        this.attrs[key] = value
      },
      appendChild(child) {
        this.children.push(child)
      },
    }),
  }
  try {
    const { menu, manifest } = setup()
    const overlay = {
      appendChild(svg) {
        this.svg = svg
      },
    }
    renderWorldMapTerritories(overlay, menu, manifest)
    assert.equal(overlay.svg.children[1].attrs['clip-path'], `url(#${overlay.svg.children[0].attrs.id})`)
    assert.equal(overlay.svg.children[0].children.length, 1)
    assert.equal(overlay.svg.attrs.viewBox, '0 0 2 1')
    assert.equal(overlay.svg.children[1].attrs.stroke, '#f00')
    assert.equal(overlay.svg.children[1].attrs['vector-effect'], 'non-scaling-stroke')
  } finally {
    global.document = previous
  }
})

test('a saved human base keeps its territory while the hero travels elsewhere', () => {
  const { manifest, menu } = setup()
  menu.context.getWorldGraph = () => ({ nodes: { saved: { id: 'saved' } } })
  menu.context.getCampaignWorldState = () => ({
    world: { worldRegionId: 'r0-0' },
    players: [
      {
        factionId: 'self',
        colorHex: '#00f',
        isPlayed: true,
        type: PLAYER_TYPES.human,
        units: [],
        buildings: [{ hitPoints: 100, isBuilt: true }],
      },
    ],
  })
  assert.equal(resolveWorldMapTerritories(menu, manifest)[0].key, 'self')
})

test('saved territory borders use the current faction color rather than stale saved colors', () => {
  const { manifest, menu, owner } = setup()
  owner.color = 'grey'
  owner.colorHex = '#8f8f8f'
  menu.context.getWorldGraph = () => ({ nodes: { saved: { id: 'saved' } } })
  menu.context.getCampaignWorldState = () => ({ config: { worldRegionId: 'r0-0' }, players: [owner] })
  menu.context.getCampaignFactions = () => ({ 'civ-hellas': { id: 'civ-hellas', color: '#4b6b2b' } })
  assert.equal(resolveWorldMapTerritories(menu, manifest)[0].color, '#4b6b2b')
})
