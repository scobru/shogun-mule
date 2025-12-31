/// <reference types="vite/client" />

declare module 'gun' {
  const Gun: any
  export default Gun
}

declare module 'gun/sea' {}

// Electron API exposed via preload
interface TorrentInfo {
  infoHash: string
  magnetURI: string
  name: string
  progress: number
  downloadSpeed: number
  uploadSpeed: number
  numPeers: number
  length: number
  downloaded: number
  uploaded: number
  paused: boolean
  done: boolean
  path?: string
  files: Array<{
    name: string
    path: string
    length: number
    progress: number
  }>
}

interface TorrentStatus {
  active: number
  downloading: number
  seeding: number
  downloadSpeed: number
  uploadSpeed: number
}

interface TorrentAPI {
  getAll: () => Promise<TorrentInfo[]>
  getStatus: () => Promise<TorrentStatus>
  add: (magnetURI: string, downloadPath?: string) => Promise<TorrentInfo>
  create: (filePaths: string[]) => Promise<TorrentInfo>
  pause: (infoHash: string) => Promise<void>
  resume: (infoHash: string) => Promise<void>
  remove: (infoHash: string, deleteFiles?: boolean) => Promise<void>
  setSharePath: (path: string) => Promise<void>
  getSharePath: () => Promise<string | null>
  setDownloadPath: (path: string) => Promise<void>
}

declare global {
  interface Window {
    electronAPI?: {
      selectFolder: () => Promise<string | null>
      selectFiles: () => Promise<string[]>
      getAppPath: () => Promise<string>
      getDownloadsPath: () => Promise<string>
      showInFolder: (filePath: string) => Promise<void>
      openExternal: (url: string) => Promise<void>
      torrent: TorrentAPI
      platform: string
      isElectron: boolean
    }
  }
}

export {}
