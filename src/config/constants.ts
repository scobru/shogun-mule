// Default relay peers - use HTTP/HTTPS URLs (GunDB will handle WS upgrade)
export const DEFAULT_RELAY_PEERS = [
  'https://shogun-relay.scobrudot.dev/gun',
  'https://shogun-relay-2.scobrudot.dev/gun'
]

// Relay API URL for server-side operations (e.g. registration)
export const RELAY_API_URL = 'https://shogun-relay.scobrudot.dev/api/v1'

// GunDB configuration
export const GUN_CONFIG = {
  peers: DEFAULT_RELAY_PEERS,
  localStorage: false,
  radisk: true
}

// Torrent configuration
export const TORRENT_CONFIG = {
  maxDownloadSpeed: 0,
  maxUploadSpeed: 0,
  maxConnections: 100,
  announceInterval: 30000
}

// Unified network paths in GunDB
// All paths under shogun/network/* for consistency between mule and relay
export const GUN_PATHS = {
  // Network discovery
  RELAYS: 'shogun/network/relays',
  PEERS: 'shogun/network/peers',
  TORRENTS: 'shogun/network/torrents',
  
  // Search index
  SEARCH: 'shogun/network/search',
  
  // Reputation
  REPUTATION: 'shogun/network/reputation',
  
  // Chat
  LOBBY: 'shogun/chat/lobby',
  CHATS: 'shogun/chats',
  
  // User data
  USERS: 'shogun/users'
}
