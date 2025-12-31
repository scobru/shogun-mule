// PeerDiscoveryService - Auto-discover relays and peers from GunDB network
// Uses unified shogun/network/* paths

import { authService } from './AuthService'
import { DEFAULT_RELAY_PEERS, GUN_PATHS } from '../config/constants'

export interface RelayInfo {
  pubKey: string
  endpoint: string
  alias?: string
  lastSeen: number
  catalogUrl?: string
  torrentsCount?: number
  type: 'relay' | 'mule'
}

class PeerDiscoveryService {
  private discoveredRelays: Map<string, RelayInfo> = new Map()
  private discoveredPeers: Map<string, RelayInfo> = new Map()
  private bootstrapPeers: string[] = [...DEFAULT_RELAY_PEERS]
  private listeners: Set<(relays: RelayInfo[]) => void> = new Set()
  private isDiscovering: boolean = false
  private announceInterval: ReturnType<typeof setInterval> | null = null

  startDiscovery(): void {
    if (this.isDiscovering) return

    const gun = authService.getGun()
    if (!gun) {
      console.warn('Cannot start discovery: GunDB not initialized')
      return
    }

    this.isDiscovering = true
    console.log('🔍 Starting peer discovery...')

    // Announce immediately
    this.announceSelf()

    // Announce periodically (every minute) to keep presence alive
    this.announceInterval = setInterval(() => {
      this.announceSelf()
    }, 60 * 1000)

    // Subscribe to unified paths
    this.subscribeToRelays(gun)
    this.subscribeToPeers(gun)
  }

  stopDiscovery(): void {
    if (this.announceInterval) {
      clearInterval(this.announceInterval)
      this.announceInterval = null
    }
    this.isDiscovering = false
  }

  // Subscribe to shogun/network/relays
  private subscribeToRelays(gun: any): void {
    gun.get(GUN_PATHS.RELAYS).map().on((data: any, pubKey: string) => {
      if (!data) return
      
      const endpoint = data.endpoint || data.publicUrl || data.host
      if (!endpoint) return

      let cleanEndpoint = endpoint.startsWith('http') ? endpoint : `https://${endpoint}`
      if (cleanEndpoint.endsWith('/')) cleanEndpoint = cleanEndpoint.slice(0, -1)

      const relay: RelayInfo = {
        pubKey,
        endpoint: cleanEndpoint,
        alias: data.alias || data.name,
        lastSeen: data.lastSeen || Date.now(),
        catalogUrl: `${cleanEndpoint}/api/v1/torrent/catalog`,
        torrentsCount: data.torrentsCount || data.activeTorrents,
        type: 'relay'
      }

      this.discoveredRelays.set(pubKey, relay)
      this.addAsGunPeer(gun, cleanEndpoint)
      console.log(`📡 Discovered relay: ${relay.alias || cleanEndpoint}`)
      this.notifyListeners()
    })
  }

  // Subscribe to shogun/network/peers (Mule clients)
  private subscribeToPeers(gun: any): void {
    gun.get(GUN_PATHS.PEERS).map().on((data: any, pubKey: string) => {
      if (!data || !data.alias) return

      const peer: RelayInfo = {
        pubKey,
        endpoint: '',
        alias: data.alias,
        lastSeen: data.lastSeen || Date.now(),
        torrentsCount: data.torrentsCount,
        type: data.type || 'mule'
      }

      this.discoveredPeers.set(pubKey, peer)
      console.log(`👤 Discovered peer: ${peer.alias}`)
      this.notifyListeners()
    })
  }

  private addAsGunPeer(gun: any, endpoint: string): void {
    try {
      const gunPeerUrl = endpoint.endsWith('/gun') ? endpoint : `${endpoint}/gun`
      gun.opt({ peers: [gunPeerUrl] })
      
      if (!this.bootstrapPeers.includes(gunPeerUrl)) {
        this.bootstrapPeers.push(gunPeerUrl)
      }
    } catch (err) {
      console.error('Failed to add peer:', endpoint, err)
    }
  }

  announceSelf(): void {
    const gun = authService.getGun()
    const user = authService.getCurrentUser()

    if (!gun || !user) return

    gun.get(GUN_PATHS.PEERS).get(user.pub).put({
      alias: user.alias,
      lastSeen: Date.now(),
      type: 'mule'
    })
    console.log('📢 Announced presence on network')
  }

  getRelays(): RelayInfo[] {
    return Array.from(this.discoveredRelays.values())
      .filter(r => Date.now() - r.lastSeen < 24 * 60 * 60 * 1000)
      .sort((a, b) => b.lastSeen - a.lastSeen)
  }

  getPeers(): RelayInfo[] {
    return Array.from(this.discoveredPeers.values())
      .filter(p => Date.now() - p.lastSeen < 60 * 60 * 1000)
      .sort((a, b) => b.lastSeen - a.lastSeen)
  }

  // Get all contacts (both relays and peers for chat)
  getAllContacts(): RelayInfo[] {
    const all = new Map<string, RelayInfo>()
    
    this.discoveredRelays.forEach((r, k) => all.set(k, r))
    this.discoveredPeers.forEach((p, k) => all.set(k, p))
    
    return Array.from(all.values())
      .filter(c => Date.now() - c.lastSeen < 24 * 60 * 60 * 1000)
      .sort((a, b) => b.lastSeen - a.lastSeen)
  }

  getBootstrapPeers(): string[] {
    return [...this.bootstrapPeers]
  }

  subscribe(listener: (relays: RelayInfo[]) => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private notifyListeners(): void {
    const relays = this.getRelays()
    this.listeners.forEach(l => l(relays))
  }

  refresh(): void {
    this.announceSelf()
  }
}

export const peerDiscoveryService = new PeerDiscoveryService()
