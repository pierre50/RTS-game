const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')

const { PLAYER_COLORS } = loadTsModule('app/ui/setup/PlayerSetupColors.ts')
const { getHexColor, recolorCanvasPixels, SOURCE_COLORS } = loadTsModule('app/lib/graphics/colors.ts', {
  mocks: { 'pixi.js': {}, 'pixi-filters': {} },
})

test('menu colors match runtime colors and violet recoloring uses the hex palette', () => {
  for (const color of PLAYER_COLORS) assert.equal(color.hex, getHexColor(color.name))
  const palette = new Set(fs.readFileSync('scripts/retro_palette/duel.hex', 'utf8').toLowerCase().split(/\s+/))
  const data = new Uint8ClampedArray(SOURCE_COLORS.flatMap(color => [color >> 16, (color >> 8) & 255, color & 255, 255]))
  const ctx = { getImageData: () => ({ data }), putImageData() {} }
  recolorCanvasPixels({ width: SOURCE_COLORS.length, height: 1, getContext: () => ctx }, 'violet')
  const shades = []
  for (let i = 0; i < data.length; i += 4) {
    const hex = ((data[i] << 16) | (data[i + 1] << 8) | data[i + 2]).toString(16).padStart(6, '0')
    assert.ok(palette.has(hex), hex)
    shades.push(hex)
  }
  assert.ok(shades.includes(getHexColor('violet').slice(1)))
  assert.equal(new Set(shades).size, SOURCE_COLORS.length)
})
