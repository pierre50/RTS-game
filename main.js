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
    event.returnValue = fs.readFileSync(saveFilePath(key), 'utf-8')
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
  if (isValidSaveKey(key)) {
    try {
      fs.unlinkSync(saveFilePath(key))
    } catch {
      // save already absent, nothing to remove
    }
  }
  event.returnValue = true
})

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
