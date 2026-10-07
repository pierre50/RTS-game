/** Edit at the native selection, preserving maxLength and complete Unicode characters. */
export function editVirtualKeyboardText(
  value: string,
  start: number | null,
  end: number | null,
  key: string,
  maxLength: number
): { value: string; caret: number } {
  let from = start ?? value.length
  const to = end ?? from
  if (key === '{bksp}' && from === to) from -= Array.from(value.slice(0, from)).at(-1)?.length ?? 0
  let insertion = key === '{bksp}' ? '' : key === '{space}' ? ' ' : key === '{newline}' ? '\n' : key
  if (maxLength >= 0) {
    const available = Math.max(0, maxLength - (value.length - (to - from)))
    insertion = insertion.slice(0, available)
  }
  return { value: value.slice(0, from) + insertion + value.slice(to), caret: from + insertion.length }
}
