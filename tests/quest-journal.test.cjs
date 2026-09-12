const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')

function element(tag) {
  return {
    tag, children: [], attributes: {}, events: {}, hidden: false, textContent: '', classList: { add() {} },
    append(...children) { this.children.push(...children) },
    appendChild(child) { this.children.push(child); return child },
    replaceChildren(...children) { this.children = children },
    setAttribute(key, value) { this.attributes[key] = value },
    addEventListener(key, callback) { this.events[key] = callback },
    remove() { this.removed = true }, blur() {},
  }
}
function descendants(node) { return [node, ...node.children.flatMap(descendants)] }

test('journal opens empty, shows accepted quests, tracks one and disposes its modal', t => {
  const oldDocument = global.document
  global.document = { createElement: element }
  t.after(() => { global.document = oldDocument })
  const { QuestJournalManager } = loadTsModule('app/ui/QuestJournalManager.ts', { mocks: {
    '../lib/lang': { t: key => key }, '../styles/quests.css': {},
    '../lib/ui/Modal': { Modal: class {
      constructor(options) { this._panel = element('dialog'); this._panel.append(options.content) }
      close() { this._panel.remove() }
    } },
  } })
  const state = { version: 1, quests: [], trackedQuestId: null }
  const menu = { context: { getQuestJournal: () => state }, gameHud: element('div'), closeHeroBuildingMenu() {}, playUiClick() {} }
  const journal = new QuestJournalManager(menu)
  const button = journal.createOpenButton()
  button.events.click()
  assert.equal(journal.isOpen(), true)
  assert.equal(descendants(journal.content).some(node => node.textContent === 'questJournalEmpty'), true)
  journal.system.definitions.set('test', { id: 'test', title: { key: 'mission' }, description: { key: 'description' }, stages: [{ id: 'delivery', objectives: [], interactions: [] }] })
  const quest = id => ({ id, definitionId: 'test', status: 'active', stageId: 'delivery', parameters: {}, owner: { name: 'chief' }, unread: true })
  state.quests.push(quest('a'), quest('b'), { ...quest('offer'), status: 'available' })
  journal.sync()
  assert.equal(state.quests[0].unread, false)
  assert.equal(state.quests[1].unread, true)
  const follow = descendants(journal.content).find(node => node.textContent === 'questTrack')
  follow.events.click()
  assert.equal(state.trackedQuestId, 'a')
  assert.equal(menu.gameHud.children[0].hidden, false)
  state.quests[0].status = 'completed'
  state.trackedQuestId = null
  journal.sync()
  assert.equal(descendants(journal.content).some(node => node.textContent === 'questStatus_completed'), true)
  assert.equal(menu.gameHud.children[0].hidden, true)
  assert.equal(descendants(journal.content).filter(node => node.className === 'quest-list-item ui-btn').length, 2)
  journal.destroy()
  assert.equal(journal.isOpen(), false)
  assert.equal(button.removed, true)
})

test('J toggles the journal, ignores repetition and does not act in editable fields', () => {
  const { handleControlsKeyDown } = loadTsModule('app/classes/ControlsKeyboard.ts', {
    mocks: { '../lib/audio/settings': { getControlActionForKeyboardEvent: () => 'quests' } },
  })
  let opened = false
  let editable = false
  const controls = {
    context: { menu: { isQuestJournalOpen: () => opened, toggleQuests: () => { opened = !opened }, closeQuests: () => { opened = false } } },
    isEditableTarget: () => editable, isInteractionBlocked: () => false,
  }
  const event = { key: 'j', repeat: false, preventDefault() {} }
  handleControlsKeyDown(controls, event)
  assert.equal(opened, true)
  handleControlsKeyDown(controls, { ...event, repeat: true })
  assert.equal(opened, true)
  handleControlsKeyDown(controls, event)
  assert.equal(opened, false)
  editable = true
  handleControlsKeyDown(controls, event)
  assert.equal(opened, false)
})
