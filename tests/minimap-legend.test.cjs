const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')

function makeElement(tag = 'div') {
  return {
    tag,
    children: [],
    className: '',
    textContent: '',
    classList: {
      toggle(className, active) {
        if (active) this.toggled = className
      },
    },
    append(...children) {
      this.children.push(...children)
    },
    appendChild(child) {
      this.children.push(child)
      return child
    },
    replaceChildren(...children) {
      this.children = children
    },
  }
}

function withFakeDocument(fn) {
  const previousDocument = global.document
  global.document = { createElement: tag => makeElement(tag) }
  try {
    return fn()
  } finally {
    global.document = previousDocument
  }
}

function loadLegend() {
  return loadTsModule('app/ui/minimap/MinimapLegend.ts', {
    mocks: {
      '../../constants': {
        BUILDING_TYPES: {
          archeryRange: 'ArcheryRange',
          barracks: 'Barracks',
          chest: 'Chest',
          fireCamp: 'FireCamp',
          granary: 'Granary',
          house: 'House',
          market: 'Market',
          stable: 'Stable',
          storagePit: 'StoragePit',
          temple: 'Temple',
          townCenter: 'TownCenter',
          trap: 'Trap',
          watchTower: 'WatchTower',
        },
      },
      '../../lib/lang': {
        t: (key, vars) => (vars?.name ? `${key}:${vars.name}` : key),
      },
    },
  })
}

test('minimap building legend only counts age atlas buildings', () => {
  withFakeDocument(() => {
    const { renderMinimapLegend } = loadLegend()
    const container = makeElement()
    const player = {
      units: [],
      buildings: [
        { type: 'TownCenter', isBuilt: true },
        { type: 'House', isBuilt: true },
        { type: 'House', isBuilt: true },
        { type: 'Barracks', isBuilt: false },
        { type: 'Trap', isBuilt: true },
        { type: 'Chest', isBuilt: true },
        { type: 'FireCamp', isBuilt: true },
        { type: 'CampTotemPlain', isBuilt: true },
        { assetType: 'StoragePit', type: 'Chest', isBuilt: true },
        { type: 'TownCenter', isDead: true, isBuilt: true },
      ],
    }

    renderMinimapLegend(container, player)

    const buildingRows = container.children[1].children.slice(1)
    assert.deepEqual(
      buildingRows.map(row => [row.children[0].textContent, row.children[1].textContent]),
      [
        ['2', 'House'],
        ['1', 'minimapLegendConstructing:Barracks'],
        ['1', 'Storage Pit'],
        ['1', 'Town Center'],
      ]
    )
  })
})
