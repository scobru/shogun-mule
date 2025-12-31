// Preload script - must be CommonJS for Electron contextBridge
const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  // Dialog
  selectFolder: () => ipcRenderer.invoke('select-folder'),
  selectFiles: () => ipcRenderer.invoke('select-files'),
  getAppPath: () => ipcRenderer.invoke('get-app-path'),
  getDownloadsPath: () => ipcRenderer.invoke('get-downloads-path'),
  
  // Shell
  showInFolder: (filePath) => ipcRenderer.invoke('shell:show-in-folder', filePath),
  openExternal: (url) => ipcRenderer.invoke('shell:open-external', url),
  
  // Torrent
  torrent: {
    getAll: () => ipcRenderer.invoke('torrent:get-all'),
    getStatus: () => ipcRenderer.invoke('torrent:get-status'),
    add: (magnetURI, downloadPath) => ipcRenderer.invoke('torrent:add', magnetURI, downloadPath),
    create: (filePaths) => ipcRenderer.invoke('torrent:create', filePaths),
    pause: (infoHash) => ipcRenderer.invoke('torrent:pause', infoHash),
    resume: (infoHash) => ipcRenderer.invoke('torrent:resume', infoHash),
    remove: (infoHash, deleteFiles) => ipcRenderer.invoke('torrent:remove', infoHash, deleteFiles),
    setSharePath: (path) => ipcRenderer.invoke('torrent:set-share-path', path),
    getSharePath: () => ipcRenderer.invoke('torrent:get-share-path'),
    setDownloadPath: (path) => ipcRenderer.invoke('torrent:set-download-path', path)
  },
  
  // Platform info
  platform: process.platform,
  isElectron: true
})
