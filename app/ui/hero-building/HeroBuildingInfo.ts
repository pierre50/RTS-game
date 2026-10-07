import type { HeroBuildingMenuManager } from '../HeroBuildingMenuManager'
import { getBuildingDisplayName } from '../utils/entityDisplayName'
import { TITLED_ENTITY_INFO_OPTIONS } from '../inspection/EntityInfoContent'
import { buttonMeta } from './HeroBuildingButtonText'

export function renderHeroBuildingInfo(host: HeroBuildingMenuManager): void {
  const building = host.building
  const title = host.modal?._panel?.querySelector('.modal-title')
  if (title && building) title.textContent = getBuildingDisplayName(building)
  host.info.textContent = ''
  host.layout.secondaryActions.replaceChildren()
  if (typeof building?.interface?.info === 'function') {
    building.interface.info(host.info, {
      ...TITLED_ENTITY_INFO_OPTIONS,
      actionsContainer: host.layout.secondaryActions,
    })
  }
  if (building) {
    for (const spec of host.getBuildingActionMenuItems(building)) {
      if (spec.id !== 'heroCampfireSleep' || spec.hide?.()) continue
      const button = host.createButton(building, spec)
      button.dataset.windowAction = 'sleep'
      button.title = buttonMeta(spec)
      host.layout.secondaryActions.appendChild(button)
    }
  }
}
