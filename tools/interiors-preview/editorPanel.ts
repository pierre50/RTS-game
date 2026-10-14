import { authoredLayout, editableItems, editFurniture, layoutIssues, replacePositions, sceneWithLayout } from './model'
import { draw } from './draw'
import { $, canvas, checked, furnitureName, state, type Layout } from './state'

function updateSaveControls(dirty: boolean, issues: string[]) {
  const { canSave, saving } = state
  $('save').disabled = !canSave || !dirty || saving
  $('save').textContent = saving
    ? 'Enregistrement…'
    : dirty
      ? 'Enregistrer pour le jeu'
      : 'Aucune modification à enregistrer'
  $('save').dataset.blocked = String(issues.length > 0)
  $('undo').disabled = !dirty || saving
}

function updateEditControls() {
  const { scene, canSave, saving } = state
  $('edit').disabled = !canSave || $('preset').value !== 'ai' || saving
  if (!canSave || $('preset').value !== 'ai') $('edit').checked = false
  const editing = checked('edit') && !saving && canSave
  for (const id of ['catalog', 'add']) $(id).disabled = !editing
  for (const id of ['rotate', 'remove'])
    $(id).disabled = !editing || !(scene && editableItems(scene).some(item => item.label === state.selected))
  const selectedItem = scene && editableItems(scene).find(item => item.label === state.selected)
  $('selection').textContent = selectedItem
    ? furnitureName(selectedItem.type)
    : 'Sélectionne un meuble dans la pièce ou dans la liste.'
  $('add').textContent = state.adding ? 'Annuler l’ajout' : 'Ajouter dans la pièce'
  canvas.style.cursor = editing ? (state.adding ? 'crosshair' : 'grab') : 'default'
}

function updateFeedback(dirty: boolean, issues: string[], message?: string) {
  if (message) $('save-status').textContent = message
  else if (dirty)
    $('save-status').textContent = 'Modifications non enregistrées. Enregistre ou annule avant de changer de bâtiment.'
  const feedback =
    message ??
    (issues.length
      ? `Enregistrement bloqué : ${issues.join(' · ')}`
      : dirty
        ? 'Modifications non enregistrées.'
        : 'Aucune modification en attente.')
  $('save-feedback').textContent = feedback
  $('save-feedback').style.color = /Error|Erreur|bloqué|impossible|refusé/i.test(feedback) ? '#ffaaaa' : '#e9cc83'
}

export function editorState(message?: string) {
  const { scene, canSave, saving } = state
  const dirty = state.undo.length > 0
  for (const id of ['building', 'level', 'preset', 'mirror', 'reset']) $(id).disabled = dirty || saving
  const issues = scene ? layoutIssues(scene) : []
  $('room-issues').textContent = issues.join(' · ')
  $('room-size').disabled = !canSave || $('preset').value !== 'ai' || saving
  if (scene) $('room-size').value = String(scene.roomSize)
  $('size-hint').textContent =
    $('building').value === 'House'
      ? 'Taille et aménagement propres à ce niveau de maison.'
      : 'Taille, meubles et tapis du niveau 1 partagés par tous les niveaux.'
  updateSaveControls(dirty, issues)
  updateEditControls()
  updateFeedback(dirty, issues, message)
}

export async function connectEditor() {
  if (location.protocol === 'file:') {
    editorState('Pour enregistrer, lance le rapport avec --serve.')
    return
  }
  try {
    const response = await fetch('/api/layouts')
    if (!response.ok) throw new Error('API indisponible')
    const data = await response.json()
    state.revision = data.revision
    state.token = data.token
    replacePositions(data.positions)
    state.canSave = true
    editorState('Active « Modifier les meubles » pour éditer cet intérieur.')
  } catch {
    editorState('Mode lecture seule : relance le serveur du rapport avec --serve pour éditer.')
  }
}

function renderStats() {
  const { scene } = state
  const floor = scene.grid.flat().filter(cell => !cell.terrainHidden).length
  const beds = scene.furniture.filter(item => item.type === 'CampBedroll').length
  $('stats').replaceChildren(
    ...[
      `${floor} cases de sol`,
      `Emprise extérieure : ${scene.building.size}`,
      `${beds} lit${beds > 1 ? 's' : ''}`,
      `${editableItems(scene).length} éléments`,
    ].map(text => {
      const span = document.createElement('span')
      span.textContent = text
      return span
    })
  )
}

export function refreshItemPositions() {
  renderStats()
  $('items').replaceChildren(
    ...editableItems(state.scene).map(item => {
      const tr = document.createElement('tr')
      for (const text of [
        item.label.startsWith('floor:') ? furnitureName(item.type) + ' (sol)' : item.type,
        `${item.i}, ${item.j}`,
      ]) {
        const td = document.createElement('td')
        td.textContent = text
        tr.append(td)
      }
      return tr
    })
  )
  for (const [index, row] of Array.from(($('items') as unknown as HTMLTableSectionElement).rows).entries()) {
    row.tabIndex = 0
    row.style.cursor = 'pointer'
    const select = () => {
      state.selected = editableItems(state.scene)[index].label
      editorState()
      draw()
    }
    row.onclick = select
    row.onkeydown = event => {
      if (event.key === 'Enter') select()
    }
  }
}

export function commitLayout(layout: Layout, message: string) {
  try {
    const { scene } = state
    const next = layoutIssues(scene).length ? sceneWithLayout(scene, layout) : editFurniture(scene, layout)
    state.undo.push(authoredLayout(scene))
    state.scene = next
    refreshItemPositions()
    editorState(message)
    draw()
  } catch (error) {
    editorState(String(error))
  }
}
