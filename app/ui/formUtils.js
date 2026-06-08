let _cbId = 0

export function buildSelectRow(label, options, value, onChange) {
  const row = document.createElement('div')
  row.className = 'config-row'

  const lbl = document.createElement('label')
  lbl.textContent = label
  row.appendChild(lbl)

  const select = document.createElement('select')
  select.className = 'ui-select'
  options.forEach(opt => {
    const el = document.createElement('option')
    el.value = String(opt.value)
    el.textContent = typeof opt.label === 'function' ? opt.label() : opt.label
    if (String(opt.value) === String(value)) el.selected = true
    select.appendChild(el)
  })
  select.addEventListener('change', e => onChange(e.target.value))
  row.appendChild(select)

  return row
}

export function buildRangeRow(label, { min, max, step, value }, onChange) {
  const row = document.createElement('div')
  row.className = 'config-row'

  const lbl = document.createElement('label')
  lbl.textContent = label
  row.appendChild(lbl)

  const input = document.createElement('input')
  input.type = 'range'
  input.className = 'ui-range'
  input.min = String(min)
  input.max = String(max)
  input.step = String(step)
  input.value = String(value)
  input.addEventListener('input', e => onChange(parseFloat(e.target.value)))
  row.appendChild(input)

  return row
}

export function buildCheckboxRow(label, value, onChange) {
  const id = `ui-cb-${++_cbId}`
  const row = document.createElement('div')
  row.className = 'config-row'

  const lbl = document.createElement('label')
  lbl.htmlFor = id
  lbl.textContent = label
  row.appendChild(lbl)

  const input = document.createElement('input')
  input.id = id
  input.type = 'checkbox'
  input.className = 'ui-checkbox'
  input.checked = value
  input.addEventListener('change', e => onChange(e.target.checked))
  row.appendChild(input)

  return row
}
