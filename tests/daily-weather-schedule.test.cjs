const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')
const { DailyWeatherSchedule } = loadTsModule('app/services/weather/DailyWeatherSchedule.ts')
const { DAY_NIGHT_CONFIG } = loadTsModule('app/config/gameplay.ts')
const hourMs = DAY_NIGHT_CONFIG.dayLengthMs / DAY_NIGHT_CONFIG.hoursPerDay
const atHour = hour => (hour - DAY_NIGHT_CONFIG.startHour) * hourMs
const wet = phase => ['rainLight', 'rainHeavy', 'snow', 'sandstorm'].includes(phase)

test('sunny and overcast days remain dry for an entire day, including the opening minute', () => {
  for (const [seed, phase] of [
    [5, 'sunny'],
    [0, 'clouding'],
  ]) {
    const schedule = new DailyWeatherSchedule(seed, 'Temperate')
    for (let seconds = 0; seconds < 24 * 60; seconds += 5) {
      assert.equal(schedule.sample(seconds * 1000).phase, phase)
    }
  }
})

test('a shower day has one continuous rain window lasting three to six game hours', () => {
  const schedule = new DailyWeatherSchedule(3, 'Temperate')
  let rainMinutes = 0
  let starts = 0
  let wasRaining = false
  for (let minute = 8 * 60; minute < 24 * 60; minute++) {
    const sample = schedule.sample(atHour(minute / 60))
    assert.equal(sample.kind, 'showers')
    const raining = wet(sample.phase)
    if (raining && !wasRaining) starts++
    if (raining) rainMinutes++
    wasRaining = raining
  }
  assert.equal(starts, 1)
  assert.ok(rainMinutes >= 3 * 60 && rainMinutes <= 6 * 60)
  assert.equal(schedule.sample(atHour(23)).phase, 'clouding')
})

test('evening precipitation keeps its phase and deadline across midnight', () => {
  let checked = 0
  for (let seed = 0; seed < 300; seed++) {
    const schedule = new DailyWeatherSchedule(seed, 'Temperate')
    const before = schedule.sample(atHour(24) - 1)
    if (!wet(before.phase) || before.endsAt <= atHour(24) + 1) continue
    const after = schedule.sample(atHour(24) + 1)
    assert.deepEqual(after, before)
    checked++
  }
  assert.ok(checked > 0)
})

test('save reconstruction and arbitrary time jumps preserve the exact daily forecast', () => {
  const stepped = new DailyWeatherSchedule(34, 'BlackForest')
  for (let hour = 8; hour < 24 * 20; hour += 0.25) stepped.sample(atHour(hour))
  for (const hour of [24 * 20, 24 * 200 + 23.5, 24 * 2 + 14, 8]) {
    const fresh = new DailyWeatherSchedule(34, 'BlackForest')
    assert.deepEqual(stepped.sample(atHour(hour)), fresh.sample(atHour(hour)))
  }
})

test('biomes have stable dry days and never mix precipitation types within one planned episode', () => {
  let temperateSunnyDays = 0
  let desertSunnyDays = 0
  for (const biome of ['Temperate', 'Jungle', 'BlackForest', 'Desert', 'Steppe']) {
    const schedule = new DailyWeatherSchedule(42, biome)
    for (let day = 1; day <= 365; day++) {
      const noon = schedule.sample(atHour(day * 24 + 12))
      if (noon.kind === 'sunny') {
        if (biome === 'Temperate') temperateSunnyDays++
        if (biome === 'Desert') desertSunnyDays++
      }
      let starts = 0
      let previousWet = false
      const types = new Set()
      // All new episodes start after 06:00; yesterday's carry has ended by then.
      for (let hour = 6; hour < 24; hour += 0.25) {
        const sample = schedule.sample(atHour(day * 24 + hour))
        const isWet = wet(sample.phase)
        if (isWet && !previousWet) starts++
        if (isWet) types.add(sample.phase.startsWith('rain') ? 'rain' : sample.phase)
        previousWet = isWet
        assert.ok(sample.endsAt > atHour(day * 24 + hour))
        if (['Temperate', 'Jungle', 'Desert'].includes(biome)) assert.notEqual(sample.phase, 'snow')
        if (biome !== 'Desert') assert.notEqual(sample.phase, 'sandstorm')
      }
      assert.ok(starts <= 1)
      assert.ok(types.size <= 1)
    }
  }
  assert.ok(temperateSunnyDays > 100)
  assert.ok(desertSunnyDays > temperateSunnyDays)
})
