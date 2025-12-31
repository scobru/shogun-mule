import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { authService } from './services/AuthService'
import { torrentService } from './services/TorrentService'
import { networkService } from './services/NetworkService'
import { catalogService } from './services/CatalogService'
import { peerDiscoveryService } from './services/PeerDiscoveryService'

// Views
import Login from './views/Login'
import Layout from './components/Layout'
import Transfers from './views/Transfers'
import Search from './views/Search'
import Library from './views/Library'
import Settings from './views/Settings'
import Chat from './views/Chat'

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // Check if user is already logged in
    const checkAuth = () => {
      const authenticated = authService.isAuthenticated()
      setIsAuthenticated(authenticated)
      
      if (authenticated) {
        // Start services
        torrentService.start()
        networkService.connect()
        catalogService.subscribeToNetwork()
        catalogService.announceAsPeer()
        peerDiscoveryService.startDiscovery()
        peerDiscoveryService.announceSelf()
      }
      
      setIsLoading(false)
    }

    // Small delay to allow Gun to restore session
    setTimeout(checkAuth, 500)
  }, [])

  const handleLogin = () => {
    setIsAuthenticated(true)
    torrentService.start()
    networkService.connect()
    catalogService.subscribeToNetwork()
    catalogService.announceAsPeer()
    peerDiscoveryService.startDiscovery()
    peerDiscoveryService.announceSelf()
  }

  const handleLogout = () => {
    authService.logout()
    torrentService.stop()
    networkService.disconnect()
    setIsAuthenticated(false)
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-base-300 flex items-center justify-center">
        <span className="loading loading-spinner loading-lg text-primary"></span>
      </div>
    )
  }

  return (
    <BrowserRouter>
      <div className="min-h-screen bg-base-300" data-theme="dark">
        {!isAuthenticated ? (
          <Login onLogin={handleLogin} />
        ) : (
          <Routes>
            <Route path="/" element={<Layout onLogout={handleLogout} />}>
              <Route index element={<Navigate to="/transfers" replace />} />
              <Route path="transfers" element={<Transfers />} />
              <Route path="search" element={<Search />} />
              <Route path="library" element={<Library />} />
              <Route path="chat" element={<Chat />} />
              <Route path="settings" element={<Settings />} />
            </Route>
          </Routes>
        )}
      </div>
    </BrowserRouter>
  )
}

export default App
