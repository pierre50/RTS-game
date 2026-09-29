/** Plan a reassignment without introducing conflicts with a third action. */
export function planBindingChange<A extends string>(
  bindings: Record<A, string>,
  action: A,
  value: string,
  sharesContext: (a: A, b: A) => boolean,
  equivalent: (a: string, b: string) => boolean = (a, b) => a === b
): { conflicts: A[]; swapped: Record<A, string> | null } {
  const actions = Object.keys(bindings) as A[]
  const conflicts = actions.filter(
    other => other !== action && sharesContext(action, other) && equivalent(bindings[other], value)
  )
  const swapped: Record<A, string> = { ...bindings }
  swapped[action] = value
  for (const other of conflicts) swapped[other] = bindings[action]
  const valid = [action, ...conflicts].every(changed =>
    actions.every(
      other => other === changed || !sharesContext(changed, other) || !equivalent(swapped[changed], swapped[other])
    )
  )
  return { conflicts, swapped: valid ? swapped : null }
}
