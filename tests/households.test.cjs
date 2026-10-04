const test = require('node:test')
const assert = require('node:assert/strict')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')
const homes = loadTsModule('app/lib/housing/households.ts')
const { getPopulationCapacityFromBuildings } = loadTsModule('app/lib/buildings/buildingOccupancy.ts')
function fixture() {
  const owner = { label: 'village', type: 'AI', units: [], buildings: [] }
  const add = (label, gender = 'male') => { const unit = { type: 'Villager', label, name: label, gender }; owner.units.push(unit); return unit }
  for (let i = 0; i < 3; i++) owner.buildings.push({ type: 'House', label: `h${i}`, i: i * 10, j: 0, isBuilt: true })
  return { owner, add }
}
test('generation creates stable couples, homes and exact future bed IDs without rendering interiors', () => {
  const { owner, add } = fixture()
  const a = add('Alice', 'female'), b = add('Bob'), c = add('Charlie')
  homes.createInitialHouseholdPartners(owner)
  homes.reconcileHouseholds(owner)
  assert.equal(a.partnerLabel, b.label)
  assert.equal(b.partnerLabel, a.label)
  assert.equal(a.homeHouseLabel, b.homeHouseLabel)
  assert.notEqual(a.homeBedLabel, b.homeBedLabel)
  assert.notEqual(c.homeHouseLabel, a.homeHouseLabel)
  assert.match(a.homeBedLabel, /^interior:village:h\d:default:bedroll-/)
  assert.equal(getPopulationCapacityFromBuildings(owner.buildings, owner), 6)
  const saved = JSON.parse(JSON.stringify(owner))
  homes.reconcileHouseholds(saved)
  assert.deepEqual(saved, owner)
})
test('daily newcomers occupy vacant houses without marrying or moving existing residents', () => {
  const { owner, add } = fixture()
  const first = add('First')
  homes.reconcileHouseholds(owner)
  const previous = { ...first }
  const second = add('Second', 'female')
  homes.reconcileHouseholds(owner)
  assert.notEqual(first.homeHouseLabel, second.homeHouseLabel)
  assert.equal(second.partnerLabel, undefined)
  assert.deepEqual(first, previous)
  assert.equal(homes.getVacantHomeCount(owner), 1)
  add('Third'); add('Fourth')
  homes.reconcileHouseholds(owner)
  assert.equal(homes.getVacantHomeCount(owner), 0)
  assert.equal(owner.units.filter(u => !u.homeHouseLabel).length, 1)
})
test('loaded interiors replace planned beds; removing a bed never regenerates it or evicts the household', () => {
  const { owner, add } = fixture()
  const resident = add('Resident')
  homes.reconcileHouseholds(owner)
  const house = owner.buildings.find(b => b.label === resident.homeHouseLabel)
  const ids = house.plannedBedLabels
  house.interiorBuildings = ids.map(label => ({ type: 'CampBedroll', isBuilt: true, label }))
  delete house.plannedBedLabels
  homes.reconcileHouseholds(owner)
  assert.equal(resident.homeBedLabel, ids[0])
  house.interiorBuildings.shift()
  house.interiorUnfurnished = true
  homes.reconcileHouseholds(owner)
  assert.equal(resident.homeBedLabel, ids[1])
  house.buildingUpgrade = { targetLevel: 1 }
  homes.reconcileHouseholds(owner)
  assert.equal(resident.homeBedLabel, ids[1])
  assert.equal(resident.homeHouseLabel, house.label)
  assert.equal(getPopulationCapacityFromBuildings(owner.buildings, owner), 4)
  house.isDead = true
  homes.reconcileHouseholds(owner)
  assert.notEqual(resident.homeHouseLabel, house.label)
})
test('hero chooses a vacant home, releases the previous one, and cannot evict another household', () => {
  const { owner, add } = fixture()
  const resident = add('Resident')
  const hero = add('Hero'); hero.type = 'Hero'
  homes.reconcileHouseholds(owner)
  assert.equal(hero.homeHouseLabel, undefined)
  const [occupied, first, second] = owner.buildings
  assert.equal(homes.claimHeroHome(owner, hero, occupied), false)
  assert.equal(homes.claimHeroHome(owner, hero, first), true)
  assert.equal(homes.claimHeroHome(owner, hero, second), true)
  assert.equal(homes.getHouseResidents(owner, first).length, 0)
  assert.equal(resident.homeHouseLabel, occupied.label)
})
test('a death releases a bed, preserves the surviving partner’s home and does not create a new couple', () => {
  const { owner, add } = fixture()
  const a = add('Alice', 'female'), b = add('Bob')
  homes.createInitialHouseholdPartners(owner); homes.reconcileHouseholds(owner)
  const home = a.homeHouseLabel
  b.isDead = true
  homes.reconcileHouseholds(owner)
  assert.equal(a.homeHouseLabel, home)
  assert.equal(a.partnerLabel, undefined)
  const arrival = add('New')
  homes.reconcileHouseholds(owner)
  assert.notEqual(arrival.homeHouseLabel, home)
})
test('legacy shared-house assignments are repaired without reviving removed furniture', () => {
  const { owner, add } = fixture()
  const house = owner.buildings[0]
  house.interiorBuildings = []
  for (let i = 0; i < 4; i++) add(`resident${i}`).homeHouseLabel = house.label
  homes.reconcileHouseholds(owner)
  assert.equal(homes.getHouseResidents(owner, house).length, 1)
  assert.equal(house.plannedBedLabels, undefined)
  assert.equal(homes.getHouseResidents(owner, house)[0].homeBedLabel, undefined)
})

test('training preserves the trainee home and its reserved bed', () => {
  const { owner, add } = fixture()
  const resident = add('Resident')
  homes.reconcileHouseholds(owner)
  const home = resident.homeHouseLabel, bed = resident.homeBedLabel
  owner.units = []
  owner.buildings.push({ type: 'Barracks', trainingQueue: [{ trainee: resident }] })
  const newcomer = add('Newcomer')
  homes.reconcileHouseholds(owner)
  assert.equal(resident.homeHouseLabel, home)
  assert.equal(resident.homeBedLabel, bed)
  assert.notEqual(newcomer.homeHouseLabel, home)
})

test('hero house remains reserved while travelling and saved references survive another region', () => {
  const { owner, add } = fixture()
  const hero = add('Hero'); hero.type = 'Hero'
  homes.reconcileHouseholds(owner)
  const house = owner.buildings[0]
  assert.equal(homes.claimHeroHome(owner, hero, house), true)
  owner.units = []
  const saved = JSON.parse(JSON.stringify(owner))
  homes.reconcileHouseholds(saved)
  assert.equal(homes.getHouseResidents(saved, saved.buildings[0])[0].label, hero.label)
  assert.equal(homes.getVacantHomeCount(saved), 2)
  homes.reconcileHouseholds({ units: [hero], buildings: [] })
  assert.equal(hero.homeHouseLabel, house.label)
})


test('choosing a home in another region releases the old saved house', () => {
  const { setHeroHome } = loadTsModule('app/lib/housing/heroHome.ts')
  const { owner, add } = fixture()
  const hero = add('Hero'); hero.type = 'Hero'; hero.owner = owner
  homes.reconcileHouseholds(owner)
  const oldHero = { type: 'Hero', label: hero.label, homeHouseLabel: 'old-home', homeBedLabel: 'old-bed' }
  const oldHouse = { type: 'House', label: 'old-home', heroHomeResident: { label: hero.label } }
  const state = { players: [{ units: [oldHero], buildings: [oldHouse] }] }
  const context = { players: [owner], getWorldGraph: () => ({ nodes: { old: {} } }), getCampaignWorldState: () => state,
    getCampaignEconomy: () => ({ regions: { old: { initialState: structuredClone(state) } } }) }
  const house = owner.buildings[0]; house.owner = owner
  assert.equal(setHeroHome(context, hero, house), true)
  assert.equal(oldHouse.heroHomeResident, undefined)
  assert.equal(oldHero.homeHouseLabel, house.label)
  assert.equal(oldHero.homeBedLabel, hero.homeBedLabel)
})


test('prepared bed identities survive a runtime owner label change', () => {
  const { owner, add } = fixture()
  const resident = add('Resident')
  homes.reconcileHouseholds(owner)
  const bed = resident.homeBedLabel
  const house = owner.buildings.find(b => b.label === resident.homeHouseLabel)
  owner.label = 'runtime-owner'
  assert.equal(`${loadTsModule('app/serialization/InteriorBuildingSave.ts').interiorSaveSpaceId(owner.label, house)}:default:bedroll-1`, bed)
  homes.reconcileHouseholds(owner)
  assert.equal(resident.homeBedLabel, bed)
})
