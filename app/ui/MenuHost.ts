import type { BuildingEntity, ResourceEntity, RuntimeEntity, UnitEntity } from '../types/entities'
import type { GameContextLike, NpcOrdersOpenOptions } from '../types/context'
import type { MenuButtonSpec, MinimapPlayerCanvas, TooltipContent } from '../types/ui'
import type { PlayerLike } from '../types/player'
import type { ResourceAmount } from '../types/common'

interface MenuTooltipHost {
  bind(element: HTMLElement, content: TooltipContent | (() => TooltipContent)): void
  hide(): void
  destroy?(): void
}

interface MenuPauseHost {
  createOpenButton(): HTMLButtonElement
}

export interface MenuHost {
  context: GameContextLike
  gameHud: HTMLDivElement
  minimapWrap: HTMLDivElement
  terrainMinimap: HTMLCanvasElement
  playersMinimap: MinimapPlayerCanvas[]
  resourcesMinimap: HTMLCanvasElement
  cameraMinimap: HTMLCanvasElement
  menuTooltip: MenuTooltipHost
  pauseMenu: MenuPauseHost
  icons: Record<string, string>
  infoIcons: Record<string, string>
  topbar?: HTMLDivElement
  topbarStatusStack: HTMLDivElement
  resources: HTMLDivElement
  age: HTMLDivElement
  dayTime: HTMLDivElement
  selection: RuntimeEntity | null
  showMessage(message: string, type?: string): void
  updateActionTarget(): void
  getMessage(cost: ResourceAmount): string
  getActionUnitButton(type: string, building?: BuildingEntity): MenuButtonSpec
  getActionRallyPointButton(): MenuButtonSpec
  getActionBuildingButton(type: string, ownerOverride?: PlayerLike | null): MenuButtonSpec
  getActionTechnologyButton(type: string): MenuButtonSpec
  getHeroTechnologyButtons(): MenuButtonSpec[]
  getActionMenuItems(selection: RuntimeEntity): MenuButtonSpec[]
  createActionIcon(src: string): HTMLImageElement
  playUiClick(): void
  clearActionHotkeys(): void
  assignActionHotkey(id: string, usedKeys: Set<string>): string | null
  createActionMenuButton(
    selection: RuntimeEntity,
    button: MenuButtonSpec,
    index: number,
    hotkey: string | null,
    onNavigate: (children: MenuButtonSpec[]) => void
  ): HTMLButtonElement
  setActionHotkey(key: string, action: () => void): void
  updateCameraMiniMap(): void
  toggleQueuedActionCancel(target: string, value: boolean): void
  closeHeroBuildingMenu(): void
  updateHeroStatus?(hero?: UnitEntity | null): void
  closeEntityInfoModal?(): void
  openNpcOrders?(npcs: UnitEntity[], options?: NpcOrdersOpenOptions): void
  openEntityInfoModal?(entity: RuntimeEntity): boolean
  updateResourceMiniMap?(resource: ResourceEntity): void
}
