#!/usr/bin/env node
// Render the current Babylon Buddy walk rig into a transparent PNG spritesheet.
// Usage: node scripts/export-buddy-walk-sprite.cjs
const http = require('node:http')
const fs = require('node:fs')
const path = require('node:path')
const { spawn } = require('node:child_process')

const root = path.resolve(__dirname, '..')
const output = path.join(root, 'reports/buddy-3d-v0/sprite-export/buddy-walk-right-sword-shield.png')
const chromium = process.env.CHROMIUM_BIN || '/usr/local/bin/chromium'
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.glb': 'model/gltf-binary', '.png': 'image/png' }

const server = http.createServer((request, response) => {
  const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname)
  const file = path.resolve(root, '.' + pathname)
  if (!file.startsWith(root + path.sep)) {
    response.writeHead(403).end()
    return
  }
  fs.stat(file, (error, stat) => {
    if (error || !stat.isFile()) {
      response.writeHead(404).end()
      return
    }
    response.setHeader('Content-Type', mime[path.extname(file)] || 'application/octet-stream')
    fs.createReadStream(file).pipe(response)
  })
})

server.listen(0, '127.0.0.1', () => {
  const address = server.address()
  const url = `http://127.0.0.1:${address.port}/reports/buddy-3d-v0/sprite-export/index.html`
  const browser = spawn(chromium, [
    '--headless=new', '--no-sandbox', '--disable-gpu', '--enable-webgl',
    '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
    '--disable-dev-shm-usage', '--virtual-time-budget=20000', '--dump-dom', url,
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
    const match = html.match(/<img class="sheet" id="sheet"[^>]*src="data:image\/png;base64,([^"]+)/)
    if (!match || code !== 0) {
      const message = html.match(/data-error="([^"]+)/)?.[1] || errors.slice(-1000)
      console.error(`Échec de la conversion : ${message}`)
      process.exitCode = 1
      return
    }
    fs.writeFileSync(output, Buffer.from(match[1], 'base64'))
    console.log(`Spritesheet écrite : ${output}`)
  })
})
