// ChatService - P2P chat with lobby and encrypted private messages
// Uses unified GUN_PATHS for consistency with relay

import { authService } from './AuthService'
import { GUN_PATHS, getGunNode } from '../config/constants'

export interface ChatMessage {
  id: string
  from: string
  fromAlias?: string
  to: string
  content: string
  timestamp: number
  encrypted: boolean
}

export interface LobbyMessage {
  id: string
  from: string
  alias: string
  text: string
  timestamp: number
}

export interface ChatContact {
  pub: string
  alias?: string
  lastSeen?: number
  type?: 'relay' | 'mule'
}

type MessageListener = (messages: ChatMessage[]) => void
type LobbyListener = (messages: LobbyMessage[]) => void

class ChatService {
  private messages: Map<string, ChatMessage[]> = new Map()
  private contacts: Map<string, ChatContact> = new Map()
  private lobbyMessages: LobbyMessage[] = []
  private messageListeners: Map<string, Set<MessageListener>> = new Map()
  private lobbyListeners: Set<LobbyListener> = new Set()
  private subscriptions: Set<string> = new Set()
  private lobbySubscribed: boolean = false

  private getChatId(userA: string, userB: string): string {
    return [userA, userB].sort().join(':')
  }

  // Subscribe to lobby messages
  subscribeToLobby(onMessage: LobbyListener): () => void {
    const gun = authService.getGun()
    if (!gun) return () => {}

    this.lobbyListeners.add(onMessage)

    if (!this.lobbySubscribed) {
      getGunNode(gun, GUN_PATHS.LOBBY).map().on((data: any, msgId: string) => {
        if (!data || !data.text) return

        const msg: LobbyMessage = {
          id: msgId,
          from: data.from,
          alias: data.alias || 'Anonymous',
          text: data.text,
          timestamp: data.timestamp || Date.now()
        }

        // Avoid duplicates
        if (!this.lobbyMessages.find(m => m.id === msg.id)) {
          this.lobbyMessages.push(msg)
          this.lobbyMessages.sort((a, b) => a.timestamp - b.timestamp)
          
          // Keep only last 100 messages
          if (this.lobbyMessages.length > 100) {
            this.lobbyMessages = this.lobbyMessages.slice(-100)
          }

          this.notifyLobbyListeners()
        }
      })

      this.lobbySubscribed = true
    }

    // Immediately send current messages
    onMessage([...this.lobbyMessages])

    return () => this.lobbyListeners.delete(onMessage)
  }

  // Send message to lobby
  sendLobbyMessage(text: string): void {
    const gun = authService.getGun()
    const user = authService.getCurrentUser()
    
    if (!gun || !user) return

    const msgId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

    getGunNode(gun, GUN_PATHS.LOBBY).get(msgId).put({
      from: user.pub,
      alias: user.alias,
      text,
      timestamp: Date.now()
    })
  }

  // Send encrypted private message
  async sendMessage(toPub: string, content: string): Promise<ChatMessage | null> {
    const gun = authService.getGun()
    const SEA = authService.getSEA()
    const user = authService.getCurrentUser()
    
    if (!gun || !SEA || !user) return null

    try {
      const recipientData = await new Promise<any>((resolve) => {
        gun.user(toPub).once((data: any) => resolve(data))
      })
      
      const recipientEpub = recipientData?.epub
      if (!recipientEpub) return null

      const userKeys = authService.getUser()?._.sea
      if (!userKeys) return null

      const secret = await SEA.secret(recipientEpub, userKeys)
      if (!secret) return null
      
      const encryptedContent = await SEA.encrypt(content, secret)

      const messageId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      const chatId = this.getChatId(user.pub, toPub)

      const message: ChatMessage = {
        id: messageId,
        from: user.pub,
        fromAlias: user.alias,
        to: toPub,
        content: encryptedContent,
        timestamp: Date.now(),
        encrypted: true
      }

      getGunNode(gun, GUN_PATHS.CHATS).get(chatId).get(messageId).put({
        from: message.from,
        fromAlias: message.fromAlias,
        to: message.to,
        content: message.content,
        timestamp: message.timestamp,
        encrypted: message.encrypted
      })

      const localMessage = { ...message, content }
      this.addLocalMessage(chatId, localMessage)

      return localMessage
    } catch (error) {
      console.error('Failed to send message:', error)
      return null
    }
  }

  subscribeToChat(otherPub: string, onMessage: MessageListener): () => void {
    const gun = authService.getGun()
    const SEA = authService.getSEA()
    const user = authService.getCurrentUser()
    
    if (!gun || !SEA || !user) return () => {}

    const chatId = this.getChatId(user.pub, otherPub)

    if (!this.messageListeners.has(chatId)) {
      this.messageListeners.set(chatId, new Set())
    }
    this.messageListeners.get(chatId)!.add(onMessage)

    if (!this.subscriptions.has(chatId)) {
      getGunNode(gun, GUN_PATHS.CHATS).get(chatId).map().on(async (data: any, messageId: string) => {
        if (!data || !data.content) return

        try {
          let content = data.content

          if (data.encrypted && (data.to === user.pub || data.from === user.pub)) {
            const otherUserPub = data.from === user.pub ? data.to : data.from
            
            const otherUserData = await new Promise<any>((resolve) => {
              gun.user(otherUserPub).once((d: any) => resolve(d))
            })
            
            if (otherUserData?.epub) {
              const userKeys = authService.getUser()?._.sea
              if (userKeys) {
                const secret = await SEA.secret(otherUserData.epub, userKeys)
                if (secret) {
                  const decrypted = await SEA.decrypt(data.content, secret)
                  if (decrypted) content = decrypted
                }
              }
            }
          }

          const message: ChatMessage = {
            id: messageId,
            from: data.from,
            fromAlias: data.fromAlias,
            to: data.to,
            content,
            timestamp: data.timestamp,
            encrypted: data.encrypted
          }

          this.addLocalMessage(chatId, message)
          this.notifyMessageListeners(chatId)
        } catch (error) {
          console.error('Failed to process message:', error)
        }
      })

      this.subscriptions.add(chatId)
    }

    return () => {
      this.messageListeners.get(chatId)?.delete(onMessage)
    }
  }

  getMessages(otherPub: string): ChatMessage[] {
    const user = authService.getCurrentUser()
    if (!user) return []
    
    const chatId = this.getChatId(user.pub, otherPub)
    return (this.messages.get(chatId) || []).sort((a, b) => a.timestamp - b.timestamp)
  }

  getLobbyMessages(): LobbyMessage[] {
    return [...this.lobbyMessages]
  }

  addContact(pub: string, alias?: string, type?: 'relay' | 'mule'): void {
    this.contacts.set(pub, { pub, alias, type })
  }

  getContacts(): ChatContact[] {
    return Array.from(this.contacts.values())
  }

  private addLocalMessage(chatId: string, message: ChatMessage): void {
    if (!this.messages.has(chatId)) {
      this.messages.set(chatId, [])
    }
    
    const messages = this.messages.get(chatId)!
    if (!messages.find(m => m.id === message.id)) {
      messages.push(message)
    }
  }

  private notifyMessageListeners(chatId: string): void {
    const messages = this.messages.get(chatId) || []
    this.messageListeners.get(chatId)?.forEach(listener => listener(messages))
  }

  private notifyLobbyListeners(): void {
    this.lobbyListeners.forEach(l => l([...this.lobbyMessages]))
  }
}

export const chatService = new ChatService()
