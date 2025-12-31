import { useState, useEffect } from 'react'
import { FolderOpen, Save, Server, HardDrive, Users, RefreshCw } from 'lucide-react'
import { torrentService } from '../services/TorrentService'
import { peerDiscoveryService, RelayInfo } from '../services/PeerDiscoveryService'
import { DEFAULT_RELAY_PEERS } from '../config/constants'

export default function Settings() {
  const [downloadPath, setDownloadPath] = useState('')
  const [sharePath, setSharePath] = useState('')
  const [saved, setSaved] = useState(false)
  const [discoveredRelays, setDiscoveredRelays] = useState<RelayInfo[]>([])
  const [discoveredPeers, setDiscoveredPeers] = useState<RelayInfo[]>([])

  useEffect(() => {
    // Load current paths
    const loadPaths = async () => {
      const [download, share] = await Promise.all([
        torrentService.getDownloadPath(),
        torrentService.getSharePath()
      ])
      setDownloadPath(download)
      if (share) setSharePath(share)
    }
    loadPaths()

    // Load discovered relays and peers
    setDiscoveredRelays(peerDiscoveryService.getRelays())
    setDiscoveredPeers(peerDiscoveryService.getPeers())

    // Subscribe to relay discovery updates
    const unsubscribe = peerDiscoveryService.subscribe((relays) => {
      setDiscoveredRelays(relays)
      setDiscoveredPeers(peerDiscoveryService.getPeers())
    })

    return unsubscribe
  }, [])

  const handleSelectDownloadPath = async () => {
    if (!window.electronAPI) return
    const path = await window.electronAPI.selectFolder()
    if (path) {
      setDownloadPath(path)
    }
  }

  const handleSelectSharePath = async () => {
    if (!window.electronAPI) return
    const path = await window.electronAPI.selectFolder()
    if (path) {
      setSharePath(path)
    }
  }

  const handleSave = () => {
    torrentService.setDownloadPath(downloadPath)
    if (sharePath) {
      torrentService.setSharePath(sharePath)
    }
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const handleRefreshDiscovery = () => {
    peerDiscoveryService.refresh()
    setDiscoveredRelays(peerDiscoveryService.getRelays())
    setDiscoveredPeers(peerDiscoveryService.getPeers())
  }

  const formatLastSeen = (timestamp: number) => {
    const diff = Date.now() - timestamp
    if (diff < 60000) return 'now'
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`
    return `${Math.floor(diff / 86400000)}d ago`
  }

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Download Settings */}
      <div className="card bg-base-100 shadow">
        <div className="card-body">
          <h2 className="card-title">
            <HardDrive className="w-5 h-5" />
            Storage
          </h2>

          <div className="form-control">
            <label className="label">
              <span className="label-text">Download Location</span>
            </label>
            <div className="join w-full">
              <input
                type="text"
                className="input input-bordered join-item flex-1"
                value={downloadPath}
                readOnly
                placeholder="Select download folder..."
              />
              <button
                className="btn btn-outline join-item"
                onClick={handleSelectDownloadPath}
              >
                <FolderOpen className="w-4 h-4" />
              </button>
            </div>
            <label className="label">
              <span className="label-text-alt text-base-content/50">
                Downloaded files will be saved here
              </span>
            </label>
          </div>

          <div className="form-control mt-4">
            <label className="label">
              <span className="label-text">Shared Folder (Optional)</span>
            </label>
            <div className="join w-full">
              <input
                type="text"
                className="input input-bordered join-item flex-1"
                value={sharePath}
                readOnly
                placeholder="Select folder to share..."
              />
              <button
                className="btn btn-outline join-item"
                onClick={handleSelectSharePath}
              >
                <FolderOpen className="w-4 h-4" />
              </button>
            </div>
            <label className="label">
              <span className="label-text-alt text-base-content/50">
                Files in this folder will be shared automatically
              </span>
            </label>
          </div>
        </div>
      </div>

      {/* Network Settings */}
      <div className="card bg-base-100 shadow">
        <div className="card-body">
          <div className="flex items-center justify-between">
            <h2 className="card-title">
              <Server className="w-5 h-5" />
              Network
            </h2>
            <button
              className="btn btn-ghost btn-sm gap-1"
              onClick={handleRefreshDiscovery}
            >
              <RefreshCw className="w-4 h-4" />
              Refresh
            </button>
          </div>

          {/* Bootstrap Peers */}
          <div className="form-control">
            <label className="label">
              <span className="label-text">Bootstrap Peers</span>
            </label>
            <div className="bg-base-200 rounded-lg p-3">
              {DEFAULT_RELAY_PEERS.map((peer, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2 py-1 text-sm font-mono"
                >
                  <span className="w-2 h-2 rounded-full bg-info"></span>
                  {peer}
                </div>
              ))}
            </div>
          </div>

          {/* Discovered Relays */}
          <div className="form-control mt-4">
            <label className="label">
              <span className="label-text">Discovered Relays ({discoveredRelays.length})</span>
            </label>
            {discoveredRelays.length === 0 ? (
              <div className="text-sm text-base-content/50 py-2">
                No relays discovered yet. They will appear as you connect to the network.
              </div>
            ) : (
              <div className="bg-base-200 rounded-lg p-3 space-y-2">
                {discoveredRelays.map((relay) => (
                  <div
                    key={relay.pubKey}
                    className="flex items-center justify-between py-1"
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-success"></span>
                      <span className="font-medium">{relay.alias || 'Relay'}</span>
                      <span className="text-xs text-base-content/50 font-mono">
                        {relay.endpoint}
                      </span>
                    </div>
                    <span className="text-xs text-base-content/50">
                      {formatLastSeen(relay.lastSeen)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Discovered Peers */}
          <div className="form-control mt-4">
            <label className="label flex items-center gap-2">
              <Users className="w-4 h-4" />
              <span className="label-text">Online Peers ({discoveredPeers.length})</span>
            </label>
            {discoveredPeers.length === 0 ? (
              <div className="text-sm text-base-content/50 py-2">
                No other ShogunMule users online right now.
              </div>
            ) : (
              <div className="bg-base-200 rounded-lg p-3 space-y-1">
                {discoveredPeers.map((peer) => (
                  <div
                    key={peer.pubKey}
                    className="flex items-center justify-between py-1"
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-primary"></span>
                      <span className="font-medium">{peer.alias}</span>
                    </div>
                    <span className="text-xs text-base-content/50">
                      {formatLastSeen(peer.lastSeen)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Save Button */}
      <button
        className={`btn btn-primary gap-2 ${saved ? 'btn-success' : ''}`}
        onClick={handleSave}
      >
        <Save className="w-4 h-4" />
        {saved ? 'Saved!' : 'Save Settings'}
      </button>
    </div>
  )
}
