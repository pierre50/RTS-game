const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')
const definitions = require('../public/assets/data/gameplay/buildings.json')
const { createConstructionSite, constructionSiteOptions } = loadTsModule('app/ui/ConstructionSite.ts')
class Element {
  constructor() {
    this.children = []
    this.textContent = ''
    this.className = ''
    this.classList = {
      add: name => {
        this.className += ` ${name}`
      },
    }
  }
  get childElementCount() {
    return this.children.length
  }
  append(...children) {
    this.children.push(...children)
  }
  appendChild(child) {
    this.append(child)
    return child
  }
  setAttribute() {}
  find(name) {
    if (this.className.split(' ').includes(name)) return this
    for (const child of this.children) {
      const found = child.find(name)
      if (found) return found
    }
    return null
  }
}
function withDocument(callback) {
  const previous = global.document
  global.document = { createElement: () => new Element() }
  try {
    callback()
  } finally {
    global.document = previous
  }
}
test('catalogue card shows resource icons and whole game hours with assumptions only in the tooltip', () =>
  withDocument(() => {
    const card = createConstructionSite({ config: definitions.House, level: 0, cost: definitions.House.cost })
    assert.equal(card.find('construction-site-duration').textContent, '1 h de jeu')
    assert.equal(card.find('resource-cost-list').children.length, 2)
    assert.equal(card.find('resource-cost-list').children[0].children[1].textContent, '40')
    assert.match(card.find('construction-site-time').title, /2 ouvriers novices/)
    assert.ok(card.find('construction-site-hourglass').innerHTML.includes('<svg'))
  }))
test('active card preserves delivered and consumed totals and estimates remaining renovation work', () =>
  withDocument(() => {
    const site = {
      type: 'Forge',
      owner: { config: { buildings: definitions } },
      isBuilt: true,
      buildingUpgrade: {
        targetLevel: 1,
        constructionTime: definitions.Forge.levelStats[1].constructionWorkRequired,
        constructionProgress: 0.5,
      },
      constructionMaterials: {
        cost: { wood: 70, stone: 40 },
        delivered: { wood: 20, stone: 10 },
        consumed: { wood: 50, stone: 30 },
      },
    }
    const card = createConstructionSite(constructionSiteOptions(site))
    assert.equal(card.find('construction-site-duration').textContent, 'Reste : 2 jours de jeu')
    assert.equal(card.find('resource-cost-list').children[0].children[1].textContent, '70/70 ✓')
    assert.equal(card.find('construction-site-progress').value, 50)
    assert.equal(card.find('construction-work-status').children.at(-1).textContent, '50%')
    site.constructionPaused = true
    const paused = createConstructionSite(constructionSiteOptions(site))
    assert.equal(paused.find('construction-work-status').children.at(-1).textContent, '⏸')
    assert.equal(paused.find('construction-site-progress').value, 50)
  }))
test('delivery phase shows material progress, and old paid projects never appear unfunded', () =>
  withDocument(() => {
    const site = {
      type: 'House',
      owner: { config: { buildings: definitions } },
      isBuilt: false,
      constructionProgress: 0,
      constructionWorkRequired: definitions.House.constructionWorkRequired,
      constructionMaterials: { cost: { wood: 40, stone: 10 }, delivered: { wood: 25 }, consumed: {} },
    }
    const card = createConstructionSite(constructionSiteOptions(site))
    assert.equal(card.find('resource-cost-list').children[0].children[1].textContent, '25/40')
    assert.equal(card.find('construction-work-status').children[0].textContent, 'Livraison')
    assert.equal(card.find('construction-site-progress'), null)
    delete site.constructionMaterials
    const legacy = createConstructionSite(constructionSiteOptions(site))
    assert.equal(legacy.find('resource-cost-list').children[0].children[1].textContent, '40/40 ✓')
  }))
