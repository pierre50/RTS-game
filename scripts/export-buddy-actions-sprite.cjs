#!/usr/bin/env node
// Regenerate the separate body and sword action sheets used by ?babylon-terrain&hero2D.
const http = require('node:http')
const fs = require('node:fs')
const path = require('node:path')
const { spawn } = require('node:child_process')

const root = path.resolve(__dirname, '..')
const output = path.join(root, 'public/assets/prototypes/buddy-hero2d')
const chromium = process.env.CHROMIUM_BIN || '/usr/local/bin/chromium'
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.glb': 'model/gltf-binary', '.png': 'image/png' }
const server = http.createServer((request, response) => {
  const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname)
  const file = path.resolve(root, '.' + pathname)
  if (!file.startsWith(root + path.sep)) return response.writeHead(403).end()
  fs.stat(file, (error, stat) => {
    if (error || !stat.isFile()) return response.writeHead(404).end()
    response.setHeader('Content-Type', mime[path.extname(file)] || 'application/octet-stream')
    fs.createReadStream(file).pipe(response)
  })
})

server.listen(0, '127.0.0.1', () => {
  const address = server.address()
  const url = `http://127.0.0.1:${address.port}/reports/buddy-3d-v0/sprite-export/actions.html`
  const browser = spawn(chromium, [
    '--headless=new', '--no-sandbox', '--disable-gpu', '--enable-webgl',
    '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
    '--disable-dev-shm-usage', '--virtual-time-budget=120000', '--dump-dom', url,
  ])
  let html = ''
  let errors = ''
  browser.stdout.setEncoding('utf8').on('data', chunk => { html += chunk })
  browser.stderr.setEncoding('utf8').on('data', chunk => { errors += chunk })
  browser.on('error', error => {
    console.error(`Impossible de lancer Chromium (${chromium}) : ${error.message}`)
    server.close()
    process.exitCode = 1
  })
  browser.on('close', code => {
    server.close()
    const names = ['body-side', 'sword-side', 'body-slash', 'sword-slash']
    if (code !== 0 || !names.every(name => new RegExp(`<img id="${name}"[^>]*src="data:image/png;base64,`).test(html))) {
      const message = html.match(/data-error="([^"]+)/)?.[1] || errors.slice(-1000)
      console.error(`Échec de la conversion : ${message}`)
      process.exitCode = 1
      return
    }
    fs.mkdirSync(output, { recursive: true })
    for (const name of names) {
      const match = html.match(new RegExp(`<img id="${name}"[^>]*src="data:image/png;base64,([^"]+)`))
      const file = path.join(output, `${name}-sword-shield-8dir.png`)
      fs.writeFileSync(file, Buffer.from(match[1], 'base64'))
      console.log(`Spritesheet écrite : ${file}`)
    }
    fs.writeFileSync(path.join(output, 'sword-actions-8dir.json'), JSON.stringify({
      frameWidth: 96, frameHeight: 96, framesPerDirection: 12,
      directions: ['up', 'up-right', 'right', 'down-right', 'down', 'down-left', 'left', 'up-left'],
      actions: { side: 'SideSlash', slash: 'Slash' },
      layers: ['body', 'sword'],
      equipment: ['sword-iron', 'shield-iron'],
    }, null, 2) + '\n')
  })
})
