import { Outlet, NavLink, useLocation } from 'react-router-dom'
import {
  Download,
  Search,
  FolderOpen,
  Settings,
  LogOut,
  MessageCircle
} from 'lucide-react'
import { authService } from '../services/AuthService'

interface LayoutProps {
  onLogout: () => void
}

export default function Layout({ onLogout }: LayoutProps) {
  const location = useLocation()
  const user = authService.getCurrentUser()

  const navItems = [
    { path: '/transfers', icon: Download, label: 'Transfers' },
    { path: '/search', icon: Search, label: 'Search' },
    { path: '/library', icon: FolderOpen, label: 'Library' },
    { path: '/chat', icon: MessageCircle, label: 'Chat' },
    { path: '/settings', icon: Settings, label: 'Settings' }
  ]

  return (
    <div className="flex h-screen">
      {/* Sidebar */}
      <aside className="w-64 bg-base-200 flex flex-col">
        {/* Header - Draggable */}
        <div className="p-4 drag-region">
          <div className="flex items-center gap-3 no-drag">
            <div className="w-10 h-10 bg-gradient-to-br from-primary to-secondary rounded-xl flex items-center justify-center">
              <Download className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-lg">ShogunMule</h1>
              <p className="text-xs text-base-content/60">P2P File Sharing</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-2">
          <ul className="menu gap-1">
            {navItems.map((item) => (
              <li key={item.path}>
                <NavLink
                  to={item.path}
                  className={({ isActive }) =>
                    `flex items-center gap-3 ${isActive ? 'active' : ''}`
                  }
                >
                  <item.icon className="w-5 h-5" />
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        {/* User section */}
        <div className="p-4 border-t border-base-300">
          <div className="flex items-center gap-3">
            <div className="avatar placeholder">
              <div className="bg-neutral text-neutral-content rounded-full w-10">
                <span className="text-lg">
                  {user?.alias?.charAt(0).toUpperCase() || '?'}
                </span>
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium truncate">{user?.alias || 'Unknown'}</p>
              <p className="text-xs text-base-content/60 truncate">
                {user?.pub?.slice(0, 16)}...
              </p>
            </div>
            <button
              className="btn btn-ghost btn-sm btn-square"
              onClick={onLogout}
              title="Logout"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto bg-base-300">
        {/* Page Header - Draggable */}
        <header className="h-12 bg-base-200/50 flex items-center px-6 drag-region sticky top-0 z-10 backdrop-blur-sm">
          <h2 className="text-lg font-semibold no-drag capitalize">
            {location.pathname.slice(1) || 'Home'}
          </h2>
        </header>

        {/* Page Content */}
        <div className="p-6">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
