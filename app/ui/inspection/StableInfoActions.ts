/** Live information can update frequently without replacing unchanged, focused action buttons. */
export function renderWithStableInfoActions(
  container: HTMLElement | undefined,
  render: (actions: HTMLElement | undefined) => void
): void {
  if (!container) {
    render(undefined)
    return
  }
  const pending = document.createElement('div')
  render(pending)
  const current = Array.from(container.childNodes)
  const next = Array.from(pending.childNodes)
  // Keyboard/controller selection belongs to the window, not the freshly rendered action.
  next.forEach((node, index) => {
    const previous = current[index]
    if (
      previous?.nodeType === 1 &&
      node.nodeType === 1 &&
      (previous as Element).classList.contains('is-window-selected')
    )
      (node as Element).classList.add('is-window-selected')
  })
  if (current.length === next.length && current.every((node, index) => node.isEqualNode(next[index]))) return
  container.replaceChildren(...next)
}
