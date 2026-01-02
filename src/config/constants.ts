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
// All paths under shogun/ for consistency between mule and relay
export const GUN_PATHS = {
  // Base
  SHOGUN: 'shogun',
  SHOGUN_INDEX: 'shogun/index',
  
  // Network discovery
  RELAYS: 'shogun/network/relays',
  PEERS: 'shogun/network/peers',
  TORRENTS: 'shogun/network/torrents',
  
  // Search index
  SEARCH: 'shogun/network/search',
  
  // Reputation and Features
  REPUTATION: 'shogun/network/reputation',
  PIN_REQUESTS: 'shogun/network/pin-requests',
  PIN_RESPONSES: 'shogun/network/pin-responses',
  
  // Chat
  LOBBY: 'shogun/chat/lobby',
  CHATS: 'shogun/chats',
  
  // User data
  USERS: 'shogun/users',
  UPLOADS: 'shogun/uploads',
  LOGS: 'shogun/logs',
  
  // System
  SYSTEM_HASH: 'shogun/systemhash',
  
  // Indexes
  OBSERVATIONS_BY_HOST: 'shogun/index/observations-by-host',
  DEALS_BY_CID: 'shogun/index/deals-by-cid',
  DEALS_BY_CLIENT: 'shogun/index/deals-by-client',
  STORAGE_DEALS: 'shogun/frozen/storage-deals',
  FROZEN_STORAGE_DEALS: 'shogun/frozen/storage-deals',
  
  // Anna's Archive
  ANNAS_ARCHIVE: 'shogun/annas-archive',
  
  // Wormhole
  SHOGUN_WORMHOLE: 'shogun/wormhole',
  
  // x402
  X402: 'shogun/x402'
} as const;

export type GunPath = typeof GUN_PATHS[keyof typeof GUN_PATHS];

/**
 * Helper to get a Gun node from a unified path string
 * Handles splitting path by '/' and traversing the graph hierarchically
 * 
 * @param gun - Gun instance
 * @param path - Path string (e.g. 'shogun/network/relays')
 * @returns - Gun node at the end of the path
 */
export const getGunNode = (gun: any, path: string): any => {
  const parts = path.split('/');
  let node = gun;
  for (const part of parts) {
    node = node.get(part);
  }
  return node;
};
