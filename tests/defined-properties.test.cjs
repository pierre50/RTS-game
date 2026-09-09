const test = require('node:test')
const assert = require('node:assert/strict')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')
const { definedProperties } = loadTsModule('app/lib/definedProperties.ts')

test('creation payloads omit undefined while preserving meaningful empty values', () => {
  const nested = { pending: undefined }
  const input = { missing: undefined, zero: 0, disabled: false, empty: '', cleared: null, nested }
  const result = definedProperties(input)
  assert.deepEqual(result, { zero: 0, disabled: false, empty: '', cleared: null, nested })
  assert.equal(result.nested, nested)
  assert.equal(Object.hasOwn(input, 'missing'), true)
  assert.notEqual(result, input)
})
