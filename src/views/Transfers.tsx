import { useState, useEffect } from 'react'
import {
  Download,
  Upload,
  Pause,
  Play,
  Trash2,
  FolderOpen
} from 'lucide-react'
import { torrentService, TorrentInfo, TorrentStatus } from '../services/TorrentService'

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

function formatSpeed(bytesPerSec: number): string {
  return formatBytes(bytesPerSec) + '/s'
}

export default function Transfers() {
  const [torrents, setTorrents] = useState<TorrentInfo[]>([])
  const [status, setStatus] = useState<TorrentStatus>({ active: 0, downloading: 0, seeding: 0, downloadSpeed: 0, uploadSpeed: 0 })
  const [magnetInput, setMagnetInput] = useState('')
  const [adding, setAdding] = useState(false)

  useEffect(() => {
    // Load initial data
    const loadData = async () => {
      const [t, s] = await Promise.all([
        torrentService.getTorrents(),
        torrentService.getStatus()
      ])
      setTorrents(t)
      setStatus(s)
    }
    loadData()

    // Subscribe to updates
    const unsubscribe = torrentService.subscribe(setTorrents)
    
    // Poll status
    const interval = setInterval(async () => {
      const s = await torrentService.getStatus()
      setStatus(s)
    }, 1000)

    return () => {
      unsubscribe()
      clearInterval(interval)
    }
  }, [])

  const handleAddMagnet = async () => {
    if (!magnetInput.trim()) return
    
    setAdding(true)
    try {
      await torrentService.addTorrent(magnetInput.trim())
      setMagnetInput('')
    } catch (err: any) {
      console.error('Failed to add torrent:', err)
    } finally {
      setAdding(false)
    }
  }

  const handlePauseResume = async (infoHash: string, isPaused: boolean) => {
    if (isPaused) {
      await torrentService.resumeTorrent(infoHash)
    } else {
      await torrentService.pauseTorrent(infoHash)
    }
  }

  const handleRemove = async (infoHash: string) => {
    if (confirm('Remove this torrent?')) {
      await torrentService.removeTorrent(infoHash, false)
    }
  }

  const handleShowInFolder = async (path?: string) => {
    if (path && window.electronAPI) {
      await window.electronAPI.showInFolder(path)
    }
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="stat bg-base-100 rounded-box shadow">
          <div className="stat-figure text-primary">
            <Download className="w-8 h-8" />
          </div>
          <div className="stat-title">Downloading</div>
          <div className="stat-value text-primary">{status.downloading}</div>
          <div className="stat-desc">{formatSpeed(status.downloadSpeed)}</div>
        </div>

        <div className="stat bg-base-100 rounded-box shadow">
          <div className="stat-figure text-secondary">
            <Upload className="w-8 h-8" />
          </div>
          <div className="stat-title">Seeding</div>
          <div className="stat-value text-secondary">{status.seeding}</div>
          <div className="stat-desc">{formatSpeed(status.uploadSpeed)}</div>
        </div>

        <div className="stat bg-base-100 rounded-box shadow col-span-2">
          <div className="stat-title">Add Magnet Link</div>
          <div className="join w-full mt-2">
            <input
              type="text"
              placeholder="magnet:?xt=urn:btih:..."
              className="input input-bordered join-item flex-1"
              value={magnetInput}
              onChange={(e) => setMagnetInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddMagnet()}
            />
            <button
              className="btn btn-primary join-item"
              onClick={handleAddMagnet}
              disabled={adding || !magnetInput.trim()}
            >
              {adding ? (
                <span className="loading loading-spinner loading-sm"></span>
              ) : (
                'Add'
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Torrents List */}
      {torrents.length === 0 ? (
        <div className="card bg-base-100 shadow">
          <div className="card-body items-center text-center py-12">
            <Download className="w-16 h-16 text-base-content/20" />
            <h3 className="text-xl font-semibold mt-4">No Active Transfers</h3>
            <p className="text-base-content/60">
              Add a magnet link or search for torrents to get started
            </p>
          </div>
        </div>
      ) : (
        <div className="card bg-base-100 shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Size</th>
                  <th>Progress</th>
                  <th>Speed</th>
                  <th>Peers</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {torrents.map((torrent) => (
                  <tr key={torrent.infoHash} className="hover">
                    <td>
                      <div className="max-w-xs">
                        <p className="font-medium truncate">{torrent.name}</p>
                        <p className="text-xs text-base-content/50 truncate">
                          {torrent.infoHash}
                        </p>
                      </div>
                    </td>
                    <td className="text-sm">{formatBytes(torrent.length)}</td>
                    <td>
                      <div className="flex items-center gap-2">
                        <progress
                          className={`progress w-20 ${
                            torrent.done
                              ? 'progress-success'
                              : 'progress-primary'
                          }`}
                          value={torrent.progress * 100}
                          max="100"
                        ></progress>
                        <span className="text-sm">
                          {(torrent.progress * 100).toFixed(1)}%
                        </span>
                      </div>
                    </td>
                    <td>
                      <div className="text-sm">
                        <div className="flex items-center gap-1 text-success">
                          <Download className="w-3 h-3" />
                          {formatSpeed(torrent.downloadSpeed)}
                        </div>
                        <div className="flex items-center gap-1 text-info">
                          <Upload className="w-3 h-3" />
                          {formatSpeed(torrent.uploadSpeed)}
                        </div>
                      </div>
                    </td>
                    <td>{torrent.numPeers}</td>
                    <td>
                      <div className="flex gap-1">
                        <button
                          className="btn btn-ghost btn-xs btn-square"
                          onClick={() =>
                            handlePauseResume(torrent.infoHash, torrent.paused)
                          }
                          title={torrent.paused ? 'Resume' : 'Pause'}
                        >
                          {torrent.paused ? (
                            <Play className="w-4 h-4" />
                          ) : (
                            <Pause className="w-4 h-4" />
                          )}
                        </button>
                        <button
                          className="btn btn-ghost btn-xs btn-square"
                          onClick={() => handleShowInFolder(torrent.path)}
                          title="Show in folder"
                          disabled={!torrent.path}
                        >
                          <FolderOpen className="w-4 h-4" />
                        </button>
                        <button
                          className="btn btn-ghost btn-xs btn-square text-error"
                          onClick={() => handleRemove(torrent.infoHash)}
                          title="Remove"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
