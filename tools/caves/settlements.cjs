/** Convert the playable isometric grid back to the macro world's source grid. */
function sourcePosition(position, layout) {
  if (!layout) return { i: position.i, j: position.j }
  const row = position.i + position.j - (layout.columns - 1)
  const column = position.i - Math.ceil(row / 2)
  return { i: Math.floor(row / 2), j: column * 2 + (row % 2) }
}

function syncBanditSettlementPositions(blueprint) {
  let index = 0
  let changed = false
  const settlements = (blueprint.settlements ?? []).map(settlement => {
    if (settlement.kind !== 'banditCamp') return settlement
    const local = blueprint.banditCampPositions?.[index++]
    if (!local || !settlement.region) return settlement
    const source = sourcePosition(local, blueprint.localGridLayout)
    const regionSize = blueprint.sourceSize ?? blueprint.size
    const world = { i: settlement.region.y * regionSize + source.i, j: settlement.region.x * regionSize + source.j }
    const updated = { ...settlement, local: { ...local }, world }
    if (JSON.stringify(updated) !== JSON.stringify(settlement)) changed = true
    return updated
  })
  return changed ? { ...blueprint, settlements } : blueprint
}

function syncWorldSettlementManifest(manifest) {
  const actual = new Map(
    (manifest.maps ?? []).flatMap(entry => (entry.settlements ?? []).map(settlement => [settlement.id, settlement]))
  )
  manifest.settlements = (manifest.settlements ?? []).map(settlement => actual.get(settlement.id) ?? settlement)
}

module.exports = { sourcePosition, syncBanditSettlementPositions, syncWorldSettlementManifest }
