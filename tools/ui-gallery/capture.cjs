// Runs only against the isolated local gallery, never the game's save profile.
const fs = require('node:fs/promises')
const path = require('node:path')
const os = require('node:os')
const http = require('node:http')
const { spawnSync } = require('node:child_process')
const root = path.resolve(__dirname, '../..')

function options(argv) {
  const result = { out: path.join(root, 'reports/ui-gallery'), width: 1600, height: 1000, lang: 'fr' }
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i]
    if (flag === '--help' || flag === '--list' || flag === '--no-build') result[flag.slice(2)] = true
    else if (['--out', '--width', '--height', '--lang', '--only'].includes(flag)) {
      const value = argv[++i]
      if (!value || value.startsWith('--')) throw new Error(`Valeur manquante : ${flag}`)
      result[flag.slice(2)] = value
    } else throw new Error(`Option inconnue : ${flag}`)
  }
  for (const key of ['width', 'height']) {
    result[key] = Number(result[key])
    if (!Number.isInteger(result[key]) || result[key] < 320 || result[key] > 4096)
      throw new Error(`${key} doit être entre 320 et 4096`)
  }
  if (!['fr', 'en'].includes(result.lang)) throw new Error('--lang : fr ou en')
  result.out = path.resolve(result.out)
  return result
}
const args = process.argv.slice(2)
const opts = options(args)
if (opts.help) {
  console.log(
    'pnpm ui:png [--out reports/ui-gallery] [--width 1600] [--height 1000] [--lang fr|en] [--only 02-forge,12-dialogue] [--list] [--no-build]'
  )
} else if (!process.versions.electron) {
  if (!opts['no-build']) {
    const built = spawnSync(process.execPath, [path.join(__dirname, 'build.cjs')], { cwd: root, stdio: 'inherit' })
    if (built.status !== 0) process.exit(built.status || 1)
  }
  const env = { ...process.env }
  delete env.ELECTRON_RUN_AS_NODE
  const run = spawnSync(require('electron'), [__filename, ...args, '--no-build'], { cwd: root, stdio: 'inherit', env })
  process.exitCode = run.status ?? 1
} else {
  main().catch(error => {
    console.error(error)
    require('electron').app.exit(1)
  })
}

async function main() {
  const { app, BrowserWindow, session } = require('electron')
  const profile = await fs.mkdtemp(path.join(os.tmpdir(), 'kaelor-ui-capture-'))
  app.setPath('userData', profile)
  app.commandLine.appendSwitch('force-device-scale-factor', '1')
  let server, win
  let exitCode = 0
  const failures = []
  try {
    await app.whenReady()
    const base = path.join(root, 'build/ui-gallery')
    const mime = {
      '.html': 'text/html',
      '.js': 'text/javascript',
      '.css': 'text/css',
      '.json': 'application/json',
      '.png': 'image/png',
      '.webp': 'image/webp',
      '.svg': 'image/svg+xml',
      '.ttf': 'font/ttf',
      '.woff2': 'font/woff2',
    }
    server = http.createServer(async (req, res) => {
      try {
        const url = new URL(req.url, 'http://localhost')
        const relative = decodeURIComponent(url.pathname).replace(/^\/+/, '') || 'index.html'
        const baseDir = relative.startsWith('assets/') ? path.join(root, 'public') : base
        const file = path.resolve(baseDir, relative)
        if (!file.startsWith(baseDir + path.sep)) {
          res.writeHead(403).end()
          return
        }
        const data = await fs.readFile(file)
        res
          .writeHead(200, {
            'Content-Type': mime[path.extname(file)] || 'application/octet-stream',
            'Cache-Control': 'no-store',
          })
          .end(data)
      } catch {
        res.writeHead(404).end()
      }
    })
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
    const origin = `http://127.0.0.1:${server.address().port}`
    const isolated = session.fromPartition('ui-capture')
    isolated.webRequest.onBeforeRequest((details, callback) =>
      callback({ cancel: !details.url.startsWith(origin + '/') && !/^(data:|blob:)/.test(details.url) })
    )
    win = new BrowserWindow({
      width: opts.width,
      height: opts.height,
      useContentSize: true,
      show: false,
      webPreferences: {
        session: isolated,
        nodeIntegration: false,
        contextIsolation: true,
        backgroundThrottling: false,
        offscreen: true,
      },
    })
    win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
    const errors = []
    win.webContents.on('console-message', event => {
      if (event.level === 'error') errors.push(event.message)
    })
    await win.loadURL(`${origin}/?capture&lang=${opts.lang}`)
    await waitFor(async () => win.webContents.executeJavaScript('Boolean(window.uiGallery)'), 30000)
    const all = await win.webContents.executeJavaScript('window.uiGallery.screens')
    if (opts.list) {
      console.log(all.map(s => `${s.id}\t${s.name}`).join('\n'))
      return
    }
    const wanted = opts.only?.split(',')
    if (wanted?.some(id => !all.some(s => s.id === id))) throw new Error('Écran inconnu dans --only. Utiliser --list.')
    const screens = all.filter(s => !wanted || wanted.includes(s.id))
    await fs.mkdir(opts.out, { recursive: true })
    const results = []
    for (const screen of screens) {
      errors.length = 0
      try {
        const layout = await deadline(
          win.webContents.executeJavaScript(`window.uiGallery.show(${JSON.stringify(screen.id)})`),
          20000
        )
        if (errors.length) throw new Error(errors.join(' | '))
        const png = await win.webContents.capturePage()
        if (png.isEmpty()) throw new Error('Capture vide')
        const normalized = png.resize({ width: opts.width, height: opts.height, quality: 'best' })
        const file = screen.id + '.png'
        await fs.writeFile(path.join(opts.out, file), normalized.toPNG())
        results.push({ ...screen, file, status: 'ok', layout, consoleErrors: [...errors] })
        console.log(`✓ ${file}`)
      } catch (error) {
        failures.push(screen.id)
        await fs.rm(path.join(opts.out, screen.id + '.png'), { force: true })
        results.push({ ...screen, status: 'failed', error: String(error), consoleErrors: [...errors] })
        console.error(`✗ ${screen.id}: ${error.message}`)
      }
    }
    await fs.writeFile(
      path.join(opts.out, 'manifest.json'),
      JSON.stringify(
        {
          generatedAt: new Date().toISOString(),
          viewport: { width: opts.width, height: opts.height },
          lang: opts.lang,
          fixtures: true,
          results,
        },
        null,
        2
      )
    )
    const escape = s =>
      String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])
    await fs.writeFile(
      path.join(opts.out, 'index.html'),
      `<!doctype html><meta charset="utf-8"><title>Kaelor — captures UI</title><style>body{background:#101426;color:#eee;font:16px system-ui;margin:32px}main{display:grid;grid-template-columns:repeat(auto-fit,minmax(400px,1fr));gap:24px}img{width:100%}a{color:#ffe5a2}</style><h1>Captures des interfaces</h1><p>Données de démonstration · ${opts.width} × ${opts.height} · ${escape(opts.lang)}</p><main>${results.map(r => `<section><h2>${escape(r.name)}</h2>${r.file ? `<a href="${r.file}"><img src="${r.file}" loading="lazy" alt="${escape(r.name)}"></a>` : `<p>${escape(r.error)}</p>`}</section>`).join('')}</main>`
    )
    console.log(`${results.length - failures.length}/${results.length} PNG — ${opts.out}`)
    if (failures.length) exitCode = 1
  } catch (error) {
    console.error(error)
    exitCode = 1
  } finally {
    win?.destroy()
    if (server) await new Promise(resolve => server.close(resolve))
    await fs.rm(profile, { recursive: true, force: true }).catch(() => {})
    app.exit(exitCode)
  }
}
async function waitFor(check, timeout) {
  const start = Date.now()
  while (!(await check())) {
    if (Date.now() - start > timeout) throw new Error('La galerie ne s’est pas initialisée')
    await new Promise(resolve => setTimeout(resolve, 100))
  }
}
function deadline(promise, timeout) {
  let timer
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error('Délai de rendu dépassé')), timeout)
    }),
  ]).finally(() => clearTimeout(timer))
}
