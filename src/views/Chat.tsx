import { useState, useEffect, useRef } from 'react'
import {
  MessageCircle,
  Send,
  Users,
  Plus,
  Globe,
  Lock,
  RefreshCw
} from 'lucide-react'
import { chatService, ChatMessage, LobbyMessage, ChatContact } from '../services/ChatService'
import { peerDiscoveryService, RelayInfo } from '../services/PeerDiscoveryService'
import { authService } from '../services/AuthService'
import { chatCommandHandler } from '../services/ChatCommandHandler'

function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

export default function Chat() {
  const [activeTab, setActiveTab] = useState<'lobby' | 'private'>('lobby')
  
  // Lobby state
  const [lobbyMessages, setLobbyMessages] = useState<LobbyMessage[]>([])
  const [lobbyInput, setLobbyInput] = useState('')
  
  // Private chat state
  const [contacts, setContacts] = useState<ChatContact[]>([])
  const [discoveredContacts, setDiscoveredContacts] = useState<RelayInfo[]>([])
  const [selectedContact, setSelectedContact] = useState<ChatContact | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [showNewChat, setShowNewChat] = useState(false)
  
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const lobbyEndRef = useRef<HTMLDivElement>(null)
  const currentUser = authService.getCurrentUser()

  // Subscribe to lobby
  useEffect(() => {
    const unsubscribe = chatService.subscribeToLobby((msgs) => {
      setLobbyMessages(msgs)
    })
    return unsubscribe
  }, [])

  // Load contacts and discovered peers/relays
  useEffect(() => {
    setContacts(chatService.getContacts())
    setDiscoveredContacts(peerDiscoveryService.getAllContacts())
    
    const unsubscribe = peerDiscoveryService.subscribe(() => {
      setDiscoveredContacts(peerDiscoveryService.getAllContacts())
    })
    
    return unsubscribe
  }, [])

  // Subscribe to private chat when selected
  useEffect(() => {
    if (!selectedContact) return

    setMessages(chatService.getMessages(selectedContact.pub))

    const unsubscribe = chatService.subscribeToChat(selectedContact.pub, (msgs) => {
      setMessages([...msgs])
    })

    return () => unsubscribe()
  }, [selectedContact])

  // Scroll effects
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    lobbyEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [lobbyMessages])

  const handleSendLobby = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!lobbyInput.trim()) return
    
    // Check if it's a command
    const result = await chatCommandHandler.processMessage(lobbyInput)
    if (result.handled && result.response) {
      // Add bot response to lobby as a local message
      const botMsg: LobbyMessage = {
        id: `bot-${Date.now()}`,
        from: 'system',
        alias: '🤖 Bot',
        text: result.response,
        timestamp: Date.now()
      }
      setLobbyMessages(prev => [...prev, botMsg])
      setLobbyInput('')
      return
    }
    
    chatService.sendLobbyMessage(lobbyInput)
    setLobbyInput('')
  }

  const handleSendPrivate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newMessage.trim() || !selectedContact) return

    // Check if it's a command
    const result = await chatCommandHandler.processMessage(newMessage)
    if (result.handled && result.response) {
      // Add bot response as a local message in private chat
      const botMsg: ChatMessage = {
        id: `bot-${Date.now()}`,
        from: 'system',
        fromAlias: '🤖 Bot',
        to: currentUser?.pub || '',
        content: result.response,
        timestamp: Date.now(),
        encrypted: false
      }
      setMessages(prev => [...prev, botMsg])
      setNewMessage('')
      return
    }

    const message = await chatService.sendMessage(selectedContact.pub, newMessage)
    if (message) {
      setMessages(prev => [...prev, message])
      setNewMessage('')
    }
  }

  const handleStartChat = (contact: RelayInfo | ChatContact) => {
    const pub = 'pub' in contact ? (contact as any).pub : (contact as any).pubKey
    const chatContact: ChatContact = {
      pub,
      alias: contact.alias,
      type: contact.type
    }
    
    chatService.addContact(chatContact.pub, chatContact.alias, chatContact.type)
    setContacts(chatService.getContacts())
    setSelectedContact(chatContact)
    setActiveTab('private')
    setShowNewChat(false)
  }

  const handleRefresh = () => {
    peerDiscoveryService.refresh()
    setDiscoveredContacts(peerDiscoveryService.getAllContacts())
  }

  return (
    <div className="flex h-[calc(100vh-120px)] gap-4">
      {/* Sidebar */}
      <div className="w-72 flex flex-col bg-base-100 rounded-box shadow">
        {/* Tabs */}
        <div className="tabs tabs-boxed bg-transparent p-2">
          <a 
            className={`tab gap-2 ${activeTab === 'lobby' ? 'tab-active' : ''}`}
            onClick={() => setActiveTab('lobby')}
          >
            <Globe className="w-4 h-4" />
            Lobby
          </a>
          <a 
            className={`tab gap-2 ${activeTab === 'private' ? 'tab-active' : ''}`}
            onClick={() => setActiveTab('private')}
          >
            <Lock className="w-4 h-4" />
            Private
          </a>
        </div>

        {activeTab === 'lobby' ? (
          <div className="flex-1 p-4">
            <h2 className="font-bold text-lg mb-2">📢 Public Lobby</h2>
            <p className="text-xs text-base-content/60 mb-4">
              Global chat room. Messages are public.
            </p>
            <div className="stats stats-vertical bg-base-200 shadow-sm w-full">
              <div className="stat py-2">
                <div className="stat-title text-xs">Online</div>
                <div className="stat-value text-lg">{discoveredContacts.length}</div>
              </div>
              <div className="stat py-2">
                <div className="stat-title text-xs">Messages</div>
                <div className="stat-value text-lg">{lobbyMessages.length}</div>
              </div>
            </div>
          </div>
        ) : (
          <>
            <div className="p-3 border-b border-base-300 flex justify-between items-center">
              <h2 className="font-bold">💬 Chats</h2>
              <button 
                className="btn btn-ghost btn-sm btn-square"
                onClick={() => setShowNewChat(true)}
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto">
              {contacts.length === 0 ? (
                <div className="p-4 text-center text-base-content/50">
                  <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No chats yet</p>
                  <button 
                    className="btn btn-sm btn-primary mt-2"
                    onClick={() => setShowNewChat(true)}
                  >
                    Start Chat
                  </button>
                </div>
              ) : (
                contacts.map(contact => (
                  <button
                    key={contact.pub}
                    className={`w-full p-3 text-left hover:bg-base-200 flex items-center gap-3 ${
                      selectedContact?.pub === contact.pub ? 'bg-base-200' : ''
                    }`}
                    onClick={() => setSelectedContact(contact)}
                  >
                    <div className="avatar placeholder">
                      <div className={`rounded-full w-10 ${
                        contact.type === 'relay' ? 'bg-secondary text-secondary-content' : 'bg-primary text-primary-content'
                      }`}>
                        <span>{(contact.alias || 'U')[0].toUpperCase()}</span>
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">
                        {contact.alias || contact.pub.substring(0, 16) + '...'}
                      </p>
                      <p className="text-xs text-base-content/50">
                        {contact.type === 'relay' ? '📡 Relay' : '👤 Peer'}
                      </p>
                    </div>
                  </button>
                ))
              )}
            </div>
          </>
        )}
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col bg-base-100 rounded-box shadow">
        {activeTab === 'lobby' ? (
          <>
            {/* Lobby Header */}
            <div className="p-4 border-b border-base-300 bg-gradient-to-r from-primary/10 to-secondary/10">
              <span className="text-lg font-bold">📢 Shogun Lobby</span>
              <div className="text-xs opacity-60">Global public chat • All messages visible to everyone</div>
            </div>

            {/* Lobby Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {lobbyMessages.length === 0 ? (
                <div className="text-center opacity-50 py-8">
                  <div className="text-4xl mb-2">🌐</div>
                  <p>No messages yet. Be the first!</p>
                </div>
              ) : (
                lobbyMessages.map(msg => (
                  <div key={msg.id} className="chat chat-start">
                    <div className="chat-header opacity-70 text-xs mb-1">
                      <span className="font-bold">{msg.alias}</span>
                      <span className="ml-2">{formatTime(msg.timestamp)}</span>
                    </div>
                    <div className="chat-bubble chat-bubble-accent max-w-xs break-words">
                      {msg.text}
                    </div>
                  </div>
                ))
              )}
              <div ref={lobbyEndRef} />
            </div>

            {/* Lobby Input */}
            <form onSubmit={handleSendLobby} className="p-4 border-t border-base-300">
              <div className="join w-full">
                <input
                  type="text"
                  placeholder="Say something to everyone..."
                  className="input input-bordered join-item flex-1"
                  value={lobbyInput}
                  onChange={(e) => setLobbyInput(e.target.value)}
                />
                <button type="submit" className="btn btn-primary join-item" disabled={!lobbyInput.trim()}>
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </form>
          </>
        ) : !selectedContact ? (
          <div className="flex-1 flex items-center justify-center text-base-content/50">
            <div className="text-center">
              <MessageCircle className="w-16 h-16 mx-auto mb-4 opacity-50" />
              <h3 className="text-xl font-semibold">Select a conversation</h3>
              <p className="text-sm">Or start a new chat with a peer/relay</p>
            </div>
          </div>
        ) : (
          <>
            {/* Private Chat Header */}
            <div className="p-4 border-b border-base-300 flex items-center gap-3">
              <div className="avatar placeholder">
                <div className={`rounded-full w-10 ${
                  selectedContact.type === 'relay' ? 'bg-secondary text-secondary-content' : 'bg-primary text-primary-content'
                }`}>
                  <span>{(selectedContact.alias || 'U')[0].toUpperCase()}</span>
                </div>
              </div>
              <div>
                <p className="font-bold">
                  {selectedContact.alias || selectedContact.pub.substring(0, 20) + '...'}
                </p>
                <p className="text-xs text-base-content/50 flex items-center gap-1">
                  <Lock className="w-3 h-3" />
                  Encrypted • {selectedContact.type === 'relay' ? 'Relay' : 'Peer'}
                </p>
              </div>
            </div>

            {/* Private Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {messages.length === 0 ? (
                <div className="text-center opacity-50 py-8">
                  <Lock className="w-8 h-8 mx-auto mb-2" />
                  <p>No messages yet. Start the conversation!</p>
                </div>
              ) : (
                messages.map(msg => (
                  <div
                    key={msg.id}
                    className={`chat ${msg.from === currentUser?.pub ? 'chat-end' : 'chat-start'}`}
                  >
                    <div className="chat-header opacity-50 text-xs mb-1">
                      {msg.from === currentUser?.pub ? 'You' : (msg.fromAlias || 'User')}
                      <time className="ml-2">{formatTime(msg.timestamp)}</time>
                    </div>
                    <div className={`chat-bubble max-w-xs break-words ${
                      msg.from === currentUser?.pub ? 'chat-bubble-primary' : ''
                    }`}>
                      {msg.content}
                    </div>
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Private Message Input */}
            <form onSubmit={handleSendPrivate} className="p-4 border-t border-base-300">
              <div className="join w-full">
                <input
                  type="text"
                  placeholder="Type an encrypted message..."
                  className="input input-bordered join-item flex-1"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                />
                <button type="submit" className="btn btn-primary join-item" disabled={!newMessage.trim()}>
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </form>
          </>
        )}
      </div>

      {/* New Chat Modal */}
      {showNewChat && (
        <div className="modal modal-open">
          <div className="modal-box">
            <h3 className="font-bold text-lg mb-4">Start New Chat</h3>
            
            <div className="flex justify-between items-center mb-3">
              <span className="text-sm opacity-60">
                {discoveredContacts.length} contacts discovered
              </span>
              <button className="btn btn-ghost btn-sm" onClick={handleRefresh}>
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>

            <div className="max-h-60 overflow-y-auto space-y-2">
              {discoveredContacts.length === 0 ? (
                <p className="opacity-50 text-center text-sm py-4">
                  No peers discovered yet. Make sure relays are running.
                </p>
              ) : (
                discoveredContacts.map(contact => (
                  <div 
                    key={contact.pubKey}
                    onClick={() => handleStartChat(contact)}
                    className="p-3 bg-base-200 rounded-lg cursor-pointer hover:bg-base-300 flex justify-between items-center group"
                  >
                    <div className="overflow-hidden">
                      <div className="font-bold text-sm flex items-center gap-2">
                        {contact.type === 'relay' ? '📡' : '👤'}
                        {contact.alias || contact.pubKey.substring(0, 16) + '...'}
                      </div>
                      <div className="text-xs font-mono opacity-60 truncate">
                        {contact.pubKey.substring(0, 32)}...
                      </div>
                    </div>
                    <button className="btn btn-xs btn-primary opacity-0 group-hover:opacity-100">
                      Chat
                    </button>
                  </div>
                ))
              )}
            </div>

            <div className="modal-action">
              <button className="btn" onClick={() => setShowNewChat(false)}>Close</button>
            </div>
          </div>
          <div className="modal-backdrop" onClick={() => setShowNewChat(false)}></div>
        </div>
      )}
    </div>
  )
}
