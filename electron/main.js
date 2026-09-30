const { app, BrowserWindow, shell, dialog, Menu, session } = require('electron')
const path = require('path')
const { isTrustedAppUrl, isTrustedPopupUrl, isExternalHttpUrl } = require('./navigation-policy')
const { acquireSingleInstance, focusExistingWindow } = require('./single-instance')
const { withDesktopCsp } = require('./content-security-policy')

const PORT = 3002
const APP_ORIGIN = `http://127.0.0.1:${PORT}`
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

function confineWindow(window, appOrigin) {
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (isTrustedPopupUrl(url, appOrigin)) return { action: 'allow' }
    if (isExternalHttpUrl(url, appOrigin)) shell.openExternal(url)
    return { action: 'deny' }
  })

  window.webContents.on('will-navigate', (event, url) => {
    if (isTrustedAppUrl(url, appOrigin)) return
    event.preventDefault()
    if (isExternalHttpUrl(url, appOrigin)) shell.openExternal(url)
  })

  // Electron does not apply the opener's navigation handlers to child windows.
  window.webContents.on('did-create-window', (child) => confineWindow(child, appOrigin))
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

  confineWindow(mainWindow, APP_ORIGIN)
  mainWindow.loadURL(APP_ORIGIN)

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

const hasSingleInstanceLock = acquireSingleInstance({
  app,
  onSecondInstance: () => focusExistingWindow(mainWindow),
})

if (!hasSingleInstanceLock) {
  app.quit()
} else {
  // Remove default menu bar (File, Edit, View, Window, Help)
  Menu.setApplicationMenu(null)

  app.whenReady().then(async () => {
    session.defaultSession.webRequest.onHeadersReceived(
      { urls: [`${APP_ORIGIN}/*`] },
      (details, callback) => callback({ responseHeaders: withDesktopCsp(details.responseHeaders) })
    )
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

  // Wait for the backend to release the package-store writer lock.
  let quitting = false
  app.on('before-quit', (event) => {
    if (quitting || !stopBackend) return
    quitting = true
    event.preventDefault()
    stopBackend().catch(() => {}).then(() => app.quit())
  })
}