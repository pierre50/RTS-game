/** Stable yield for a planted tile, shared by live play and offline simulation. */
export function sownWheatOptions(site: { i: number; j: number; label?: string; spaceId?: string | null }) {
  return {
    i: site.i,
    j: site.j,
    ...(site.spaceId ? { spaceId: site.spaceId } : {}),
    label: `${site.label ?? `field:${site.i}:${site.j}`}:wheat`,
    type: 'Wheat',
    quantity: 10,
    totalQuantity: 10,
    currentFrame: 0,
  }
}
