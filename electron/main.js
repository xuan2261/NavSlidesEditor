const { app, BrowserWindow, shell, dialog, Menu } = require('electron')
const path = require('path')
const { isTrustedAppUrl, isExternalHttpUrl } = require('./navigation-policy')

// Remove default menu bar (File, Edit, View, Window, Help)
Menu.setApplicationMenu(null)

const PORT = 3002
let mainWindow
let serverInstance
let stopBackend


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
  const { startServer, stopServer } = require(serverPath)
  serverInstance = await startServer(PORT, { host: '127.0.0.1' })
  stopBackend = () => stopServer(serverInstance)

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
      sandbox: true,
    },
  })

  const APP_ORIGIN = `http://127.0.0.1:${PORT}`
  mainWindow.loadURL(APP_ORIGIN)

  // Keep app windows on the exact parsed origin. Prefix checks are unsafe:
  // URLs with userinfo or lookalike hosts can start with APP_ORIGIN while
  // resolving to a different origin.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (isTrustedAppUrl(url, APP_ORIGIN)) return { action: 'allow' }
    if (isExternalHttpUrl(url, APP_ORIGIN)) shell.openExternal(url)
    return { action: 'deny' }
  })

  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (isTrustedAppUrl(url, APP_ORIGIN)) return
    event.preventDefault()
    if (isExternalHttpUrl(url, APP_ORIGIN)) shell.openExternal(url)
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

// Quitting must wait for the backend to release the package store writer lock,
// otherwise the next launch finds the store locked by a process that is gone.
let quitting = false
app.on('before-quit', (event) => {
  if (quitting || !stopBackend) return
  quitting = true
  event.preventDefault()
  stopBackend().catch(() => {}).then(() => app.quit())
})
