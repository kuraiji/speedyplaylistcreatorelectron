import { app, BrowserWindow, shell, ipcMain, dialog } from 'electron'
import { release } from 'os'
import { join } from 'path'
import { PlaylistManager } from "./playlist-manager";
import './samples/electron-store'

// Disable GPU Acceleration for Windows 7
if (release().startsWith('6.1')) app.disableHardwareAcceleration()

// Set application name for Windows 10+ notifications
if (process.platform === 'win32') app.setAppUserModelId(app.getName())

if (!app.requestSingleInstanceLock()) {
  app.quit()
  process.exit(0)
}

let win: BrowserWindow | null = null

async function createWindow() {
  win = new BrowserWindow({
    title: 'Speedy Playlist Creator',
    width: 1280,
    height: 720,
    resizable: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.cjs')
    },
  })

  if (app.isPackaged) {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  } else {
    // 🚧 Use ['ENV_NAME'] avoid vite:define plugin
    const url = `http://${process.env['VITE_DEV_SERVER_HOST']}:${process.env['VITE_DEV_SERVER_PORT']}`

    win.loadURL(url)
    win.webContents.openDevTools()
  }

  // Test active push message to Renderer-process
  win.webContents.on('did-finish-load', () => {
    win?.webContents.send('main-process-message', (new Date).toLocaleString())
  })

  // Make all links open with the browser, not with the application
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https:')) shell.openExternal(url)
    return { action: 'deny' }
  })

  win.setMenu(null);
}

app.whenReady().then(createWindow)

app.on('window-all-closed', () => {
  win = null
  if (process.platform !== 'darwin') app.quit()
})

app.on('second-instance', () => {
  if (win) {
    // Focus on the main window if the user tried to open another
    if (win.isMinimized()) win.restore()
    win.focus()
  }
})

app.on('activate', () => {
  const allWindows = BrowserWindow.getAllWindows()
  if (allWindows.length) {
    allWindows[0].focus()
  } else {
    createWindow()
  }
})

//Playlist Manager Initialization
const manager = new PlaylistManager.Manager();

//Electron API Calls
ipcMain.handle('dialog:openFolder', async() => {
  win?.setFocusable(false);
  let res = await dialog.showOpenDialog(win!,{
    properties: ['openDirectory'],
    title: "Select the top-level directory..."
  });
  win?.setFocusable(true);
  return res.filePaths[0];
})
ipcMain.handle('dialog:openFile', async() => {
  win?.setFocusable(false);
  let res = await dialog.showOpenDialog(win!,{
    title: "Select your playlist file...",
    defaultPath: manager.baseDir,
    filters: [{name: "M3U/M3U8 Multimedia File", extensions: ["m3u", "m3u8"]}]
  });
  win?.setFocusable(true);
  return res.filePaths[0];
})
ipcMain.handle('dialog:saveFile', async() => {
  win?.setFocusable(false);
  let res = await dialog.showSaveDialog(win!,{
    title: "Select where you want to save your playlist...",
    defaultPath: manager.baseDir,
    filters: [{name: "M3U/M3U8 Multimedia File", extensions: ["m3u", "m3u8"]}]
  });
  win?.setFocusable(true);
  return res.filePath;
})
ipcMain.handle('manager:findSongs', async(event, message) => {
  if(typeof message !== "string") return 0;
  return await manager.findSongs(message);
})
ipcMain.on("manager:indexSongs", async() => {
  await manager.indexSongs(win!);
})
ipcMain.handle("manager:coverArt", async(event, message) => {
  return manager.getCoverArt(message);
})
ipcMain.handle("manager:savePlaylist", async(event, playlistPath, songPaths) => {
  if(!Array.isArray(songPaths)) return;
  return await manager.savePlaylist(playlistPath, songPaths);
})
ipcMain.handle("manager:loadPlaylist", async(event, filePath) => {
  return await manager.loadPlaylist(filePath);
})