import { type HeroDirectMoveBlocker } from './UnitHeroDirectMovementCollision'
import { debugBlockedDirectMove, debugDirectMoveProbe } from './UnitMovementDebug'

import type { DirectMoveAttempt } from './UnitDirectMovementTypes'

export function reportBorderAttempt(attempt: DirectMoveAttempt): void {
  const { unit, dirX, dirY, candidateX, candidateY, rawI, rawJ, newI, newJ, crossingCell, targetCell, heroControlled } =
    attempt
  if (
    heroControlled &&
    (targetCell?.waterBorder || targetCell?.category === 'Water' || unit.currentCell?.waterBorder)
  ) {
    debugDirectMoveProbe(
      unit,
      'hero-border-attempt',
      {
        rawI,
        rawJ,
        newI,
        newJ,
        candidateX: Math.round(candidateX * 100) / 100,
        candidateY: Math.round(candidateY * 100) / 100,
        crossingCell,
        target: targetCell
          ? {
              i: targetCell.i,
              j: targetCell.j,
              x: Math.round(targetCell.x * 100) / 100,
              y: Math.round(targetCell.y * 100) / 100,
              solid: targetCell.solid,
              waterBorder: targetCell.waterBorder,
              border: targetCell.border,
              category: targetCell.category,
              has: targetCell.has
                ? {
                    family: targetCell.has.family,
                    type: targetCell.has.type,
                    label: targetCell.has.label,
                    sameObject: targetCell.has === unit,
                  }
                : null,
            }
          : null,
      },
      dirX,
      dirY
    )
  }
}

export function reportTerrainCollision(attempt: DirectMoveAttempt, terrainBlocker: HeroDirectMoveBlocker): void {
  const { unit, dirX, dirY, rawI, rawJ, newI, newJ, crossingCell, targetCell } = attempt
  debugBlockedDirectMove(
    unit,
    'target-terrain-footprint',
    {
      rawI,
      rawJ,
      newI,
      newJ,
      category: targetCell?.category,
      waterBorder: targetCell?.waterBorder,
      solid: targetCell?.solid,
      border: targetCell?.border,
      crossingCell,
      terrainBlocker: {
        type: terrainBlocker.type,
        pointCount: terrainBlocker.collisionPoints?.length ?? 0,
        points: terrainBlocker.collisionPoints?.map(point => ({
          x: Math.round(point.x * 100) / 100,
          y: Math.round(point.y * 100) / 100,
        })),
      },
      occupant: targetCell?.has
        ? {
            family: targetCell.has.family,
            type: targetCell.has.type,
            label: targetCell.has.label,
            sameObject: targetCell.has === unit,
          }
        : null,
    },
    dirX,
    dirY
  )
}
