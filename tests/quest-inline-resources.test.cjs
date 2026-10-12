const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')

function element(tag = 'text', textContent = '') {
  return {
    tag, textContent, children: [],
    appendChild(child) { this.children.push(child) },
    replaceChildren() { this.children = [] },
  }
}
function descendants(node) { return [node, ...node.children.flatMap(descendants)] }
function plain(node) { return node.textContent + node.children.map(plain).join('') }

test('inline quest prose keeps context, shows resource sprites and never interprets HTML', t => {
  const previous = global.document
  global.document = { createElement: element, createTextNode: text => element('text', text) }
  t.after(() => { global.document = previous })
  const { renderQuestResourceText } = loadTsModule('app/ui/quests/QuestResources.ts', {
    mocks: {
      '../../lib/lang': { t: key => key },
      '../ResourceCost': { createResourceIcon: resource => ({ ...element('img'), resource }) },
    },
  })
  const root = element('p')
  const line = 'Bring 5 berries to <chief>. Reward: 5 gold.'
  renderQuestResourceText(root, line)
  assert.equal(plain(root), 'Bring 5  berries to <chief>. Reward: 5  gold.')
  assert.deepEqual(descendants(root).filter(node => node.tag === 'img').map(node => node.resource), ['berry', 'gold'])
  assert.equal(descendants(root).filter(node => node.tag === 'strong').length, 2)
  renderQuestResourceText(root, 'Bring 10 pieces of wood (3/10)')
  assert.deepEqual(descendants(root).filter(node => node.tag === 'img').map(node => node.resource), ['wood'])
  assert.match(plain(root), /\(3\/10\)/)
  renderQuestResourceText(root, 'Meet 5 goldsmiths')
  assert.equal(descendants(root).filter(node => node.tag === 'img').length, 0)
})
