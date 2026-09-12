import { fail, validateArray, validateViewCell } from './SaveValidationPrimitives'

export function validatePlayerViews(
  views: unknown,
  playerIndex: number,
  size: number,
  containsCell?: (i: number, j: number) => boolean
): void {
  validateArray(views, `player ${playerIndex} views`)
  if (views.length !== size) {
    fail(`Invalid save file: player ${playerIndex} views have an invalid size.`)
  }

  for (let i = 0; i < size; i++) {
    const viewRow = views[i]
    validateArray(viewRow, `player ${playerIndex} view row ${i}`)
    if (containsCell ? viewRow.length > size : viewRow.length !== size) {
      fail(`Invalid save file: player ${playerIndex} views must match the map size.`)
    }
    for (let j = 0; j < size; j++) {
      if (containsCell && !containsCell(i, j) && viewRow[j] == null) continue
      validateViewCell(viewRow[j], i, j)
    }
  }
}

