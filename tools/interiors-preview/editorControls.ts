import { FR_TRANSLATIONS } from '../../app/lib/i18n/fr'
import { getBuildingAsset as catalogAsset } from '../../app/lib/graphics/assets'
import {
  authoredLayout,
  editableItems,
  furnitureCatalog,
  INTERIOR_ROOM_SIZES,
  layoutIssues,
  replacePositions,
  sceneWithLayout,
} from './model'
import { draw } from './draw'
import { commitLayout, editorState, refreshItemPositions } from './editorPanel'
import { installPointerEditing } from './editorPointer'
import { frame } from './sprites'
import { $, checked, furnitureName, state } from './state'

function updateCatalogPreview() {
  const type = $('catalog').value
  const ref = catalogAsset(type, {}, {} as never).images.final
  const asset = frame(ref.sheet, ref.frame),
    f = asset.frame
  const c = $('catalog-preview') as unknown as HTMLCanvasElement
  const context = c.getContext('2d')!
  context.clearRect(0, 0, c.width, c.height)
  context.imageSmoothingEnabled = false
  const scale = Math.min(2, (c.width - 12) / f.w, (c.height - 12) / f.h)
  context.drawImage(
    asset.image,
    f.x,
    f.y,
    f.w,
    f.h,
    (c.width - f.w * scale) / 2,
    (c.height - f.h * scale) / 2,
    f.w * scale,
    f.h * scale
  )
}

function installRoomSize() {
  $('room-size').replaceChildren(
    ...INTERIOR_ROOM_SIZES.map(size => new Option(`${size - 2} × ${size - 2} cases`, String(size)))
  )
  $('room-size').value = String(state.scene.roomSize)
  $('room-size').addEventListener('change', () => {
    $('edit').checked = true
    $('grid').checked = true
    state.adding = false
    const previous = authoredLayout(state.scene)
    const roomSize = Number($('room-size').value)
    state.undo.push(previous)
    state.scene = sceneWithLayout(state.scene, { ...previous, roomSize })
    state.selected = null
    refreshItemPositions()
    draw()
    editorState('Taille modifiée. Replace les éléments signalés avant d’enregistrer.')
  })
}

function installCatalog() {
  $('catalog').replaceChildren(
    ...furnitureCatalog.map(group => {
      const optgroup = document.createElement('optgroup')
      optgroup.label = FR_TRANSLATIONS[group.titleKey] ?? group.titleKey
      optgroup.append(...group.types.map(type => new Option(furnitureName(type), type)))
      return optgroup
    })
  )
  updateCatalogPreview()
  $('catalog').addEventListener('change', updateCatalogPreview)
  $('add').addEventListener('click', () => {
    state.adding = !state.adding
    editorState(state.adding ? 'Clique sur une case libre pour ajouter ce meuble.' : 'Ajout annulé.')
    draw()
  })
}

const selectedItem = () => editableItems(state.scene).find(item => item.label === state.selected)

function installItemActions() {
  $('remove').addEventListener('click', () => {
    const item = selectedItem()
    if (!item) return
    const layout = authoredLayout(state.scene)
    if (item.label.startsWith('floor:')) layout.rugs!.splice(Number(item.label.slice(6)), 1)
    else delete layout.items[item.label.split(':default:')[1]]
    commitLayout(layout, 'Meuble supprimé. Tu peux annuler avant de sauvegarder.')
  })
  $('rotate').addEventListener('click', () => {
    const item = selectedItem()
    if (!item) return
    const layout = authoredLayout(state.scene),
      key = item.label.split(':default:')[1]
    if (item.label.startsWith('floor:')) {
      const rug = layout.rugs![Number(item.label.slice(6))]
      rug.mirrored = !rug.mirrored
    } else layout.items[key].mirrored = !layout.items[key].mirrored
    commitLayout(layout, 'Orientation inversée.')
  })
}

function installModeToggles() {
  window.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      state.adding = false
      editorState()
      draw()
    }
  })
  $('edit').addEventListener('change', () => {
    state.adding = false
    if (checked('edit')) {
      $('furniture').checked = true
      $('grid').checked = true
    }
    editorState()
    draw()
  })
  $('undo').addEventListener('click', () => {
    const previous = state.undo.pop()
    if (!previous) return
    state.scene = sceneWithLayout(state.scene, previous)
    state.selected = null
    state.adding = false
    refreshItemPositions()
    draw()
    editorState(state.undo.length ? 'Modifications non enregistrées.' : 'Toutes les modifications ont été annulées.')
  })
}

async function postLayout() {
  const session = await fetch('/api/layouts', { signal: AbortSignal.timeout(10000) })
  if (!session.ok)
    throw new Error('Serveur de sauvegarde indisponible. Tes modifications sont conservées dans la page.')
  state.token = (await session.json()).token
  const response = await fetch('/api/layouts', {
    signal: AbortSignal.timeout(15000),
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Layout-Token': state.token },
    body: JSON.stringify({
      type: $('building').value,
      level: Number($('level').value),
      revision: state.revision,
      layout: authoredLayout(state.scene),
    }),
  })
  const data = await response.json()
  if (!response.ok) throw new Error(data.error ?? 'Enregistrement impossible.')
  state.revision = data.revision
  replacePositions(data.positions)
  state.undo.length = 0
}

async function save() {
  if (state.saving) return
  const issues = layoutIssues(state.scene)
  if (issues.length) {
    editorState(`Enregistrement bloqué : ${issues.join(' · ')} Déplace ou supprime les éléments signalés.`)
    return
  }
  let message = ''
  state.saving = true
  state.adding = false
  editorState('Enregistrement…')
  try {
    await postLayout()
    message = 'Enregistré pour le jeu. Les nouveaux intérieurs utiliseront ces positions.'
  } catch (error) {
    message = String(error)
  } finally {
    state.saving = false
    editorState(message)
  }
}

export function installEditor() {
  installRoomSize()
  installCatalog()
  installItemActions()
  installModeToggles()
  installPointerEditing()
  $('save').addEventListener('click', save)
  window.addEventListener('beforeunload', event => {
    if (state.undo.length) {
      event.preventDefault()
      event.returnValue = ''
    }
  })
}
