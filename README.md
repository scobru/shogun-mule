# ShogunMule

Desktop P2P file sharing application for the Shogun network. Similar to eMule/LimeWire but connecting to the Shogun relay network.

## Features

- 🔐 **GunDB Authentication** - Register/login with username and password
- ⬇️ **Download Torrents** - Add magnet links or search the network
- ⬆️ **Share Files** - Create torrents from local files and seed them
- 🔍 **Network Search** - Search across all Shogun relays
- 🖥️ **Cross-Platform** - Windows, macOS, and Linux

## Development

```bash
# Install dependencies
npm install

# Run in development mode
npm run dev
```

## Build

```bash
# Build for current platform
npm run build

# Build for specific platforms
npm run build:win
npm run build:mac
npm run build:linux
```

## Technology Stack

- **Electron** - Desktop application framework
- **React** - UI library
- **WebTorrent** - BitTorrent in JavaScript
- **GunDB** - Decentralized database
- **TailwindCSS + DaisyUI** - Styling

## Network

This app connects to the same Shogun relay network as the shogun-relay servers. It discovers peers and torrents through GunDB and fetches catalogs from relay HTTP endpoints.
