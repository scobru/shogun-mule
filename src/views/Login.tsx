import { useState } from 'react'
import { authService } from '../services/AuthService'
import { Download, Upload, Shield } from 'lucide-react'

interface LoginProps {
  onLogin: () => void
}

export default function Login({ onLogin }: LoginProps) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [isRegistering, setIsRegistering] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const result = isRegistering
        ? await authService.register(username, password)
        : await authService.login(username, password)

      if (result.success) {
        onLogin()
      } else {
        setError(result.error || 'Authentication failed')
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-base-300 via-base-200 to-base-300 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo and Title */}
        <div className="text-center mb-8">
          <div className="flex justify-center gap-2 mb-4">
            <div className="w-16 h-16 bg-primary/20 rounded-2xl flex items-center justify-center">
              <Download className="w-8 h-8 text-primary" />
            </div>
            <div className="w-16 h-16 bg-secondary/20 rounded-2xl flex items-center justify-center">
              <Upload className="w-8 h-8 text-secondary" />
            </div>
          </div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
            ShogunMule
          </h1>
          <p className="text-base-content/60 mt-2">
            P2P File Sharing for the Shogun Network
          </p>
        </div>

        {/* Login Card */}
        <div className="card bg-base-100 shadow-xl">
          <div className="card-body">
            <h2 className="card-title justify-center text-xl mb-2">
              {isRegistering ? 'Create Account' : 'Welcome Back'}
            </h2>

            {error && (
              <div className="alert alert-error py-2">
                <span className="text-sm">{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="form-control">
                <label className="label">
                  <span className="label-text">Username</span>
                </label>
                <input
                  type="text"
                  placeholder="Enter your username"
                  className="input input-bordered w-full"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  minLength={3}
                  disabled={loading}
                />
              </div>

              <div className="form-control">
                <label className="label">
                  <span className="label-text">Password</span>
                </label>
                <input
                  type="password"
                  placeholder="Enter your password"
                  className="input input-bordered w-full"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  disabled={loading}
                />
              </div>

              <button
                type="submit"
                className="btn btn-primary w-full"
                disabled={loading}
              >
                {loading ? (
                  <span className="loading loading-spinner"></span>
                ) : isRegistering ? (
                  'Create Account'
                ) : (
                  'Login'
                )}
              </button>
            </form>

            <div className="divider text-xs">OR</div>

            <button
              className="btn btn-ghost btn-sm"
              onClick={() => {
                setIsRegistering(!isRegistering)
                setError('')
              }}
              disabled={loading}
            >
              {isRegistering
                ? 'Already have an account? Login'
                : "Don't have an account? Register"}
            </button>

            {/* Security note */}
            <div className="flex items-center gap-2 text-xs text-base-content/50 mt-4 justify-center">
              <Shield className="w-4 h-4" />
              <span>Encrypted with GunDB SEA</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
