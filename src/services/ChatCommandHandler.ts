// ChatCommandHandler - Local command processing for chat
// Handles /help, /search, /list, /status commands

import { RELAY_API_URL } from '../config/constants'

export interface CommandResult {
  handled: boolean
  response?: string
  isLocal?: boolean
}

interface Command {
  name: string
  description: string
  usage: string
  execute: (args: string[]) => Promise<string>
}

class ChatCommandHandler {
  private commands: Map<string, Command> = new Map()

  constructor() {
    this.registerCommands()
  }

  private registerCommands() {
    // /help
    this.register({
      name: 'help',
      description: 'List available commands',
      usage: '/help',
      execute: async () => {
        let response = '🤖 **Shogun Mule ChatOps**\n\nAvailable commands:\n'
        for (const cmd of this.commands.values()) {
          response += `- \`/${cmd.name}\`: ${cmd.description}\n`
        }
        return response
      }
    })

    // /status
    this.register({
      name: 'status',
      description: 'Get local torrent status',
      usage: '/status',
      execute: async () => {
        try {
          // Get status from electron main process via IPC
          const status = await (window as any).electronAPI?.getTorrentStatus?.()
          
          if (!status) {
            return '📊 **Status**: Unable to fetch local status'
          }

          return `📊 **Local Status**\n` +
                 `Active Torrents: ${status.activeTorrents || 0}\n` +
                 `Download: ${((status.downloadSpeed || 0) / 1024 / 1024).toFixed(2)} MB/s\n` +
                 `Upload: ${((status.uploadSpeed || 0) / 1024 / 1024).toFixed(2)} MB/s`
        } catch (err) {
          return '📊 **Status**: Error fetching status'
        }
      }
    })

    // /search <query>
    this.register({
      name: 'search',
      description: 'Search global torrent registry',
      usage: '/search <query>',
      execute: async (args) => {
        if (args.length === 0) {
          return '❌ Usage: /search <query>'
        }

        const query = args.join(' ')
        
        try {
          const response = await fetch(`${RELAY_API_URL}/torrents/registry/search?q=${encodeURIComponent(query)}&limit=10`)
          const data = await response.json()

          if (!data.success || !data.results || data.results.length === 0) {
            return `🔍 No results found for "${query}"`
          }

          let result = `🔍 **Search Results for "${query}"**\n`
          data.results.forEach((r: any, i: number) => {
            const size = ((r.size || 0) / 1024 / 1024).toFixed(2)
            result += `\n${i + 1}. **${r.name}** (${size} MB)`
          })

          return result
        } catch (err) {
          return `❌ Search failed: ${(err as Error).message}`
        }
      }
    })

    // /list [limit]
    this.register({
      name: 'list',
      description: 'List all torrents in global registry',
      usage: '/list [limit]',
      execute: async (args) => {
        const limit = parseInt(args[0]) || 10
        
        try {
          const response = await fetch(`${RELAY_API_URL}/torrents/registry/browse?limit=${limit}`)
          const data = await response.json()

          if (!data.success || !data.results || data.results.length === 0) {
            return '📂 No torrents found in the global registry'
          }

          let result = `📂 **Global Torrent Registry** (${data.results.length} results)\n`
          data.results.forEach((r: any, i: number) => {
            const size = ((r.size || 0) / 1024 / 1024).toFixed(2)
            result += `\n${i + 1}. **${r.name}** (${size} MB)`
          })

          return result
        } catch (err) {
          return `❌ Failed to fetch registry: ${(err as Error).message}`
        }
      }
    })
  }

  private register(command: Command) {
    this.commands.set(command.name, command)
  }

  /**
   * Process a message and check if it's a command
   * Returns handled: true if it was a command
   */
  async processMessage(message: string): Promise<CommandResult> {
    if (!message.startsWith('/')) {
      return { handled: false }
    }

    const parts = message.slice(1).trim().split(/\s+/)
    const commandName = parts[0].toLowerCase()
    const args = parts.slice(1)

    const command = this.commands.get(commandName)
    if (!command) {
      return {
        handled: true,
        response: `❓ Unknown command "/${commandName}". Type \`/help\` for list.`,
        isLocal: true
      }
    }

    try {
      const response = await command.execute(args)
      return {
        handled: true,
        response,
        isLocal: true
      }
    } catch (err) {
      return {
        handled: true,
        response: `❌ Error: ${(err as Error).message}`,
        isLocal: true
      }
    }
  }
}

export const chatCommandHandler = new ChatCommandHandler()
