import { app, BrowserWindow, ipcMain, dialog, Menu } from 'electron';
import * as path from 'path';
import * as fs from 'fs/promises';
import * as fsSync from 'fs';
import { ChildProcess, spawn } from 'child_process';
import * as readline from 'readline';
import { createApplicationMenu } from './menu';
import { autoUpdater } from 'electron-updater';

// Set application name early so menu and system dialogs show "Regne"
if (app) {
  app.name = 'Regne';
  if (typeof app.setName === 'function') {
    app.setName('Regne');
  }
}

export function getAppIconPath(): string {
  const possiblePaths = [
    path.join(__dirname, '../../resources/icon.icns'),
    path.join(__dirname, '../../public/icon.png'),
    path.join(__dirname, '../../public/logo.png'),
    path.join(__dirname, '../renderer/icon.png'),
    path.join(__dirname, '../renderer/logo.png'),
    path.join(process.cwd(), 'resources/icon.icns'),
    path.join(process.cwd(), 'public/icon.png'),
    path.join(process.cwd(), 'public/logo.png'),
  ];
  for (const p of possiblePaths) {
    if (fsSync.existsSync(p)) {
      return p;
    }
  }
  return '';
}

export function getAppPngIconPath(): string {
  const possiblePaths = [
    path.join(__dirname, '../../public/icon.png'),
    path.join(__dirname, '../../public/logo.png'),
    path.join(__dirname, '../renderer/icon.png'),
    path.join(__dirname, '../renderer/logo.png'),
    path.join(process.cwd(), 'public/icon.png'),
    path.join(process.cwd(), 'public/logo.png'),
  ];
  for (const p of possiblePaths) {
    if (fsSync.existsSync(p)) {
      return p;
    }
  }
  return '';
}

let mainWindow: BrowserWindow | null = null;
let fileToOpenOnReady: string | null = null;

const isDev = process.env.NODE_ENV === 'development' || !(app?.isPackaged);

function createWindow() {
  const iconPath = getAppPngIconPath() || getAppIconPath();

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 800,
    minHeight: 600,
    title: 'Regne - Mathematical CAS Document Workspace',
    backgroundColor: '#ffffff',
    ...(iconPath ? { icon: iconPath } : {}),
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      webSecurity: false,
    },
  });

  const checkForUpdates = async () => {
    (autoUpdater as any).__manualCheck = true;
    try {
      await autoUpdater.checkForUpdates();
    } catch (err: any) {
      (autoUpdater as any).__manualCheck = false;
      dialog.showMessageBox(mainWindow!, {
        type: 'error',
        title: 'Update Check Failed',
        message: 'Could not check for updates.',
        detail: err?.message ?? String(err),
        buttons: ['OK'],
      });
    }
  };

  const menu = createApplicationMenu(mainWindow, isDev ? undefined : checkForUpdates);
  if (process.platform === 'darwin') {
    Menu.setApplicationMenu(menu);
  } else {
    mainWindow.setMenu(menu);
  }

  mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
    console.error(`[Electron] Failed to load ${validatedURL}: ${errorDescription} (${errorCode})`);
  });

  mainWindow.webContents.on('console-message', (_event, _level, message, line, sourceId) => {
    console.log(`[Renderer Console] ${message} (${sourceId}:${line})`);
  });

  if (isDev && process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  mainWindow.webContents.on('did-finish-load', async () => {
    if (fileToOpenOnReady && mainWindow) {
      try {
        const content = await fs.readFile(fileToOpenOnReady, 'utf-8');
        mainWindow.webContents.send('file:open-request', {
          filePath: fileToOpenOnReady,
          content,
        });
        app.addRecentDocument(fileToOpenOnReady);
        fileToOpenOnReady = null;
      } catch (err) {
        console.error('Failed to open initial file:', err);
      }
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Handle macOS open-file event (e.g. double-clicking .regne or .hypatia file in Finder)
app.on('open-file', async (event, filePath) => {
  event.preventDefault();
  if (mainWindow && mainWindow.webContents) {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      mainWindow.webContents.send('file:open-request', { filePath, content });
      app.addRecentDocument(filePath);
    } catch (err) {
      console.error('Failed to open file via open-file event:', err);
    }
  } else {
    fileToOpenOnReady = filePath;
  }
});

// IPC: Save Document (Direct or with Dialog)
ipcMain.handle('dialog:saveDocument', async (_event, { data, filePath, defaultPath }) => {
  if (!mainWindow) return { success: false, error: 'No main window' };

  try {
    let targetPath = filePath;

    // If no existing filePath, prompt the user with save dialog
    if (!targetPath) {
      const result = await dialog.showSaveDialog(mainWindow, {
        title: 'Save Regne Document',
        defaultPath: defaultPath || 'Untitled.regne',
        filters: [
          { name: 'Regne Document (*.regne)', extensions: ['regne'] },
          { name: 'Legacy Document (*.hypatia)', extensions: ['hypatia'] },
          { name: 'JSON Document (*.json)', extensions: ['json'] },
          { name: 'All Files', extensions: ['*'] },
        ],
      });

      if (result.canceled || !result.filePath) {
        return { success: false, canceled: true };
      }
      targetPath = result.filePath;
    }

    // Ensure extension is .regne if none specified
    if (!path.extname(targetPath)) {
      targetPath += '.regne';
    }

    await fs.writeFile(targetPath, data, 'utf-8');
    app.addRecentDocument(targetPath);

    return { success: true, filePath: targetPath };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to save file' };
  }
});

// IPC: Open Document Dialog
ipcMain.handle('dialog:openDocument', async () => {
  if (!mainWindow) return { success: false, error: 'No main window' };

  try {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Open Regne Document',
      properties: ['openFile'],
      filters: [
        { name: 'Regne Document (*.regne, *.hypatia, *.json)', extensions: ['regne', 'hypatia', 'json'] },
        { name: 'All Files', extensions: ['*'] },
      ],
    });

    if (result.canceled || result.filePaths.length === 0) {
      return { success: false, canceled: true };
    }

    const filePath = result.filePaths[0];
    const content = await fs.readFile(filePath, 'utf-8');
    app.addRecentDocument(filePath);
    return { success: true, filePath, content };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to open file' };
  }
});

// IPC: Read File from disk directly
ipcMain.handle('file:readFile', async (_event, { filePath }) => {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    return { success: true, content };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to read file' };
  }
});

// IPC: Confirm Discard Unsaved Changes
ipcMain.handle('dialog:confirmDiscard', async (_event, { docTitle }) => {
  if (!mainWindow) return 'discard';

  const result = await dialog.showMessageBox(mainWindow, {
    type: 'question',
    buttons: ['Save', "Don't Save", 'Cancel'],
    defaultId: 0,
    cancelId: 2,
    message: `Do you want to save the changes you made to "${docTitle || 'Untitled Document'}"?`,
    detail: "Your changes will be lost if you don't save them.",
  });

  if (result.response === 0) return 'save';
  if (result.response === 1) return 'discard';
  return 'cancel';
});

// IPC: Update Window State (macOS title, proxy icon, dirty indicator)
ipcMain.on('window:updateState', (_event, { filePath, isDirty, title }) => {
  if (!mainWindow) return;

  const baseTitle = title || 'Untitled Document';
  const fileLabel = filePath ? path.basename(filePath) : '';
  const dirtyPrefix = isDirty ? '• ' : '';
  const fullTitle = `${dirtyPrefix}${baseTitle}${fileLabel ? ' — ' + fileLabel : ''} — Regne`;

  mainWindow.setTitle(fullTitle);

  if (process.platform === 'darwin') {
    mainWindow.setDocumentEdited(isDirty);
    if (filePath) {
      mainWindow.setRepresentedFilename(filePath);
    } else {
      mainWindow.setRepresentedFilename('');
    }
  }
});

// IPC: Export Document Dialog
ipcMain.handle('dialog:exportDocument', async (_event, { data, ext, filterName }) => {
  if (!mainWindow) return { success: false, error: 'No main window' };

  try {
    const result = await dialog.showSaveDialog(mainWindow, {
      title: `Export to ${filterName}`,
      defaultPath: `Document.${ext}`,
      filters: [
        { name: filterName, extensions: [ext] },
        { name: 'All Files', extensions: ['*'] },
      ],
    });

    if (result.canceled || !result.filePath) {
      return { success: false, canceled: true };
    }

    await fs.writeFile(result.filePath, data, 'utf-8');
    return { success: true, filePath: result.filePath };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to export file' };
  }
});

// --- SymPy Worker Process Manager ---
class SympyProcessManager {
  private process: ChildProcess | null = null;
  private isReady: boolean = false;
  private statusError: string | null = null;
  private version: string | null = null;
  private pendingRequests: Map<string, {
    resolve: (val: any) => void;
    reject: (err: any) => void;
  }> = new Map();
  private rl: readline.Interface | null = null;

  public start(): void {
    if (this.process) return;

    const workerScript = path.resolve(__dirname, '../../src/engine/sympyWorker.py');
    const venvPythonPosix = path.resolve(process.cwd(), '.venv/bin/python3');
    const venvPythonWin = path.resolve(process.cwd(), '.venv/Scripts/python.exe');
    let pythonCmd = process.platform === 'win32' ? 'python' : 'python3';

    if (fsSync.existsSync(venvPythonPosix)) {
      pythonCmd = venvPythonPosix;
    } else if (fsSync.existsSync(venvPythonWin)) {
      pythonCmd = venvPythonWin;
    }

    try {
      this.process = spawn(pythonCmd, ['-u', workerScript], {
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      this.rl = readline.createInterface({
        input: this.process.stdout!,
      });

      this.rl.on('line', (line: string) => {
        try {
          const data = JSON.parse(line.trim());
          if (data.status === 'ready') {
            this.isReady = true;
            this.statusError = null;
            this.version = data.version || null;
          } else if (data.status === 'error') {
            this.isReady = false;
            this.statusError = data.error;
          } else if (data.id && this.pendingRequests.has(data.id)) {
            const req = this.pendingRequests.get(data.id)!;
            this.pendingRequests.delete(data.id);
            req.resolve(data);
          }
        } catch (e) {
          console.error('[SymPy Manager] Line parse error:', line, e);
        }
      });

      this.process.stderr?.on('data', (data) => {
        console.warn(`[SymPy Stderr] ${data}`);
      });

      this.process.on('close', (code) => {
        this.process = null;
        this.isReady = false;
        this.rl?.close();
        this.rl = null;
        for (const [id, req] of this.pendingRequests.entries()) {
          req.reject(new Error(`SymPy worker exited with code ${code}`));
        }
        this.pendingRequests.clear();
      });

      this.process.on('error', (err) => {
        this.isReady = false;
        this.statusError = `Failed to spawn ${pythonCmd}: ${err.message}`;
      });

    } catch (err: any) {
      this.isReady = false;
      this.statusError = err?.message || 'Failed to start SymPy worker';
    }
  }

  public getStatus(): { ready: boolean; error: string | null; version: string | null } {
    if (!this.process) {
      this.start();
    }
    return { ready: this.isReady, error: this.statusError, version: this.version };
  }

  public async evaluate(id: string, code: string): Promise<any> {
    if (!this.process) {
      this.start();
    }

    return new Promise((resolve, reject) => {
      if (this.statusError) {
        return resolve({
          id,
          success: false,
          resultType: 'error',
          error: this.statusError,
          executionTimeMs: 0,
        });
      }

      const timer = setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          resolve({
            id,
            success: false,
            resultType: 'error',
            error: 'SymPy evaluation timed out (15s)',
            executionTimeMs: 15000,
          });
        }
      }, 15000);

      this.pendingRequests.set(id, {
        resolve: (val) => {
          clearTimeout(timer);
          resolve(val);
        },
        reject: (err) => {
          clearTimeout(timer);
          reject(err);
        }
      });

      try {
        this.process?.stdin?.write(JSON.stringify({ id, action: 'eval', code }) + '\n');
      } catch (err) {
        clearTimeout(timer);
        this.pendingRequests.delete(id);
        reject(err);
      }
    });
  }

  public async reset(): Promise<any> {
    const id = 'reset-' + Date.now();
    return new Promise((resolve, reject) => {
      this.pendingRequests.set(id, { resolve, reject });
      try {
        this.process?.stdin?.write(JSON.stringify({ id, action: 'reset' }) + '\n');
      } catch (err) {
        this.pendingRequests.delete(id);
        reject(err);
      }
    });
  }

  public interrupt(): void {
    if (this.process) {
      this.process.kill('SIGINT');
    }
  }

  public stop(): void {
    if (this.process) {
      this.process.kill();
      this.process = null;
    }
  }
}

const sympyManager = new SympyProcessManager();

ipcMain.handle('cas:sympy:status', async () => {
  return sympyManager.getStatus();
});

ipcMain.handle('cas:sympy:eval', async (_event, { id, code }) => {
  return sympyManager.evaluate(id, code);
});

ipcMain.handle('cas:sympy:reset', async () => {
  return sympyManager.reset();
});

ipcMain.on('cas:sympy:interrupt', () => {
  sympyManager.interrupt();
});

// --- Auto Updater ---
function setupAutoUpdater(): void {
  // Configure logging
  autoUpdater.logger = {
    info: (msg: any) => console.log('[AutoUpdater]', msg),
    warn: (msg: any) => console.warn('[AutoUpdater]', msg),
    error: (msg: any) => console.error('[AutoUpdater]', msg),
    debug: (msg: any) => console.log('[AutoUpdater DEBUG]', msg),
  } as any;

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('checking-for-update', () => {
    console.log('[AutoUpdater] Checking for update...');
  });

  autoUpdater.on('update-available', (info) => {
    console.log('[AutoUpdater] Update available:', info.version);
    mainWindow?.webContents.send('updater:update-available', {
      version: info.version,
      releaseNotes: info.releaseNotes,
    });
  });

  autoUpdater.on('update-not-available', (info) => {
    console.log('[AutoUpdater] No update available. Current version:', info.version);
    // Only surface this when triggered by a manual check (flag set in IPC handler)
    if ((autoUpdater as any).__manualCheck) {
      (autoUpdater as any).__manualCheck = false;
      if (mainWindow) {
        dialog.showMessageBox(mainWindow, {
          type: 'info',
          title: 'No Updates Available',
          message: `You are running the latest version of Regne (${info.version}).`,
          buttons: ['OK'],
        });
      }
    }
  });

  autoUpdater.on('update-downloaded', (info) => {
    console.log('[AutoUpdater] Update downloaded:', info.version);
    mainWindow?.webContents.send('updater:update-downloaded', {
      version: info.version,
    });
    // Also show a native dialog so the user always sees it
    if (mainWindow) {
      dialog.showMessageBox(mainWindow, {
        type: 'info',
        title: 'Update Ready',
        message: `Regne ${info.version} has been downloaded.`,
        detail: 'Restart the application to apply the update.',
        buttons: ['Restart Now', 'Later'],
        defaultId: 0,
        cancelId: 1,
      }).then(({ response }) => {
        if (response === 0) {
          autoUpdater.quitAndInstall();
        }
      });
    }
  });

  autoUpdater.on('error', (err) => {
    console.error('[AutoUpdater] Error:', err?.message ?? err);
  });
}

// IPC: Trigger install of the downloaded update
ipcMain.handle('updater:install-now', async () => {
  autoUpdater.quitAndInstall();
});

// IPC: Manual "Check for Updates…" from menu
ipcMain.handle('updater:check', async () => {
  (autoUpdater as any).__manualCheck = true;
  try {
    await autoUpdater.checkForUpdates();
  } catch (err: any) {
    (autoUpdater as any).__manualCheck = false;
    if (mainWindow) {
      dialog.showMessageBox(mainWindow, {
        type: 'error',
        title: 'Update Check Failed',
        message: 'Could not check for updates.',
        detail: err?.message ?? String(err),
        buttons: ['OK'],
      });
    }
  }
});

app.whenReady().then(() => {
  app.name = 'Regne';
  app.setName('Regne');

  const pngIcon = getAppPngIconPath();
  const icnsIcon = getAppIconPath();
  const dockIcon = pngIcon || icnsIcon;

  if (process.platform === 'darwin' && app.dock && dockIcon) {
    try {
      app.dock.setIcon(dockIcon);
    } catch (err) {
      console.warn('[Electron] Could not set dock icon:', err);
    }
  }

  try {
    app.setAboutPanelOptions({
      applicationName: 'Regne',
      applicationVersion: '1.0.0',
      version: '1.0.0',
      copyright: 'Copyright © Regne',
      credits: 'Mathematical CAS Document Workspace',
      ...(dockIcon ? { iconPath: dockIcon } : {}),
    });
  } catch (err) {
    console.warn('[Electron] Could not set about panel options:', err);
  }

  sympyManager.start();
  createWindow();

  // Set up auto-updater in packaged builds only
  if (!isDev) {
    setupAutoUpdater();
    // Delay the first check slightly so the window has time to fully render
    setTimeout(() => {
      autoUpdater.checkForUpdatesAndNotify().catch((err) => {
        console.warn('[AutoUpdater] Initial check failed:', err?.message ?? err);
      });
    }, 5000);
  }

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
