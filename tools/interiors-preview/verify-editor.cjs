const fs = require('node:fs'),
  path = require('node:path'),
  os = require('node:os'),
  http = require('node:http')
const { spawnSync } = require('node:child_process')
if (!process.versions.electron) {
  const env = { ...process.env }
  delete env.ELECTRON_RUN_AS_NODE
  const result = spawnSync(require('electron'), [__filename], { env, stdio: 'inherit' })
  process.exitCode = result.status ?? 1
} else {
  const { app, BrowserWindow } = require('electron')
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'interior-editor-ui-'))
  app.setPath('userData', path.join(temp, 'profile'))
  const file = path.join(temp, 'layouts.json')
  fs.writeFileSync(file, '{}\n')
  app
    .whenReady()
    .then(async () => {
      let api
      const server = http.createServer(async (req, res) => {
        if (await api(req, res)) return
        const name = req.url === '/preview.js' ? 'preview.js' : 'index.html'
        res.setHeader('Content-Type', name.endsWith('.js') ? 'text/javascript' : 'text/html')
        fs.createReadStream(path.resolve(__dirname, '../../reports/interiors', name)).pipe(res)
      })
      await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
      const port = server.address().port
      api = require('./layout-store.cjs').createLayoutApi(port, file)
      const url = `http://127.0.0.1:${port}`
      const win = new BrowserWindow({
        show: false,
        width: 1440,
        height: 1040,
        useContentSize: true,
        webPreferences: { offscreen: true, nodeIntegration: false, contextIsolation: true },
      })
      const run = async source => {
        const result = await win.webContents.executeJavaScript(
          `(async()=>{try {return {value:await (${source})}} catch(error){return {error:String(error),stack:error.stack}}})()`
        )
        if (result.error) throw new Error(result.stack || result.error)
        return result.value
      }
      const ready = () =>
        run(
          `(async()=>{for(let n=0;n<100&&!document.body.dataset.ready;n++)await new Promise(r=>setTimeout(r,50));if(!document.body.dataset.ready)throw new Error(document.getElementById('error').textContent||'Page indisponible')})()`
        )
      await win.loadURL(url)
      await ready()
      const point = await run(
        `(()=>{const edit=document.getElementById('edit');if(edit.disabled)throw new Error('Éditeur désactivé');edit.click();const r=document.getElementById('scene').getBoundingClientRect();return {x:r.x+500,y:r.y+390}})()`
      )
      const mouse = (type, x, y) =>
        win.webContents.sendInputEvent({ type, x: Math.round(x), y: Math.round(y), button: 'left', clickCount: 1 })
      mouse('mouseMove', point.x, point.y)
      mouse('mouseDown', point.x, point.y)
      mouse('mouseMove', point.x + 32, point.y + 16)
      mouse('mouseUp', point.x + 32, point.y + 16)
      // Simulate a restarted server: the page still holds its old session token.
      api = require('./layout-store.cjs').createLayoutApi(port, file)
      await run(
        `(async()=>{for(let n=0;n<30&&document.getElementById('save').disabled;n++)await new Promise(r=>setTimeout(r,50));if(document.getElementById('save').disabled)throw new Error('Glisser-déposer sans changement : '+document.getElementById('save-status').textContent);document.getElementById('save').click();for(let n=0;n<100&&!document.getElementById('save-status').textContent.startsWith('Enregistré');n++)await new Promise(r=>setTimeout(r,50));if(!document.getElementById('save-status').textContent.startsWith('Enregistré'))throw new Error(document.getElementById('save-status').textContent)})()`
      )
      const stored = JSON.parse(fs.readFileSync(file, 'utf8'))
      if (stored.House?.[0]?.items?.['firecamp-center']?.offsetI !== 1) throw new Error('Position non enregistrée')
      await win.loadURL(url)
      await ready()
      const reloaded = await run(
        `(()=>{const row=[...document.querySelectorAll('#items tr')].find(r=>r.cells[0].textContent==='FireCamp');return row.cells[1].textContent})()`
      )
      if (reloaded !== '10, 9') throw new Error('Position perdue au rechargement : ' + reloaded)
      await run(`(()=>{
        const $ = id => document.getElementById(id)
        $('edit').click()
        const table = [...document.querySelectorAll('#items tr')].find(row => row.cells[0].textContent === 'CampTable')
        table.click(); $('remove').click()
        if ([...document.querySelectorAll('#items tr')].some(row => row.cells[0].textContent === 'CampTable')) throw new Error('Suppression ignorée')
        $('undo').click()
        if (![...document.querySelectorAll('#items tr')].some(row => row.cells[0].textContent === 'CampTable')) throw new Error('Annulation ignorée')
        ;[...document.querySelectorAll('#items tr')].find(row => row.cells[0].textContent === 'CampTable').click(); $('remove').click()
        $('catalog').value = 'CampChair'; $('catalog').dispatchEvent(new Event('change')); $('add').click()
        const c = $('scene'), r = c.getBoundingClientRect()
        c.dispatchEvent(new PointerEvent('pointerdown', {clientX:r.left+564, clientY:r.top+422, button:0, bubbles:true}))
        if (![...document.querySelectorAll('#items tr')].some(row => row.cells[0].textContent === 'CampChair')) throw new Error('Ajout ignoré : '+$('save-status').textContent)
        $('rotate').click(); $('save').click()
      })()`)
      await run(
        `(async()=>{for(let n=0;n<100&&!document.getElementById('save-status').textContent.startsWith('Enregistré');n++)await new Promise(r=>setTimeout(r,50));if(!document.getElementById('save-status').textContent.startsWith('Enregistré'))throw new Error(document.getElementById('save-status').textContent)})()`
      )
      const edited = JSON.parse(fs.readFileSync(file, 'utf8')).House[0].items
      if (edited['table-1']) throw new Error('Suppression non sauvegardée')
      if (!Object.values(edited).some(item => item.type === 'CampChair' && item.mirrored))
        throw new Error('Ajout ou rotation non sauvegardé')
      await win.loadURL(url)
      await ready()
      await run(
        `(()=>{const rows=[...document.querySelectorAll('#items tr')];if(rows.some(r=>r.cells[0].textContent==='CampTable')||!rows.some(r=>r.cells[0].textContent==='CampChair'))throw new Error('Aménagement perdu au rechargement');document.querySelector('aside details').open=true})()`
      )
      const rugPoint = await run(`(()=>{
        const $=id=>document.getElementById(id)
        $('building').value='Barracks'; $('building').dispatchEvent(new Event('change'))
        $('edit').click()
        const row=[...document.querySelectorAll('#items tr')].find(r=>r.cells[0].textContent.endsWith('(sol)'))
        if(!row)throw new Error('Tapis absent de la liste')
        row.click()
        const r=$('scene').getBoundingClientRect()
        return {x:r.left+502,y:r.top+374.5}
      })()`)
      mouse('mouseMove', rugPoint.x, rugPoint.y)
      mouse('mouseDown', rugPoint.x, rugPoint.y)
      mouse('mouseMove', rugPoint.x + 32, rugPoint.y + 16)
      mouse('mouseUp', rugPoint.x + 32, rugPoint.y + 16)
      const saveRugs = () =>
        run(`(async()=>{
        const $=id=>document.getElementById(id)
        if($('save').disabled)throw new Error('Modification de tapis ignorée : '+$('save-status').textContent)
        $('save').click()
        for(let n=0;n<100&&!$('save-status').textContent.startsWith('Enregistré');n++)await new Promise(r=>setTimeout(r,50))
        if(!$('save-status').textContent.startsWith('Enregistré'))throw new Error($('save-status').textContent)
      })()`)
      await saveRugs()
      const rugSaved = JSON.parse(fs.readFileSync(file, 'utf8')).Barracks[0].rugs
      if (rugSaved[0].offsetX !== 34 || rugSaved[0].offsetY !== 0.5)
        throw new Error('Déplacement du tapis non enregistré')
      await win.loadURL(url)
      await ready()
      await run(`(()=>{
        const $=id=>document.getElementById(id)
        $('building').value='Barracks'; $('building').dispatchEvent(new Event('change')); $('edit').click()
        const row=[...document.querySelectorAll('#items tr')].find(r=>r.cells[0].textContent.endsWith('(sol)'))
        row.click(); $('remove').click()
        $('undo').click()
        const restored=[...document.querySelectorAll('#items tr')].find(r=>r.cells[0].textContent.endsWith('(sol)'))
        if(!restored)throw new Error('Annulation de suppression de tapis ignorée')
        restored.click(); $('remove').click()
      })()`)
      await saveRugs()
      if (JSON.parse(fs.readFileSync(file, 'utf8')).Barracks[0].rugs.length)
        throw new Error('Suppression de tapis non enregistrée')
      await win.loadURL(url)
      await ready()
      await run(
        `(()=>{const b=document.getElementById('building');b.value='Barracks';b.dispatchEvent(new Event('change'));if([...document.querySelectorAll('#items tr')].some(r=>r.cells[0].textContent.endsWith('(sol)')))throw new Error('Tapis supprimé réapparu')})()`
      )
      await run(`(()=>{
        const $=id=>document.getElementById(id)
        $('building').value='House'; $('building').dispatchEvent(new Event('change'))
        $('room-size').value='15'; $('room-size').dispatchEvent(new Event('change'))
        if($('save').disabled)throw new Error('Agrandissement non enregistrable : '+$('room-issues').textContent)
      })()`)
      await saveRugs()
      const rooms = JSON.parse(fs.readFileSync(file, 'utf8')).House
      if (rooms[0].roomSize !== 15 || rooms[1] || rooms[2])
        throw new Error('Une taille de maison a modifié un autre niveau')
      await win.loadURL(url)
      await ready()
      await run(`(()=>{
        const $=id=>document.getElementById(id)
        if($('room-size').value!=='15')throw new Error('Taille perdue au rechargement')
        $('building').value='TownCenter'; $('building').dispatchEvent(new Event('change'))
        const count=$('items').children.length
        $('room-size').value='7'; $('room-size').dispatchEvent(new Event('change'))
        if($('items').children.length!==count)throw new Error('Mobilier perdu pendant la réduction')
        if($('save').dataset.blocked!=='true'||!$('room-issues').textContent)throw new Error('Réduction invalide non signalée'); $('save').click(); if(!$('save-feedback').textContent.startsWith('Enregistrement bloqué'))throw new Error('Blocage sans retour visible')
        $('undo').click()
        if($('room-size').value!=='13')throw new Error('Annulation de taille ignorée')
      })()`)
      await run(`new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))`)
      fs.writeFileSync(
        path.resolve(__dirname, '../../reports/interiors/editor-preview.png'),
        (await win.webContents.capturePage()).toPNG()
      )
      console.log('Déplacement, ajout, suppression, rotation, annulation et rechargement validés.')
      win.destroy()
      server.close()
      app.exit(0)
    })
    .catch(error => {
      console.error(error)
      app.exit(1)
    })
}
