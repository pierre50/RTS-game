/** Shared structure for world inspection and conversations; inventories keep their own screens. */
export class InteractionPanel {
  readonly element = document.createElement('div')
  readonly information = document.createElement('div')
  readonly actions = document.createElement('div')
  readonly secondaryActions = document.createElement('div')

  constructor() {
    this.element.className = 'interaction-panel-content'
    this.information.className = 'interaction-information'
    this.actions.className = 'interaction-actions'
    this.secondaryActions.className = 'interaction-secondary-actions'
    this.element.appendChild(this.information)
    this.element.appendChild(this.actions)
  }
}
