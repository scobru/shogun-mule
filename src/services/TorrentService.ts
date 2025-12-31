// TorrentService - communicates with main process via IPC
// WebTorrent runs in main process, this is just the renderer interface

import { catalogService } from './CatalogService'

export interface TorrentInfo {
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
  files: TorrentFile[]
}

export interface TorrentFile {
  name: string
  path: string
  length: number
  progress: number
}

export interface TorrentStatus {
  active: number
  downloading: number
  seeding: number
  downloadSpeed: number
  uploadSpeed: number
}

export interface CatalogEntry {
  infoHash: string
  name: string
  magnetURI: string
  size: number
  files: number
  addedAt: number
}

type TorrentListener = (torrents: TorrentInfo[]) => void

class TorrentService {
  private listeners: Set<TorrentListener> = new Set()
  private catalog: Map<string, CatalogEntry> = new Map()
  private downloadPath: string = ''
  private pollInterval: ReturnType<typeof setInterval> | null = null

  constructor() {
    this.init()
  }

  private async init() {
    if (window.electronAPI) {
      this.downloadPath = await window.electronAPI.getDownloadsPath()
    }
  }

  // Start polling for updates
  start(): void {
    if (this.pollInterval) return
    
    // Poll for torrent updates every second
    this.pollInterval = setInterval(async () => {
      const torrents = await this.getTorrents()
      this.notifyListeners(torrents)
    }, 1000)
  }

  // Stop polling
  stop(): void {
    if (this.pollInterval) {
      clearInterval(this.pollInterval)
      this.pollInterval = null
    }
  }

  // Set download path
  async setDownloadPath(path: string): Promise<void> {
    this.downloadPath = path
    if (window.electronAPI?.torrent) {
        await window.electronAPI.torrent.setDownloadPath(path)
    }
  }

  async getDownloadPath(): Promise<string> {
    if (window.electronAPI) {
        return await window.electronAPI.getDownloadsPath()
    }
    return this.downloadPath
  }

  async getSharePath(): Promise<string | null> {
    if (window.electronAPI?.torrent) {
        return await window.electronAPI.torrent.getSharePath()
    }
    return null
  }

  // Set share path (for auto-sharing files)
  async setSharePath(path: string): Promise<void> {
    if (!window.electronAPI?.torrent) return
    await window.electronAPI.torrent.setSharePath(path)
  }

  // Get all torrents from main process
  async getTorrents(): Promise<TorrentInfo[]> {
    if (!window.electronAPI?.torrent) return []
    return await window.electronAPI.torrent.getAll()
  }

  // Get torrent status
  async getStatus(): Promise<TorrentStatus> {
    if (!window.electronAPI?.torrent) {
      return { active: 0, downloading: 0, seeding: 0, downloadSpeed: 0, uploadSpeed: 0 }
    }
    return await window.electronAPI.torrent.getStatus()
  }

  // Add a torrent by magnet URI
  async addTorrent(magnetURI: string): Promise<TorrentInfo> {
    console.log('[TorrentService] addTorrent called', magnetURI.slice(0, 40))
    if (!window.electronAPI?.torrent) {
      console.error('[TorrentService] Electron API not available')
      throw new Error('Electron API not available')
    }
    
    console.log('[TorrentService] invoking electronAPI.torrent.add')
    const torrent = await window.electronAPI.torrent.add(magnetURI, this.downloadPath)
    console.log('[TorrentService] torrent added, received:', torrent)
    
    // Add to local catalog
    this.addToCatalog(torrent)
    
    return torrent
  }

  // Create a torrent from files
  async createTorrent(filePaths: string[]): Promise<TorrentInfo> {
    if (!window.electronAPI?.torrent) {
      throw new Error('Electron API not available')
    }
    
    const torrent = await window.electronAPI.torrent.create(filePaths)
    this.addToCatalog(torrent)
    
    // Publish to GunDB network for discovery
    catalogService.publishTorrent({
      infoHash: torrent.infoHash,
      name: torrent.name,
      magnetURI: torrent.magnetURI,
      size: torrent.length,
      files: torrent.files.length
    })
    
    return torrent
  }

  // Pause a torrent
  async pauseTorrent(infoHash: string): Promise<void> {
    await window.electronAPI?.torrent?.pause(infoHash)
  }

  // Resume a torrent
  async resumeTorrent(infoHash: string): Promise<void> {
    await window.electronAPI?.torrent?.resume(infoHash)
  }

  // Remove a torrent
  async removeTorrent(infoHash: string, deleteFiles: boolean = false): Promise<void> {
    await window.electronAPI?.torrent?.remove(infoHash, deleteFiles)
    this.catalog.delete(infoHash)
  }

  // Subscribe to torrent updates
  subscribe(listener: TorrentListener): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private notifyListeners(torrents: TorrentInfo[]): void {
    this.listeners.forEach((listener) => listener(torrents))
  }

  private addToCatalog(torrent: TorrentInfo): void {
    this.catalog.set(torrent.infoHash, {
      infoHash: torrent.infoHash,
      name: torrent.name,
      magnetURI: torrent.magnetURI,
      size: torrent.length,
      files: torrent.files.length,
      addedAt: Date.now()
    })
  }

  getCatalog(): CatalogEntry[] {
    return Array.from(this.catalog.values())
  }
}

// Singleton instance
export const torrentService = new TorrentService()
