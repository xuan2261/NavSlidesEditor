// Must be set before app is imported
process.env.ELECTRON_DISABLE_SANDBOX = '1'

const { app, BrowserWindow, shell, dialog, Menu, ipcMain, safeStorage } = require('electron')
const path = require('path')
const fs = require('fs')

app.commandLine.appendSwitch('no-sandbox')

// Remove default menu bar (File, Edit, View, Window, Help)
Menu.setApplicationMenu(null)

const PORT = 3002
let mainWindow
let serverInstance

// ─── Secure Credential Storage ──────────────────────────────────────────────
const credentialsPath = () => path.join(app.getPath('userData'), 'credentials.enc.json')

function readCredentials() {
  try {
    const raw = fs.readFileSync(credentialsPath(), 'utf8')
    return JSON.parse(raw)
  } catch {
    return {}
  }
}

function writeCredentials(creds) {
  fs.writeFileSync(credentialsPath(), JSON.stringify(creds, null, 2), 'utf8')
}

ipcMain.handle('is-secure-storage-available', () => {
  return safeStorage.isEncryptionAvailable()
})

ipcMain.handle('save-credential', (_event, key, value) => {
  try {
    if (!safeStorage.isEncryptionAvailable()) return false
    const creds = readCredentials()
    const encrypted = safeStorage.encryptString(value)
    creds[key] = encrypted.toString('base64')
    writeCredentials(creds)
    return true
  } catch (err) {
    console.error('Failed to save credential:', err)
    return false
  }
})

ipcMain.handle('get-credential', (_event, key) => {
  try {
    if (!safeStorage.isEncryptionAvailable()) return null
    const creds = readCredentials()
    if (!creds[key]) return null
    const encrypted = Buffer.from(creds[key], 'base64')
    return safeStorage.decryptString(encrypted)
  } catch (err) {
    console.error('Failed to read credential:', err)
    return null
  }
})

ipcMain.handle('delete-credential', (_event, key) => {
  try {
    const creds = readCredentials()
    delete creds[key]
    writeCredentials(creds)
    return true
  } catch (err) {
    console.error('Failed to delete credential:', err)
    return false
  }
})

function getResourcePath(...parts) {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, ...parts)
  }
  return path.join(__dirname, '..', ...parts)
}

function getIconPath() {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'build', 'icon.png')
  }
  return path.join(__dirname, '..', 'build', 'icon.png')
}

async function startBackend() {
  const userData = app.getPath('userData')
  const dataDir = path.join(userData, 'data')
  const uploadsDir = path.join(userData, 'uploads')

  // Set env vars before requiring the server
  process.env.SLIDES_DATA_DIR = dataDir
  process.env.SLIDES_UPLOADS_DIR = uploadsDir
  process.env.NODE_ENV = 'production'
  process.env.PORT = String(PORT)

  const serverPath = getResourcePath('server', 'index.js')
  const { startServer } = require(serverPath)
  serverInstance = await startServer(PORT)

  console.log(`Backend started on port ${PORT}`)
  console.log(`Data: ${dataDir}`)
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 600,
    title: 'NavSlides Editor',
    icon: getIconPath(),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  })

  mainWindow.loadURL(`http://localhost:${PORT}`)

  // Open external links in the default browser, allow new windows for present mode
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('blob:') || url.startsWith(`http://localhost:${PORT}`)) {
      return { action: 'allow' }
    }
    if (url.startsWith('http')) {
      shell.openExternal(url)
      return { action: 'deny' }
    }
    return { action: 'allow' }
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

app.whenReady().then(async () => {
  try {
    await startBackend()
    createWindow()
  } catch (err) {
    dialog.showErrorBox('Startup Error', `Failed to start: ${err.message}`)
    app.quit()
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', () => {
  if (serverInstance) {
    serverInstance.close()
  }
})
