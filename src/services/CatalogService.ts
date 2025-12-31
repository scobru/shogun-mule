// CatalogService - publishes and discovers torrents via GunDB
// Uses the same paths as shogun-relay for network compatibility

import { authService } from './AuthService'
import { GUN_PATHS } from '../config/constants'

export interface NetworkTorrentEntry {
  infoHash: string
  name: string
  magnetURI: string
  size: number
  files: number
  sharedBy: string  // user's public key
  sharedByAlias?: string
  sharedAt: number
}

class CatalogService {
  private localCatalog: Map<string, NetworkTorrentEntry> = new Map()
  private networkCatalog: Map<string, NetworkTorrentEntry> = new Map()
  private subscribed: boolean = false

  // Publish a torrent to the GunDB network
  publishTorrent(torrent: {
    infoHash: string
    name: string
    magnetURI: string
    size: number
    files: number
  }): void {
    const gun = authService.getGun()
    const user = authService.getCurrentUser()
    
    if (!gun || !user) {
      console.warn('Cannot publish: not authenticated')
      return
    }

    const entry: NetworkTorrentEntry = {
      infoHash: torrent.infoHash,
      name: torrent.name,
      magnetURI: torrent.magnetURI,
      size: torrent.size,
      files: torrent.files,
      sharedBy: user.pub,
      sharedByAlias: user.alias,
      sharedAt: Date.now()
    }

    // Save to local catalog
    this.localCatalog.set(torrent.infoHash, entry)

    // Publish to global network path (same as relay uses)
    gun.get(GUN_PATHS.TORRENTS).get(torrent.infoHash).put({
      name: entry.name,
      magnetURI: entry.magnetURI,
      size: entry.size,
      files: entry.files,
      sharedBy: entry.sharedBy,
      sharedByAlias: entry.sharedByAlias,
      sharedAt: entry.sharedAt
    })

    // Index by keywords for search
    const keywords = entry.name.toLowerCase().split(/[\s._-]+/).filter(k => k.length >= 3)
    keywords.forEach(keyword => {
      gun.get(GUN_PATHS.SEARCH).get(keyword).get(torrent.infoHash).put(true)
    })

    // Also save to user's personal catalog
    gun.user().get('catalog').get(torrent.infoHash).put({
      name: entry.name,
      magnetURI: entry.magnetURI,
      size: entry.size,
      files: entry.files,
      addedAt: entry.sharedAt
    })

    console.log('Published torrent to network:', torrent.name)
  }

  // Remove a torrent from the network
  unpublishTorrent(infoHash: string): void {
    const gun = authService.getGun()
    
    if (!gun) return

    this.localCatalog.delete(infoHash)

    // Remove from global network (set to null)
    gun.get(GUN_PATHS.TORRENTS).get(infoHash).put(null)
    
    // Remove from user's catalog
    gun.user().get('catalog').get(infoHash).put(null)

    console.log('Unpublished torrent from network:', infoHash)
  }

  // Subscribe to network torrents
  subscribeToNetwork(onUpdate?: (torrents: NetworkTorrentEntry[]) => void): void {
    if (this.subscribed) return

    const gun = authService.getGun()
    if (!gun) return

    // Subscribe to all torrents in the network
    gun.get(GUN_PATHS.TORRENTS).map().on((data: any, infoHash: string) => {
      if (data && data.magnetURI && data.name) {
        const entry: NetworkTorrentEntry = {
          infoHash,
          name: data.name,
          magnetURI: data.magnetURI,
          size: data.size || 0,
          files: data.files || 0,
          sharedBy: data.sharedBy || 'unknown',
          sharedByAlias: data.sharedByAlias,
          sharedAt: data.sharedAt || Date.now()
        }
        this.networkCatalog.set(infoHash, entry)
        
        if (onUpdate) {
          onUpdate(this.getNetworkTorrents())
        }
      } else if (data === null) {
        // Torrent was removed
        this.networkCatalog.delete(infoHash)
        if (onUpdate) {
          onUpdate(this.getNetworkTorrents())
        }
      }
    })

    this.subscribed = true
    console.log('Subscribed to network torrents')
  }

  // Search network torrents
  searchNetwork(query: string): NetworkTorrentEntry[] {
    const lowerQuery = query.toLowerCase()
    return this.getNetworkTorrents().filter(entry =>
      entry.name.toLowerCase().includes(lowerQuery)
    )
  }

  // Get all network torrents
  getNetworkTorrents(): NetworkTorrentEntry[] {
    return Array.from(this.networkCatalog.values())
  }

  // Get local catalog (torrents this user is sharing)
  getLocalCatalog(): NetworkTorrentEntry[] {
    return Array.from(this.localCatalog.values())
  }

  // Announce this client as a peer
  announceAsPeer(): void {
    const gun = authService.getGun()
    const user = authService.getCurrentUser()
    
    if (!gun || !user) return

    // Announce in the unified peers path
    gun.get(GUN_PATHS.PEERS).get(user.pub).put({
      alias: user.alias,
      lastSeen: Date.now(),
      torrentsCount: this.localCatalog.size,
      type: 'mule'
    })
  }
}

// Singleton instance
export const catalogService = new CatalogService()
