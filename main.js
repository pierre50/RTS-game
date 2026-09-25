const { app, BrowserWindow, ipcMain } = require('electron')
const fs = require('fs')
const path = require('path')

const devServerUrl = process.env.ELECTRON_START_URL

function savesDir() {
  const dir = path.join(app.getPath('userData'), 'saves')
  fs.mkdirSync(dir, { recursive: true })
  return dir
}

function isValidSaveKey(key) {
  return typeof key === 'string' && (key === 'save_autosave' || /^save_\d+$/.test(key))
}

function saveFilePath(key) {
  return path.join(savesDir(), `${key}.save`)
}

function indexFilePath() {
  return path.join(savesDir(), 'index.json')
}

// Publishing a manifest must never leave a partially written JSON/compressed file.
function writeSaveFile(file, value) {
  const temporary = `${file}.tmp`
  try {
    fs.writeFileSync(temporary, value, 'utf-8')
    fs.renameSync(temporary, file)
  } finally {
    try {
      fs.unlinkSync(temporary)
    } catch {
      /* Renamed already, or no temporary file was written. */
    }
  }
}

ipcMain.on('saves:getIndex', event => {
  try {
    event.returnValue = fs.readFileSync(indexFilePath(), 'utf-8')
  } catch {
    event.returnValue = null
  }
})

ipcMain.on('saves:setIndex', (event, json) => {
  try {
    writeSaveFile(indexFilePath(), json)
    event.returnValue = { ok: true, path: indexFilePath() }
  } catch (error) {
    event.returnValue = {
      ok: false,
      error: error && typeof error.message === 'string' ? error.message : String(error),
      path: indexFilePath(),
    }
  }
})

ipcMain.on('saves:getItem', (event, key) => {
  if (!isValidSaveKey(key)) {
    event.returnValue = null
    return
  }
  try {
    event.returnValue = require('./electron/shared-save-blocks.cjs').decodeBlock(
      key,
      fs.readFileSync(saveFilePath(key))
    )
  } catch {
    event.returnValue = null
  }
})

ipcMain.on('saves:setItem', (event, key, value) => {
  if (!isValidSaveKey(key)) {
    event.returnValue = { ok: false, error: 'INVALID_SAVE_KEY' }
    return
  }
  try {
    writeSaveFile(saveFilePath(key), value)
    event.returnValue = { ok: true, path: saveFilePath(key) }
  } catch (error) {
    event.returnValue = {
      ok: false,
      error: error && typeof error.message === 'string' ? error.message : String(error),
      path: saveFilePath(key),
    }
  }
})

ipcMain.on('saves:removeItem', (event, key) => {
  if (isValidSaveKey(key) && !/^save_9\d{78}$/.test(key)) {
    try {
      fs.unlinkSync(saveFilePath(key))
    } catch {
      // save already absent, nothing to remove
    }
  }
  event.returnValue = true
})

let saveTransactions
function transactions() {
  return (saveTransactions ??= require('./electron/save-transactions.cjs').createSaveTransactions(savesDir()))
}
const saveOwners = new WeakMap()
ipcMain.handle('saves:begin', (event, key) => {
  const owner = event.sender
  if (!saveOwners.has(owner))
    saveOwners.set(owner, require('./electron/save-owner.cjs').bindSaveOwner(transactions(), owner))
  return saveOwners.get(owner).begin(key)
})
ipcMain.handle('saves:batchNative', (event, token, parts) => transactions().batch(token, event.sender.id, parts, true))
ipcMain.handle('saves:batch', (event, token, parts) => transactions().batch(token, event.sender.id, parts))
ipcMain.handle('saves:commit', (event, token, raw, index) => transactions().commit(token, event.sender.id, raw, index))
ipcMain.handle('saves:abort', (event, token) => transactions().abort(token, event.sender.id))

ipcMain.on('app:quit', () => {
  app.quit()
})

function createWindow() {
  const win = new BrowserWindow({
    width: 800,
    height: 600,
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, 'preload.js'),
    },
  })

  win.once('ready-to-show', () => win.show())

  if (devServerUrl) {
    win.loadURL(devServerUrl)
    win.webContents.openDevTools()
  } else {
    win.loadFile(path.join(app.getAppPath(), 'build', 'index.html'))
  }
}

app.whenReady().then(createWindow)

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})
