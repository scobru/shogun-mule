import { useState, useEffect } from 'react'
import { Search as SearchIcon, Download, RefreshCw, Server } from 'lucide-react'
import { networkService } from '../services/NetworkService'
import { torrentService } from '../services/TorrentService'
import { catalogService } from '../services/CatalogService'

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

// Unified torrent type for display
interface DisplayTorrent {
  infoHash: string
  name: string
  magnetURI: string
  size: number
  files: number
  source: 'gun' | 'relay'
  sharedBy?: string
  relayUrl?: string
}

export default function Search() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<DisplayTorrent[]>([])
  const [allTorrents, setAllTorrents] = useState<DisplayTorrent[]>([])

  const [fetchingCatalogs, setFetchingCatalogs] = useState(false)
  const [downloading, setDownloading] = useState<Set<string>>(new Set())

  // Merge torrents from both sources
  const mergeTorrents = () => {
    const merged = new Map<string, DisplayTorrent>()
    
    // Add GunDB torrents
    catalogService.getNetworkTorrents().forEach(t => {
      merged.set(t.infoHash, {
        infoHash: t.infoHash,
        name: t.name,
        magnetURI: t.magnetURI,
        size: t.size,
        files: t.files,
        source: 'gun',
        sharedBy: t.sharedByAlias || t.sharedBy
      })
    })
    
    // Add relay torrents (may override or add new)
    networkService.getNetworkTorrents().forEach(t => {
      if (!merged.has(t.infoHash)) {
        merged.set(t.infoHash, {
          infoHash: t.infoHash,
          name: t.name,
          magnetURI: t.magnetURI,
          size: t.size,
          files: t.files,
          source: 'relay',
          relayUrl: t.relayUrl
        })
      }
    })
    
    return Array.from(merged.values())
  }

  useEffect(() => {
    // Subscribe to network updates
    const unsubscribe = networkService.subscribe(() => {
      setAllTorrents(mergeTorrents())
    })

    // Subscribe to GunDB catalog updates
    catalogService.subscribeToNetwork(() => {
      setAllTorrents(mergeTorrents())
    })

    // Initial load
    setAllTorrents(mergeTorrents())

    return unsubscribe
  }, [])

  const handleSearch = () => {
    if (query.trim()) {
      const q = query.trim().toLowerCase()
      const filtered = allTorrents.filter(t => 
        t.name.toLowerCase().includes(q) || 
        t.infoHash.toLowerCase().includes(q)
      )
      setResults(filtered)
    } else {
      setResults([])
    }
  }

  const handleFetchCatalogs = async () => {
    setFetchingCatalogs(true)
    try {
      await networkService.fetchAllRelayCatalogs()
    } catch (err) {
      console.error('Failed to fetch catalogs:', err)
    } finally {
      setFetchingCatalogs(false)
    }
  }

  const handleDownload = async (torrent: DisplayTorrent) => {
    console.log('[Search] handleDownload called for:', torrent.name, torrent.infoHash)
    setDownloading((prev) => new Set(prev).add(torrent.infoHash))
    try {
      await torrentService.addTorrent(torrent.magnetURI)
      console.log('[Search] torrentService.addTorrent completed')
    } catch (err) {
      console.error('Failed to add torrent:', err)
    } finally {
      setDownloading((prev) => {
        const next = new Set(prev)
        next.delete(torrent.infoHash)
        return next
      })
    }
  }

  const displayTorrents = query ? results : allTorrents
  const relays = networkService.getRelays()

  return (
    <div className="space-y-6">
      {/* Search Header */}
      <div className="card bg-base-100 shadow">
        <div className="card-body">
          <div className="flex flex-col md:flex-row gap-4">
            {/* Search Input */}
            <div className="join flex-1">
              <input
                type="text"
                placeholder="Search for files in the Shogun network..."
                className="input input-bordered join-item w-full"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              />
              <button className="btn btn-primary join-item" onClick={handleSearch}>
                <SearchIcon className="w-5 h-5" />
                Search
              </button>
            </div>

            {/* Refresh Button */}
            <button
              className="btn btn-outline gap-2"
              onClick={handleFetchCatalogs}
              disabled={fetchingCatalogs}
            >
              <RefreshCw
                className={`w-4 h-4 ${fetchingCatalogs ? 'animate-spin' : ''}`}
              />
              Refresh Network
            </button>
          </div>

          {/* Stats */}
          <div className="flex gap-4 mt-2 text-sm text-base-content/60">
            <span className="flex items-center gap-1">
              <Server className="w-4 h-4" />
              {relays.length} relays connected
            </span>
            <span>•</span>
            <span>{allTorrents.length} torrents indexed</span>
          </div>
        </div>
      </div>

      {/* Results */}
      {displayTorrents.length === 0 ? (
        <div className="card bg-base-100 shadow">
          <div className="card-body items-center text-center py-12">
            <SearchIcon className="w-16 h-16 text-base-content/20" />
            <h3 className="text-xl font-semibold mt-4">
              {query ? 'No Results Found' : 'Search the Network'}
            </h3>
            <p className="text-base-content/60">
              {query
                ? 'Try different keywords or refresh the network catalog'
                : 'Enter a search term or click "Refresh Network" to load available torrents'}
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
                  <th>Files</th>
                  <th>Shared By</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {displayTorrents.map((torrent) => (
                  <tr key={torrent.infoHash} className="hover">
                    <td>
                      <div className="max-w-md">
                        <p className="font-medium truncate">{torrent.name}</p>
                        <p className="text-xs text-base-content/50 truncate">
                          {torrent.infoHash}
                        </p>
                      </div>
                    </td>
                    <td className="text-sm">{formatBytes(torrent.size)}</td>
                    <td className="text-sm">{torrent.files}</td>
                    <td>
                      <span className="badge badge-ghost badge-sm">
                        {torrent.relayUrl
                          ? new URL(torrent.relayUrl).hostname
                          : torrent.sharedBy ? torrent.sharedBy.slice(0, 8) + '...' : 'Unknown'}
                      </span>
                    </td>
                    <td>
                      <button
                        className="btn btn-primary btn-sm gap-1"
                        onClick={() => handleDownload(torrent)}
                        disabled={downloading.has(torrent.infoHash)}
                      >
                        {downloading.has(torrent.infoHash) ? (
                          <span className="loading loading-spinner loading-xs"></span>
                        ) : (
                          <Download className="w-4 h-4" />
                        )}
                        Download
                      </button>
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
