import { Application } from 'pixi.js'
import './index.html'
import './styles.css'
import Game from './screens/Game'
import Loader from './screens/Loader'

const app = new Application({
  antialias: false,
  width: window.innerWidth,
  height: window.innerHeight,
  resizeTo: window,
  powerPreference: 'high-performance',
})

window.document.removeEventListener('mousemove', app.renderer.events.onPointerMove, true)
window.document.removeEventListener('pointermove', app.renderer.events.onPointerMove, true)

const loader = new Loader() // Basic Loading screen
const gamebox = document.getElementById('game')
gamebox.addEventListener('contextmenu', evt => {
  evt.preventDefault()
})

window.app = app
window.gamebox = gamebox
// append renderer to DOM
gamebox.appendChild(app.view)

// Add loader to App Display Object and start loading assets
app.stage.addChild(loader)
loader.start()

// remove loader then show example once asset loading is complete
loader.onLoaded(() => {
  const game = new Game(app)
  app.stage.removeChild(loader)
  app.stage.addChild(game)
})
