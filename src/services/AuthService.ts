import Gun from 'gun'
import 'gun/sea'
import { GUN_CONFIG, RELAY_API_URL } from '../config/constants'

export interface User {
  alias: string
  pub: string
  epub?: string
}

export interface AuthResult {
  success: boolean
  user?: User
  error?: string
}

class AuthService {
  private gun: any
  private user: any
  private currentUser: User | null = null

  constructor() {
    this.gun = Gun(GUN_CONFIG)
    this.user = this.gun.user()
    
    // Restore session if exists
    this.user.recall({ sessionStorage: true })
  }

  // Get GunDB instance for other services
  getGun() {
    return this.gun
  }

  // Get user instance
  getUser() {
    return this.user
  }

  // Get current logged in user
  getCurrentUser(): User | null {
    if (this.user.is) {
      return {
        alias: this.user.is.alias,
        pub: this.user.is.pub,
        epub: this.user.is.epub
      }
    }
    return this.currentUser
  }

  // Check if user is authenticated
  isAuthenticated(): boolean {
    return !!this.user.is
  }

  // Register a new user
  // Register a new user via Relay API
  async register(username: string, password: string): Promise<AuthResult> {
    try {
      const response = await fetch(`${RELAY_API_URL}/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ username, password })
      })

      const data = await response.json()

      if (!data.success) {
        return { success: false, error: data.error || 'Registration failed' }
      }

      // If server-side registration checks out, log in locally (which generates the same keys)
      return this.login(username, password)

    } catch (error: any) {
      console.error('Registration error:', error)
      return { success: false, error: error.message || 'Network error during registration' }
    }
  }

  // Login with username and password
  async login(username: string, password: string): Promise<AuthResult> {
    return new Promise((resolve) => {
      this.user.auth(username, password, (ack: any) => {
        if (ack.err) {
          resolve({ success: false, error: ack.err })
        } else {
          this.currentUser = {
            alias: username,
            pub: this.user.is.pub,
            epub: this.user.is.epub
          }
          resolve({ success: true, user: this.currentUser })
        }
      })
    })
  }

  // Logout
  logout(): void {
    this.user.leave()
    this.currentUser = null
  }

  // Get user's public key
  getPubKey(): string | null {
    return this.user.is?.pub || null
  }

  // Get user's encryption public key
  getEPubKey(): string | null {
    return this.user.is?.epub || null
  }

  // Get SEA (Security, Encryption, & Authorization) for encryption operations
  getSEA() {
    return Gun.SEA
  }
}

// Singleton instance
export const authService = new AuthService()
