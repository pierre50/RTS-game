// Exercise the generated report in an isolated, offscreen browser, without game saves.
const path = require('node:path')
const fs = require('node:fs')
const os = require('node:os')
const { spawnSync } = require('node:child_process')
if (!process.versions.electron) {
  const env = { ...process.env }
  delete env.ELECTRON_RUN_AS_NODE
  const result = spawnSync(require('electron'), [__filename], { env, stdio: 'inherit' })
  process.exitCode = result.status ?? 1
} else {
  const { app, BrowserWindow } = require('electron')
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'interior-preview-'))
  app.setPath('userData', profile)
  app
    .whenReady()
    .then(async () => {
      const win = new BrowserWindow({
        show: false,
        width: 1440,
        height: 1040,
        useContentSize: true,
        webPreferences: { offscreen: true, nodeIntegration: false, contextIsolation: true },
      })
      const errors = []
      win.webContents.on('console-message', event => {
        if (event.level === 'error') errors.push(event.message)
      })
      await win.loadFile(path.resolve(__dirname, '../../reports/interiors/index.html'))
      const result = await win.webContents.executeJavaScript(`(async()=>{
      const el=id=>document.getElementById(id);
      for(let n=0;n<100&&!document.body.dataset.ready&&!el('error').textContent;n++) await new Promise(r=>setTimeout(r,50));
      if(!document.body.dataset.ready) throw new Error(el('error').textContent||'Initialisation incomplète');
      function change(id,value){el(id).value=value;el(id).dispatchEvent(new Event('change'));if(el('error').textContent)throw new Error(el('error').textContent)}
      let count=0;
      for(const building of [...el('building').options].map(o=>o.value)){
        change('building',building);
        for(const level of [...el('level').options].map(o=>o.value)) for(const preset of ['ai','player']) for(const mirrored of [false,true]){
          el('mirror').checked=mirrored;change('preset',preset);change('level',level);
          if(building==='House'){
            const expected=[1,2,4][Number(level)];const beds=[...el('items').rows].filter(row=>row.cells[0].textContent==='CampBedroll').length;
            if(beds!==expected) throw new Error(building+' '+level+': '+beds+' lits au lieu de '+expected);
          }
          if(preset==='ai'&&!el('items').rows.length) throw new Error('Pièce sans mobilier : '+building);
          count++;
        }
      }
      change('building','House');change('level','2');change('preset','ai');el('mirror').checked=false;el('mirror').dispatchEvent(new Event('change'));
      const before=el('scene').toDataURL();el('grid').checked=true;el('coordinates').checked=true;el('grid').dispatchEvent(new Event('input'));
      if(before===el('scene').toDataURL())throw new Error('Grille sans effet');
      const grid=el('scene').toDataURL();el('furniture').checked=false;el('furniture').dispatchEvent(new Event('input'));
      if(grid===el('scene').toDataURL())throw new Error('Mobilier sans effet');
      el('transparent').checked=true;el('transparent').dispatchEvent(new Event('input'));
      if(el('scene').getContext('2d').getImageData(0,0,1,1).data[3]!==0)throw new Error('Export non transparent');
      el('reset').click();change('building','TownCenter');el('grid').checked=true;el('grid').dispatchEvent(new Event('input'));
      await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
      return {count,exportReady:el('scene').toDataURL().startsWith('data:image/png;base64,')};
    })()`)
      if (errors.length) throw new Error(errors.join('\n'))
      fs.writeFileSync(
        path.resolve(__dirname, '../../reports/interiors/preview.png'),
        (await win.webContents.capturePage()).toPNG()
      )
      console.log(JSON.stringify(result))
      win.destroy()
      app.exit(0)
    })
    .catch(error => {
      console.error(error)
      app.exit(1)
    })
}
