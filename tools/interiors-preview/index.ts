import { buildings, sceneFor } from './model'
import dirtAtlas from '../../public/assets/terrain/dirt/texture.json'
import dirtImage from '../../public/assets/terrain/dirt/texture.png'
import wallAtlas from '../../public/assets/terrain/interior-walls/wood/texture.json'
import wallImage from '../../public/assets/terrain/interior-walls/wood/texture.png'
import decoAtlas from '../../public/assets/graphics/structures/decorations/texture.json'
import decoImage from '../../public/assets/graphics/structures/decorations/texture.png'
import { draw } from './draw'
import { installEditor } from './editorControls'
import { connectEditor, editorState, refreshItemPositions } from './editorPanel'
import { installHoverStatus } from './editorPointer'
import { loadSheet } from './sprites'
import { $, canvas, checked, fail, state } from './state'

function update() {
  try {
    $('error').textContent = ''
    state.selected = null
    state.adding = false
    state.scene = sceneFor($('building').value, Number($('level').value), checked('mirror'), $('preset').value === 'ai')
    draw()
    refreshItemPositions()
    $('status').textContent = 'Survole une case pour connaître ses coordonnées.'
    $('export').disabled = false
    document.body.dataset.ready = 'true'
    editorState()
  } catch (error) {
    fail(error)
  }
}

function levels() {
  const building = buildings.find(b => b.type === $('building').value)!
  const hasLevels = building.type === 'House'
  $('level-control').hidden = !hasLevels
  $('level').replaceChildren(
    ...(hasLevels ? building.levels : [0]).map(level => new Option(`Niveau ${level + 1}`, String(level)))
  )
}

function installViewControls() {
  $('building').addEventListener('change', () => {
    levels()
    update()
  })
  for (const id of ['level', 'preset', 'mirror']) $(id).addEventListener('change', update)
  for (const id of ['furniture', 'walls', 'grid', 'coordinates', 'transparent', 'zoom'])
    $(id).addEventListener('input', () => {
      try {
        draw()
      } catch (error) {
        fail(error)
      }
    })
  $('reset').addEventListener('click', () => {
    for (const id of ['walls', 'furniture']) $(id).checked = true
    for (const id of ['grid', 'coordinates', 'mirror', 'transparent']) $(id).checked = false
    $('zoom').value = '100'
    $('preset').value = 'ai'
    update()
  })
}

function installExport() {
  $('export').addEventListener('click', () => {
    const link = document.createElement('a')
    link.download = `${$('building').value}-niveau-${Number($('level').value) + 1}${checked('grid') ? '-grille' : ''}.png`
    link.href = canvas.toDataURL('image/png')
    link.click()
  })
}

async function main() {
  await Promise.all([
    loadSheet('terrain/dirt', dirtAtlas, dirtImage),
    loadSheet('walls', wallAtlas, wallImage),
    loadSheet('buildings/deco', decoAtlas, decoImage),
  ])
  await connectEditor()
  $('building').replaceChildren(...buildings.map(b => new Option(b.name, b.type)))
  $('building').value = 'House'
  levels()
  update()
  installViewControls()
  installEditor()
  installHoverStatus()
  installExport()
}

main().catch(fail)
