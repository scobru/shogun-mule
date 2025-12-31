import { authService } from './AuthService'
import { GUN_PATHS, DEFAULT_RELAY_PEERS } from '../config/constants'

export interface NetworkTorrent {
  infoHash: string
  name: string
  magnetURI: string
  size: number
  files: number
  sharedBy: string
  sharedAt: number
  relayUrl?: string
}

export interface RelayInfo {
  url: string
  pubKey: string
  lastSeen: number
  torrentsCount?: number
}

type NetworkListener = (torrents: NetworkTorrent[]) => void

class NetworkService {
  private networkTorrents: Map<string, NetworkTorrent> = new Map()
  private relays: Map<string, RelayInfo> = new Map()
  private listeners: Set<NetworkListener> = new Set()
  private subscribed: boolean = false

  // Connect to the Shogun network
  connect(): void {
    if (this.subscribed) return

    const gun = authService.getGun()

    // Subscribe to relay announcements
    gun.get(GUN_PATHS.RELAYS).map().on((data: any, key: string) => {
      if (data && data.url) {
        this.relays.set(key, {
          url: data.url,
          pubKey: key,
          lastSeen: data.lastSeen || Date.now(),
          torrentsCount: data.torrentsCount
        })
      }
    })

    // Subscribe to network torrents
    gun.get(GUN_PATHS.TORRENTS).map().on((data: any, infoHash: string) => {
      if (data && data.magnetURI) {
        this.networkTorrents.set(infoHash, {
          infoHash,
          name: data.name,
          magnetURI: data.magnetURI,
          size: data.size || 0,
          files: data.files || 0,
          sharedBy: data.sharedBy,
          sharedAt: data.sharedAt || Date.now()
        })
        this.notifyListeners()
      }
    })

    this.subscribed = true
  }

  // Disconnect from network
  disconnect(): void {
    // GunDB doesn't have explicit disconnect, but we can clean up
    this.networkTorrents.clear()
    this.relays.clear()
    this.subscribed = false
  }

  // Search network torrents
  search(query: string): NetworkTorrent[] {
    const lowerQuery = query.toLowerCase()
    return Array.from(this.networkTorrents.values()).filter((torrent) =>
      torrent.name.toLowerCase().includes(lowerQuery)
    )
  }

  // Get all network torrents
  getNetworkTorrents(): NetworkTorrent[] {
    return Array.from(this.networkTorrents.values())
  }

  // Get connected relays
  getRelays(): RelayInfo[] {
    return Array.from(this.relays.values())
  }

  // Fetch catalog from a specific relay via HTTP
  async fetchRelayCatalog(relayUrl: string): Promise<NetworkTorrent[]> {
    try {
      // Remove /gun suffix if present
      const baseUrl = relayUrl.replace(/\/gun$/, '')
      const response = await fetch(`${baseUrl}/api/v1/torrent/catalog`)
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      const data = await response.json()
      
      if (data.success && data.catalog) {
        return data.catalog.map((entry: any) => ({
          infoHash: entry.torrentHash || entry.infoHash,
          name: entry.torrentName || entry.name,
          magnetURI: entry.magnetLink || entry.magnetURI,
          size: entry.files?.reduce((acc: number, f: any) => acc + (f.size || 0), 0) || 0,
          files: entry.files?.length || 0,
          sharedBy: data.relayPubKey || 'unknown',
          sharedAt: entry.completedAt || Date.now(),
          relayUrl: relayUrl
        }))
      }
      
      return []
    } catch (error) {
      console.error(`Failed to fetch catalog from ${relayUrl}:`, error)
      return []
    }
  }

  // Fetch catalogs from all known relays
  async fetchAllRelayCatalogs(): Promise<NetworkTorrent[]> {
    const allTorrents: NetworkTorrent[] = []
    const relayUrls = [
      ...DEFAULT_RELAY_PEERS.map((p) => p.replace(/\/gun$/, '')),
      ...Array.from(this.relays.values()).map((r) => r.url)
    ]

    // Deduplicate
    const uniqueUrls = [...new Set(relayUrls)]

    await Promise.allSettled(
      uniqueUrls.map(async (url) => {
        const catalog = await this.fetchRelayCatalog(url)
        catalog.forEach((torrent) => {
          // Only add if not already present
          if (!this.networkTorrents.has(torrent.infoHash)) {
            this.networkTorrents.set(torrent.infoHash, torrent)
            allTorrents.push(torrent)
          }
        })
      })
    )

    this.notifyListeners()
    return allTorrents
  }

  // Subscribe to network updates
  subscribe(listener: NetworkListener): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private notifyListeners(): void {
    const torrents = this.getNetworkTorrents()
    this.listeners.forEach((listener) => listener(torrents))
  }
}

// Singleton instance
export const networkService = new NetworkService()
