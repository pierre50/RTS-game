import * as BABYLON from '@babylonjs/core'
import '@babylonjs/loaders/glTF'
import type { Container } from 'pixi.js'
import type { ScreenManager } from '../screens/ScreenManager'

/** Opt-in visual experiment: one Babylon character beside the Pixi hero. */
export async function mountBuddy3DOverlay(screenManager: ScreenManager): Promise<void> {
  const { app, gamebox } = screenManager
  const canvas = document.createElement('canvas')
  canvas.setAttribute('aria-label', 'Prototype du personnage 3D dans le jeu')
  Object.assign(canvas.style, {
    position: 'absolute',
    display: 'none',
    width: '120px',
    height: '120px',
    pointerEvents: 'none',
    imageRendering: 'pixelated',
    zIndex: '30',
  })
  const previousPosition = gamebox.style.position
  if (!previousPosition) gamebox.style.position = 'relative'
  gamebox.appendChild(canvas)

  const engine = new BABYLON.Engine(canvas, true, { alpha: true, stencil: false })
  const scene = new BABYLON.Scene(engine)
  scene.clearColor = new BABYLON.Color4(0, 0, 0, 0)
  const camera = new BABYLON.ArcRotateCamera(
    'Buddy camera', Math.atan2(0.532, -0.847) - 0.35, 1.48, 5.3,
    new BABYLON.Vector3(0, 3.85, 0), scene
  )
  camera.inputs.clear()
  const sky = new BABYLON.HemisphericLight('Buddy sky', new BABYLON.Vector3(0, 1, 0.5), scene)
  sky.intensity = 0.85
  const sun = new BABYLON.DirectionalLight('Buddy sun', new BABYLON.Vector3(-0.6, -1, -0.7), scene)
  sun.intensity = 0.5

  try {
    const loaded = await BABYLON.SceneLoader.ImportMeshAsync(
      '', '/assets/prototypes/', 'buddy-antiquity-pixel-actions-v5.glb', scene
    )
    loaded.animationGroups.find(group => group.name === 'Walk')?.start(true)
  } catch (error) {
    canvas.remove()
    engine.dispose()
    scene.dispose()
    if (!previousPosition) gamebox.style.position = ''
    throw error
  }

  let lastSize = 0
  const update = (): void => {
    const controls = screenManager.currentRuntime?.context.controls
    const hero = controls?.heroUnit
    const heroView = hero as Container | null | undefined
    if (!hero || !heroView?.parent || !hero.visible || hero.isDead) {
      canvas.style.display = 'none'
      return
    }
    const rect = gamebox.getBoundingClientRect()
    const scaleX = rect.width / app.screen.width
    const scaleY = rect.height / app.screen.height
    const point = heroView.getGlobalPosition()
    const zoom = controls.getViewportMetrics().zoom
    const visualHeight = Math.max(36, (hero.sprite?.height ?? 96) * zoom * scaleY)
    const size = Math.max(48, Math.min(180, visualHeight * 1.35))
    canvas.style.left = `${point.x * scaleX + visualHeight * 1.25 - size / 2}px`
    canvas.style.top = `${point.y * scaleY - size * 0.79}px`
    canvas.style.width = `${size}px`
    canvas.style.height = `${size}px`
    canvas.style.display = 'block'
    if (Math.abs(size - lastSize) > 1) {
      lastSize = size
      engine.resize()
    }
  }

  app.ticker.add(update)
  engine.runRenderLoop(() => {
    if (canvas.style.display !== 'none') scene.render()
  })
  const cleanup = (): void => {
    app.ticker.remove(update)
    engine.stopRenderLoop()
    scene.dispose()
    engine.dispose()
    canvas.remove()
    if (!previousPosition) gamebox.style.position = ''
  }
  window.addEventListener('pagehide', cleanup, { once: true })
}
