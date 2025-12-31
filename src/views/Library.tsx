import { useState, useEffect } from 'react'
import {
  FolderOpen,
  Plus,
  Upload,
  File,
  Copy,
  Check,
  Trash2
} from 'lucide-react'
import { torrentService, CatalogEntry } from '../services/TorrentService'

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

export default function Library() {
  const [catalog, setCatalog] = useState<CatalogEntry[]>([])
  const [creating, setCreating] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)

  useEffect(() => {
    const loadCatalog = async () => {
      const torrents = await torrentService.getTorrents()
      // Filter for torrents that are seeded (done)
      const seeded = torrents.filter(t => t.done).map(t => ({
        infoHash: t.infoHash,
        name: t.name,
        magnetURI: t.magnetURI,
        size: t.length,
        files: t.files.length,
        addedAt: Date.now() // Approximated
      }))
      setCatalog(seeded)
    }

    loadCatalog()
    const interval = setInterval(loadCatalog, 5000)
    return () => clearInterval(interval)
  }, [])

  const handleCreateTorrent = async () => {
    if (!window.electronAPI) return

    const files = await window.electronAPI.selectFiles()
    if (files.length === 0) return

    setCreating(true)
    try {
      await torrentService.createTorrent(files)
      setCatalog(torrentService.getCatalog())
    } catch (err) {
      console.error('Failed to create torrent:', err)
    } finally {
      setCreating(false)
    }
  }

  const handleCopyMagnet = (magnetURI: string, infoHash: string) => {
    navigator.clipboard.writeText(magnetURI)
    setCopied(infoHash)
    setTimeout(() => setCopied(null), 2000)
  }

  const handleRemove = async (infoHash: string) => {
    if (confirm('Stop sharing this torrent?')) {
      await torrentService.removeTorrent(infoHash, false)
      setCatalog(torrentService.getCatalog())
    }
  }

  return (
    <div className="space-y-6">
      {/* Actions */}
      <div className="flex gap-4">
        <button
          className="btn btn-primary gap-2"
          onClick={handleCreateTorrent}
          disabled={creating}
        >
          {creating ? (
            <span className="loading loading-spinner loading-sm"></span>
          ) : (
            <Plus className="w-5 h-5" />
          )}
          Create Torrent
        </button>
      </div>

      {/* Shared Torrents */}
      <div className="card bg-base-100 shadow">
        <div className="card-body">
          <h2 className="card-title">
            <Upload className="w-5 h-5" />
            Your Shared Torrents
          </h2>

          {catalog.length === 0 ? (
            <div className="text-center py-12">
              <FolderOpen className="w-16 h-16 mx-auto text-base-content/20" />
              <h3 className="text-xl font-semibold mt-4">No Shared Files</h3>
              <p className="text-base-content/60 mt-2">
                Click "Create Torrent" to share files with the network
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Size</th>
                    <th>Files</th>
                    <th>Added</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {catalog.map((entry, index) => (
                    <tr key={entry.infoHash || `torrent-${index}`} className="hover">
                      <td>
                        <div className="flex items-center gap-2">
                          <File className="w-4 h-4 text-primary" />
                          <span className="font-medium">{entry.name}</span>
                        </div>
                      </td>
                      <td>{formatBytes(entry.size)}</td>
                      <td>{entry.files}</td>
                      <td className="text-sm text-base-content/60">
                        {new Date(entry.addedAt).toLocaleDateString()}
                      </td>
                      <td>
                        <div className="flex gap-1">
                          <button
                            className="btn btn-ghost btn-xs gap-1"
                            onClick={() =>
                              handleCopyMagnet(entry.magnetURI, entry.infoHash)
                            }
                            title="Copy magnet link"
                          >
                            {copied === entry.infoHash ? (
                              <Check className="w-4 h-4 text-success" />
                            ) : (
                              <Copy className="w-4 h-4" />
                            )}
                          </button>
                          <button
                            className="btn btn-ghost btn-xs text-error"
                            onClick={() => handleRemove(entry.infoHash)}
                            title="Stop sharing"
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
          )}
        </div>
      </div>
    </div>
  )
}
