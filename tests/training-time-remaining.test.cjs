const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')

function loadTrainingTimeRemaining() {
  return loadTsModule('app/lib/buildings/trainingTimeRemaining.ts', {
    mocks: {
      '../../config/gameplay': {
        DAY_NIGHT_CONFIG: {
          hoursPerDay: 24,
          newDayHour: 8,
        },
      },
      '../lang': {
        t: (key, vars = {}) => `${key}:${JSON.stringify(vars)}`,
      },
    },
  })
}

function createTrainingBuilding(day, hour, completeDay, minute = 0) {
  return {
    trainingCompleteDay: completeDay,
    context: {
      dayNight: {
        state: { day, hour, minute },
      },
    },
  }
}

test('training time remaining displays days above twenty four hours', () => {
  const { formatTrainingTimeRemaining } = loadTrainingTimeRemaining()

  const label = formatTrainingTimeRemaining(createTrainingBuilding(0, 7, 1))

  assert.equal(label, 'trainingDaysRemaining:{"days":2}')
})

test('training time remaining displays hours at twenty four hours or less', () => {
  const { formatTrainingTimeRemaining } = loadTrainingTimeRemaining()

  assert.equal(formatTrainingTimeRemaining(createTrainingBuilding(0, 8, 1)), 'trainingHoursRemaining:{"hours":24}')
  assert.equal(formatTrainingTimeRemaining(createTrainingBuilding(0, 7, 0)), 'trainingHourRemaining:{"hours":1}')
})
