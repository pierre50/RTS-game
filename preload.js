const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronSaves', {
  getIndex: () => ipcRenderer.sendSync('saves:getIndex'),
  setIndex: json => ipcRenderer.sendSync('saves:setIndex', json),
  getItem: key => ipcRenderer.sendSync('saves:getItem', key),
  setItem: (key, value) => ipcRenderer.sendSync('saves:setItem', key, value),
  removeItem: key => ipcRenderer.sendSync('saves:removeItem', key),
})

contextBridge.exposeInMainWorld('electronApp', {
  quit: () => ipcRenderer.send('app:quit'),
})
