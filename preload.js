const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronSaves', {
  begin: key => ipcRenderer.invoke('saves:begin', key),
  batchNative: (token, parts) => ipcRenderer.invoke('saves:batchNative', token, parts),
  batch: (token, parts) => ipcRenderer.invoke('saves:batch', token, parts),
  commit: (token, raw, index) => ipcRenderer.invoke('saves:commit', token, raw, index),
  abort: token => ipcRenderer.invoke('saves:abort', token),
  getIndex: () => ipcRenderer.sendSync('saves:getIndex'),
  setIndex: json => ipcRenderer.sendSync('saves:setIndex', json),
  getItem: key => ipcRenderer.sendSync('saves:getItem', key),
  setItem: (key, value) => ipcRenderer.sendSync('saves:setItem', key, value),
  removeItem: key => ipcRenderer.sendSync('saves:removeItem', key),
})

contextBridge.exposeInMainWorld('electronApp', {
  quit: () => ipcRenderer.send('app:quit'),
})
