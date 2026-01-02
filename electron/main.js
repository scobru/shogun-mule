import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// WebTorrent - lazy loaded because it's ESM
let WebTorrent = null;
let torrentClient = null;
const STATE_FILE = path.join(app.getPath('userData'), 'torrents.json');
let sharedFolder = null;
let downloadPath = app.getPath('downloads');
const pausedTorrents = new Set();
async function loadWebTorrent() {
    if (!WebTorrent) {
        const module = await import('webtorrent');
        console.log('[Main] WebTorrent module imported. Keys:', Object.keys(module));
        WebTorrent = module.default || module;
        console.log('[Main] WebTorrent class:', WebTorrent);
    }
    return WebTorrent;
}
// Map to track which torrents were seeded with their original file paths
const seededTorrentPaths = new Map();
// Map to track original magnet URIs for better restoration
const magnetRegistry = new Map();
let isSaving = false;
async function saveState() {
    if (!torrentClient || isSaving)
        return;
    isSaving = true;
    try {
        const torrents = torrentClient.torrents
            .filter((t) => {
            if (!t.infoHash) {
                console.warn('[Main] Skipping save for torrent with missing infoHash');
                return false;
            }
            return true;
        })
            .map((t) => {
            const seedPaths = seededTorrentPaths.get(t.infoHash);
            // Prefer original magnet from registry, fallback to client's
            const magnetURI = magnetRegistry.get(t.infoHash) || t.magnetURI;
            return {
                infoHash: t.infoHash,
                magnetURI: magnetURI,
                path: t.path,
                paused: pausedTorrents.has(t.infoHash),
                isSeeded: !!seedPaths,
                seedFilePaths: seedPaths || null
            };
        });
        const state = {
            torrents,
            sharedFolder,
            downloadPath
        };
        console.log(`[Main] Saving state to ${STATE_FILE}`);
        console.log(`[Main] State content summary: ${JSON.stringify({ ...state, torrents: torrents.map((t) => ({ infoHash: t.infoHash, hasMagnet: !!t.magnetURI })) })}`);
        await fs.writeFile(STATE_FILE, JSON.stringify(state, null, 2));
        console.log(`[Main] State saved successfully.`);
    }
    catch (err) {
        console.error('Failed to save torrent state:', err);
    }
    finally {
        isSaving = false;
    }
}
async function loadState() {
    try {
        console.log(`[Main] Loading state from ${STATE_FILE}`);
        const data = await fs.readFile(STATE_FILE, 'utf8');
        console.log(`[Main] State file content length: ${data.length}`);
        const state = JSON.parse(data);
        let torrents = [];
        if (Array.isArray(state)) {
            torrents = state;
            console.log('[Main] Loaded legacy state format (array)');
        }
        else {
            torrents = state.torrents || [];
            sharedFolder = state.sharedFolder || null;
            downloadPath = state.downloadPath || app.getPath('downloads');
            console.log(`[Main] Loaded state: ${torrents.length} torrents, sharedFolder: ${sharedFolder}, downloadPath: ${downloadPath}`);
        }
        console.log(`Loading ${torrents.length} torrents from state...`);
        for (const t of torrents) {
            // Restore magnet registry
            if (t.magnetURI) {
                magnetRegistry.set(t.infoHash, t.magnetURI);
            }
            else {
                console.warn(`[Main] Warning: Torrent ${t.infoHash} has no magnetURI in state!`);
            }
            if (t.infoHash && !torrentClient.get(t.infoHash)) {
                try {
                    if (t.isSeeded && t.seedFilePaths && t.seedFilePaths.length > 0) {
                        // Re-seed the original files
                        console.log(`[Main] Re-seeding torrent: ${t.infoHash} from files:`, t.seedFilePaths);
                        torrentClient.seed(t.seedFilePaths, (torrent) => {
                            if (torrent) {
                                seededTorrentPaths.set(torrent.infoHash, t.seedFilePaths);
                                console.log(`[Main] Re-seeded: ${torrent.name} (${torrent.infoHash})`);
                                if (t.paused) {
                                    pausedTorrents.add(torrent.infoHash);
                                    if (torrent.pieces) {
                                        torrent.deselect(0, torrent.pieces.length - 1, 0);
                                    }
                                }
                            }
                        });
                    }
                    else {
                        // Add as a download
                        console.log(`[Main] Re-adding torrent: ${t.infoHash}`);
                        if (!t.magnetURI) {
                            console.error(`[Main] Cannot re-add torrent ${t.infoHash}: Missing magnetURI`);
                            continue;
                        }
                        // Add validation for magnetURI format
                        if (!t.magnetURI.startsWith('magnet:?')) {
                            console.error(`[Main] Invalid magnet URI for ${t.infoHash}: ${t.magnetURI}`);
                            continue;
                        }
                        const torrent = torrentClient.add(t.magnetURI, { path: t.path });
                        if (t.paused) {
                            pausedTorrents.add(t.infoHash);
                            torrent.on('ready', () => {
                                torrent.deselect(0, torrent.pieces.length - 1, 0);
                            });
                        }
                    }
                }
                catch (err) {
                    console.error(`[Main] Failed to restore torrent ${t.infoHash}:`, err);
                }
            }
            else {
                console.log(`[Main] Torrent ${t.infoHash} already exists in client (skipped restoration)`);
            }
        }
        if (sharedFolder) {
            console.log(`[Main] Resuming shared folder: ${sharedFolder}`);
            scanAndSeed(sharedFolder);
        }
    }
    catch (err) {
        if (err.code !== 'ENOENT') {
            console.error('Failed to load torrent state:', err);
        }
        else {
            console.log('[Main] No previous state file found.');
        }
    }
}
let mainWindow = null;
const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        minWidth: 900,
        minHeight: 600,
        webPreferences: {
            preload: path.join(__dirname, 'preload.cjs'),
            nodeIntegration: false,
            contextIsolation: true
        },
        backgroundColor: '#1d232a'
    });
    if (isDev) {
        mainWindow.loadURL('http://localhost:5173');
        mainWindow.webContents.openDevTools();
    }
    else {
        mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
    }
    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        shell.openExternal(url);
        return { action: 'deny' };
    });
    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}
async function initTorrentClient() {
    if (torrentClient)
        return;
    const WT = await loadWebTorrent();
    torrentClient = new WT();
    torrentClient.on('error', (err) => {
        console.error('WebTorrent error:', err);
    });
    await loadState();
}
function serializeTorrent(torrent) {
    // For seeded torrents, use the original file path from seededTorrentPaths
    const seedPaths = seededTorrentPaths.get(torrent.infoHash);
    let torrentPath = null;
    if (seedPaths && seedPaths.length > 0) {
        // Use the first file's directory for seeded torrents
        torrentPath = seedPaths[0];
    }
    else if (torrent.path && torrent.name) {
        // For downloaded torrents, construct the path
        torrentPath = path.join(torrent.path, torrent.name);
    }
    else if (torrent.path) {
        torrentPath = torrent.path;
    }
    return {
        infoHash: torrent.infoHash,
        magnetURI: torrent.magnetURI,
        name: torrent.name || 'Unknown',
        progress: torrent.progress,
        downloadSpeed: torrent.downloadSpeed || 0,
        uploadSpeed: torrent.uploadSpeed || 0,
        numPeers: torrent.numPeers,
        length: torrent.length || 0,
        downloaded: torrent.downloaded,
        uploaded: torrent.uploaded,
        paused: pausedTorrents.has(torrent.infoHash),
        done: torrent.done,
        path: torrentPath,
        files: torrent.files?.map((f) => ({
            name: f.name,
            path: f.path,
            length: f.length,
            progress: f.progress
        })) || []
    };
}
app.whenReady().then(async () => {
    await initTorrentClient();
    createWindow();
    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});
let isQuitting = false;
app.on('before-quit', (e) => {
    if (isQuitting)
        return;
    e.preventDefault();
    isQuitting = true;
    if (torrentClient) {
        console.log('[Main] Saving state before quit...');
        saveState().finally(() => {
            console.log('[Main] State saved, destroying client...');
            torrentClient.destroy(() => {
                console.log('[Main] Client destroyed, quitting...');
                app.quit();
            });
        });
    }
    else {
        app.quit();
    }
});
// ============ IPC Handlers ============
ipcMain.handle('select-folder', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
        properties: ['openDirectory']
    });
    return result.canceled ? null : result.filePaths[0];
});
ipcMain.handle('select-files', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
        properties: ['openFile', 'multiSelections']
    });
    return result.canceled ? [] : result.filePaths;
});
ipcMain.handle('get-app-path', () => app.getPath('userData'));
ipcMain.handle('get-downloads-path', () => downloadPath);
ipcMain.handle('torrent:set-download-path', (_event, path) => {
    downloadPath = path;
    saveState();
});
ipcMain.handle('torrent:get-share-path', () => sharedFolder);
ipcMain.handle('torrent:get-all', () => {
    if (!torrentClient)
        return [];
    const torrents = torrentClient.torrents.map((t) => {
        try {
            return serializeTorrent(t);
        }
        catch (e) {
            console.error('[IPC] Serialization error for torrent:', t.infoHash, e);
            return null;
        }
    }).filter((t) => t !== null);
    console.log(`[IPC] Sending ${torrents.length} torrents to renderer. InfoHashes: ${torrents.map((t) => t.infoHash).join(', ')}`);
    // console.log('[IPC] Full payload sample:', JSON.stringify(torrents[0]))
    return torrents;
});
ipcMain.handle('torrent:get-status', () => {
    if (!torrentClient) {
        return { active: 0, downloading: 0, seeding: 0, downloadSpeed: 0, uploadSpeed: 0 };
    }
    const torrents = torrentClient.torrents;
    return {
        active: torrents.length,
        downloading: torrents.filter((t) => !t.done && !pausedTorrents.has(t.infoHash)).length,
        seeding: torrents.filter((t) => t.done && !pausedTorrents.has(t.infoHash)).length,
        downloadSpeed: torrentClient.downloadSpeed,
        uploadSpeed: torrentClient.uploadSpeed
    };
});
ipcMain.handle('torrent:add', async (_event, magnetURI, downloadPath) => {
    console.log(`[IPC] Adding torrent: ${magnetURI.slice(0, 40)}...`);
    if (!torrentClient)
        throw new Error('Torrent client not initialized');
    const existing = torrentClient.get(magnetURI);
    if (existing) {
        if (existing.infoHash) {
            console.log('[IPC] Torrent already exists');
            return serializeTorrent(existing);
        }
        else {
            console.log('[IPC] Found invalid existing torrent (no infoHash). Removing...');
            torrentClient.remove(magnetURI, { destroyStore: false }, (err) => {
                if (err)
                    console.error('[IPC] Failed to remove invalid torrent:', err);
            });
            // Continue to add new
        }
    }
    const opts = downloadPath ? { path: downloadPath } : {};
    console.log(`[IPC] calling torrentClient.add with magnet: ${magnetURI}`);
    const torrent = torrentClient.add(magnetURI, opts);
    // Store original magnet URI immediately
    if (torrent.infoHash) {
        magnetRegistry.set(torrent.infoHash, magnetURI);
    }
    console.log(`[IPC] Torrent object returned type:`, typeof torrent);
    console.log(`[IPC] Torrent object keys:`, Object.keys(torrent || {}));
    console.log(`[IPC] Torrent infoHash:`, torrent?.infoHash);
    console.log(`[IPC] Torrent magnetURI:`, torrent?.magnetURI);
    // Save state immediately only if we have a valid infoHash
    if (torrent.infoHash) {
        saveState();
    }
    else {
        console.log('[IPC] Torrent added but missing infoHash, waiting for metadata to save state...');
    }
    // Update state when metadata is ready (name, files etc)
    torrent.on('ready', () => {
        console.log('[IPC] Torrent metadata ready:', torrent.name);
        if (torrent.infoHash) {
            magnetRegistry.set(torrent.infoHash, magnetURI);
        }
        saveState();
        // Optional: could send an event to renderer here to update UI
    });
    torrent.on('error', (err) => {
        console.error('[IPC] Torrent error:', err);
    });
    // Start downloading immediately (default behavior of add)
    return serializeTorrent(torrent);
});
ipcMain.handle('torrent:create', async (_event, filePaths) => {
    if (!torrentClient)
        throw new Error('Torrent client not initialized');
    console.log(`[IPC] Creating torrent from files:`, filePaths);
    return new Promise((resolve) => {
        torrentClient.seed(filePaths, (torrent) => {
            // Store the original file paths so we can re-seed on restart
            seededTorrentPaths.set(torrent.infoHash, filePaths);
            console.log(`[IPC] Torrent created: ${torrent.name} (${torrent.infoHash})`);
            saveState();
            resolve(serializeTorrent(torrent));
        });
    });
});
ipcMain.handle('torrent:pause', (_event, infoHash) => {
    const torrent = torrentClient?.get(infoHash);
    if (torrent) {
        if (torrent.pieces) {
            torrent.deselect(0, torrent.pieces.length - 1, 0);
        }
        pausedTorrents.add(infoHash);
        console.log(`[IPC] Torrent paused: ${infoHash}`);
    }
});
ipcMain.handle('torrent:resume', (_event, infoHash) => {
    const torrent = torrentClient?.get(infoHash);
    if (torrent) {
        if (torrent.pieces) {
            torrent.select(0, torrent.pieces.length - 1, 0);
        }
        pausedTorrents.delete(infoHash);
        console.log(`[IPC] Torrent resumed: ${infoHash}`);
    }
});
ipcMain.handle('torrent:remove', async (_event, infoHash, deleteFiles = false) => {
    if (!torrentClient)
        return;
    // Clean up seeded torrents map
    seededTorrentPaths.delete(infoHash);
    // Don't wait for cleanup, just trigger it and return
    torrentClient.remove(infoHash, { destroyStore: deleteFiles }, (err) => {
        if (err)
            console.error('Error removing torrent:', err);
        saveState();
    });
});
ipcMain.handle('shell:show-in-folder', (_event, filePath) => {
    shell.showItemInFolder(filePath);
});
ipcMain.handle('shell:open-external', (_event, url) => {
    shell.openExternal(url);
});
// Shared Folder Logic
async function scanAndSeed(folderPath) {
    try {
        const files = await getFilesRecursively(folderPath);
        console.log(`[Main] Scanning ${folderPath}, found ${files.length} files`);
        for (const file of files) {
            // Basic filter to avoid system files
            if (path.basename(file).startsWith('.'))
                continue;
            // Check if already seeded/downloading
            const existing = torrentClient.torrents.some((t) => t.files && t.files.some((f) => f.path === file));
            if (!existing) {
                console.log(`[Main] Seeding file: ${file}`);
                torrentClient.seed(file, (torrent) => {
                    // Track the seeded file path for persistence
                    seededTorrentPaths.set(torrent.infoHash, [file]);
                    console.log(`[Main] Seeded ${file}: ${torrent.infoHash}`);
                    saveState();
                });
            }
        }
    }
    catch (err) {
        console.error('[Main] Failed to scan shared folder:', err);
    }
}
async function getFilesRecursively(dir) {
    const dirents = await fs.readdir(dir, { withFileTypes: true });
    const files = await Promise.all(dirents.map((dirent) => {
        const res = path.resolve(dir, dirent.name);
        return dirent.isDirectory() ? getFilesRecursively(res) : res;
    }));
    return Array.prototype.concat(...files);
}
ipcMain.handle('torrent:set-share-path', async (_event, folderPath) => {
    console.log('[IPC] Setting share path:', folderPath);
    sharedFolder = folderPath;
    saveState();
    await scanAndSeed(folderPath);
});
