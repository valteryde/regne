import { app, BrowserWindow, ipcMain, dialog, Menu, nativeTheme } from 'electron';
import * as path from 'path';
import * as fs from 'fs/promises';
import * as fsSync from 'fs';
import { ChildProcess, spawn, spawnSync } from 'child_process';
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

// Force light theme mode so MathLive and embedded components do not apply dark-mode overrides
if (nativeTheme) {
  nativeTheme.themeSource = 'light';
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

  const menu = createApplicationMenu(mainWindow, () => performUpdateCheck(true));
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

// --- SymPy Worker Process Manager with Dedicated Venv Auto-Provisioning ---
class SympyProcessManager {
  private process: ChildProcess | null = null;
  private isReady: boolean = false;
  private statusError: string | null = null;
  private version: string | null = null;
  private isSettingUp: boolean = false;
  private setupMessage: string = '';
  private setupError: string | null = null;
  private setupPromise: Promise<boolean> | null = null;
  private activePythonPath: string | null = null;
  private pendingRequests: Map<string, {
    resolve: (val: any) => void;
    reject: (err: any) => void;
  }> = new Map();
  private rl: readline.Interface | null = null;

  private getVenvDir(): string {
    return app
      ? path.join(app.getPath('userData'), 'venv')
      : path.resolve(process.cwd(), '.venv');
  }

  private getVenvPythonPath(): string {
    const venvDir = this.getVenvDir();
    return process.platform === 'win32'
      ? path.join(venvDir, 'Scripts', 'python.exe')
      : path.join(venvDir, 'bin', 'python3');
  }

  private getVenvPipPath(): string {
    const venvDir = this.getVenvDir();
    return process.platform === 'win32'
      ? path.join(venvDir, 'Scripts', 'pip.exe')
      : path.join(venvDir, 'bin', 'pip');
  }

  private getExpandedEnv(): NodeJS.ProcessEnv {
    const homeDir = app ? app.getPath('home') : (process.env.HOME || process.env.USERPROFILE || '');
    const env: NodeJS.ProcessEnv = { ...process.env };
    if (process.platform === 'darwin') {
      const extraPaths = [
        '/opt/homebrew/bin',
        '/opt/homebrew/sbin',
        '/usr/local/bin',
        '/Library/Frameworks/Python.framework/Versions/Current/bin',
        '/Library/Frameworks/Python.framework/Versions/3.13/bin',
        '/Library/Frameworks/Python.framework/Versions/3.12/bin',
        path.join(homeDir, '.local/bin'),
        path.join(homeDir, '.pyenv/shims'),
      ];
      const validExtras = extraPaths.filter((p) => fsSync.existsSync(p));
      if (validExtras.length > 0) {
        env.PATH = validExtras.join(':') + (env.PATH ? `:${env.PATH}` : '');
      }
    }
    return env;
  }

  private testPythonModule(pyBin: string, code: string): boolean {
    try {
      const res = spawnSync(pyBin, ['-c', code], {
        env: this.getExpandedEnv(),
        timeout: 2000,
        stdio: 'ignore',
        windowsHide: true,
      });
      return res.status === 0;
    } catch {
      return false;
    }
  }

  public isDedicatedVenvReady(): boolean {
    const venvPython = this.getVenvPythonPath();
    if (!fsSync.existsSync(venvPython)) return false;
    return this.testPythonModule(venvPython, 'import sympy');
  }

  private notifySetupProgress(isSettingUp: boolean, message: string, error: string | null = null, ready = false): void {
    this.isSettingUp = isSettingUp;
    this.setupMessage = message;
    this.setupError = error;
    const state = {
      isSettingUp,
      message,
      error,
      venvPath: this.getVenvDir(),
      ready: this.isReady || ready,
    };
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('cas:sympy:setup-progress', state);
    }
  }

  private findBasePython(): string | null {
    const homeDir = app ? app.getPath('home') : (process.env.HOME || process.env.USERPROFILE || '');
    const candidates: string[] = [];
    if (process.platform === 'win32') {
      candidates.push(
        path.join(process.env.LOCALAPPDATA || '', 'Programs/Python/Python313/python.exe'),
        path.join(process.env.LOCALAPPDATA || '', 'Programs/Python/Python312/python.exe'),
        path.join(process.env.LOCALAPPDATA || '', 'Programs/Python/Python311/python.exe'),
        path.join(process.env.LOCALAPPDATA || '', 'Programs/Python/Python314/python.exe'),
        path.join(process.env.LOCALAPPDATA || '', 'Programs/Python/Python310/python.exe'),
        path.join(homeDir, 'miniforge3/python.exe'),
        path.join(homeDir, 'miniconda3/python.exe'),
        path.join(homeDir, 'anaconda3/python.exe'),
        'python.exe',
        'python'
      );
    } else {
      candidates.push(
        '/Library/Frameworks/Python.framework/Versions/3.13/bin/python3',
        '/Library/Frameworks/Python.framework/Versions/3.12/bin/python3',
        '/Library/Frameworks/Python.framework/Versions/3.11/bin/python3',
        '/Library/Frameworks/Python.framework/Versions/Current/bin/python3',
        '/Library/Frameworks/Python.framework/Versions/3.14/bin/python3',
        '/opt/homebrew/bin/python3',
        '/usr/local/bin/python3',
        path.join(homeDir, '.pyenv/shims/python3'),
        path.join(homeDir, 'miniforge3/bin/python3'),
        path.join(homeDir, 'miniconda3/bin/python3'),
        path.join(homeDir, 'anaconda3/bin/python3'),
        '/usr/bin/python3',
        'python3'
      );
    }

    for (const cand of candidates) {
      if (path.isAbsolute(cand) && !fsSync.existsSync(cand)) continue;
      if (this.testPythonModule(cand, 'import sys; sys.exit(0 if sys.version_info[0] >= 3 else 1)')) {
        return cand;
      }
    }
    return null;
  }

  private execAsync(cmd: string, args: string[]): Promise<void> {
    return new Promise((resolve, reject) => {
      const child = spawn(cmd, args, {
        stdio: ['ignore', 'pipe', 'pipe'],
        env: this.getExpandedEnv(),
      });

      let stderr = '';
      child.stderr?.on('data', (d) => {
        stderr += d.toString();
      });

      child.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Command ${cmd} ${args.join(' ')} exited with code ${code}: ${stderr.trim()}`));
        }
      });

      child.on('error', (err) => {
        reject(err);
      });
    });
  }

  public async ensureVenv(forceReinstall = false): Promise<boolean> {
    if (this.setupPromise) {
      return this.setupPromise;
    }

    if (!forceReinstall && this.isDedicatedVenvReady()) {
      return true;
    }

    this.setupPromise = (async () => {
      try {
        this.notifySetupProgress(true, 'Detecting host Python installation...');
        const basePython = this.findBasePython();
        if (!basePython) {
          throw new Error('Python 3 was not detected on this system. Please install Python 3 (from python.org or Homebrew) and restart Regne.');
        }

        const venvDir = this.getVenvDir();
        this.notifySetupProgress(true, 'Creating dedicated Regne virtual environment...');
        const parentDir = path.dirname(venvDir);
        if (!fsSync.existsSync(parentDir)) {
          await fs.mkdir(parentDir, { recursive: true });
        }

        console.log(`[SymPy Manager] Bootstrapping dedicated venv at ${venvDir} using ${basePython}`);
        await this.execAsync(basePython, ['-m', 'venv', '--clear', venvDir]);

        const newVenvPython = this.getVenvPythonPath();
        const newVenvPip = this.getVenvPipPath();
        if (!fsSync.existsSync(newVenvPython) || !fsSync.existsSync(newVenvPip)) {
          throw new Error(`Virtual environment created at ${venvDir}, but python or pip binaries were missing.`);
        }

        this.notifySetupProgress(true, 'Installing SymPy and mathematical packages...');
        console.log(`[SymPy Manager] Installing packages with ${newVenvPip}`);

        try {
          await this.execAsync(newVenvPip, ['install', '--no-warn-script-location', 'sympy>=1.13.0', 'kaxe>=1.8.1']);
        } catch (pipErr) {
          console.warn('[SymPy Manager] Combined install failed, attempting sympy standalone:', pipErr);
          await this.execAsync(newVenvPip, ['install', '--no-warn-script-location', 'sympy>=1.13.0']);
        }

        if (!this.testPythonModule(newVenvPython, 'import sympy')) {
          throw new Error('SymPy verification failed after pip installation in virtual environment.');
        }

        console.log('[SymPy Manager] Dedicated venv provisioned successfully!');
        this.notifySetupProgress(false, 'Dedicated math environment ready!', null, true);
        return true;
      } catch (err: any) {
        console.error('[SymPy Manager] Venv provisioning failed:', err);
        this.notifySetupProgress(false, 'Failed to set up math environment', err?.message || String(err), false);
        return false;
      } finally {
        this.setupPromise = null;
      }
    })();

    return this.setupPromise;
  }

  public getWorkerScriptPath(): string {
    if (app && app.isPackaged) {
      const packagedPaths = [
        path.join(process.resourcesPath, 'engine/sympyWorker.py'),
        path.join(process.resourcesPath, 'sympyWorker.py'),
        path.join(process.resourcesPath, 'app.asar.unpacked/src/engine/sympyWorker.py'),
        path.join(process.resourcesPath, 'app.asar.unpacked/dist/engine/sympyWorker.py'),
      ];
      for (const p of packagedPaths) {
        if (fsSync.existsSync(p)) return p;
      }
    } else {
      const devPaths = [
        path.resolve(__dirname, '../../src/engine/sympyWorker.py'),
        path.resolve(__dirname, '../engine/sympyWorker.py'),
        path.join(process.cwd(), 'src/engine/sympyWorker.py'),
        path.join(process.cwd(), 'dist/engine/sympyWorker.py'),
      ];
      for (const p of devPaths) {
        if (fsSync.existsSync(p)) return p;
      }
    }
    return path.resolve(__dirname, '../../src/engine/sympyWorker.py');
  }

  public start(): void {
    if (this.process) return;

    const workerScript = this.getWorkerScriptPath();
    if (!fsSync.existsSync(workerScript)) {
      this.isReady = false;
      this.statusError = `SymPy worker script not found at: ${workerScript}`;
      console.error('[SymPy Manager]', this.statusError);
      return;
    }

    // 1. If dedicated venv exists and has sympy, use it directly
    if (this.isDedicatedVenvReady()) {
      const venvPy = this.getVenvPythonPath();
      console.log(`[SymPy Manager] Using dedicated Regne venv: ${venvPy}`);
      this.spawnWorker(venvPy, workerScript);
      return;
    }

    // 2. If in development mode and local repository .venv has sympy, use it
    const isWin = process.platform === 'win32';
    const devPython = path.resolve(process.cwd(), isWin ? '.venv/Scripts/python.exe' : '.venv/bin/python3');
    if (!app?.isPackaged && fsSync.existsSync(devPython) && this.testPythonModule(devPython, 'import sympy')) {
      console.log(`[SymPy Manager] Using developer repository venv: ${devPython}`);
      this.spawnWorker(devPython, workerScript);
      return;
    }

    // 3. Check if any existing system Python has sympy
    const homeDir = app ? app.getPath('home') : (process.env.HOME || process.env.USERPROFILE || '');
    const candidatePythons: string[] = isWin
      ? [
          path.join(homeDir, '.venv/Scripts/python.exe'),
          path.join(process.env.LOCALAPPDATA || '', 'Programs/Python/Python313/python.exe'),
          path.join(process.env.LOCALAPPDATA || '', 'Programs/Python/Python312/python.exe'),
          'python.exe',
        ]
      : [
          '/Library/Frameworks/Python.framework/Versions/3.13/bin/python3',
          '/Library/Frameworks/Python.framework/Versions/3.12/bin/python3',
          '/usr/local/bin/python3',
          '/opt/homebrew/bin/python3',
          path.join(homeDir, '.venv/bin/python3'),
          'python3',
        ];

    let systemPythonWithSympy: string | null = null;
    for (const cand of candidatePythons) {
      if (path.isAbsolute(cand) && !fsSync.existsSync(cand)) continue;
      if (this.testPythonModule(cand, 'import sympy')) {
        systemPythonWithSympy = cand;
        break;
      }
    }

    if (systemPythonWithSympy) {
      // Spawn worker immediately so user has zero latency, while bootstrapping private venv in background
      console.log(`[SymPy Manager] Spawning with available system Python ${systemPythonWithSympy} while preparing dedicated venv...`);
      this.spawnWorker(systemPythonWithSympy, workerScript);
      this.ensureVenv().then((ready) => {
        if (ready) {
          console.log('[SymPy Manager] Dedicated venv ready; switching worker to dedicated venv...');
          this.stop();
          this.spawnWorker(this.getVenvPythonPath(), workerScript);
        }
      });
      return;
    }

    // 4. No Python on machine has sympy -> We must bootstrap the dedicated venv
    console.log('[SymPy Manager] No Python with SymPy detected. Bootstrapping dedicated Regne venv...');
    this.ensureVenv().then((ready) => {
      if (ready) {
        this.spawnWorker(this.getVenvPythonPath(), workerScript);
      } else {
        this.isReady = false;
        this.statusError = this.setupError || 'Failed to initialize mathematical solver environment.';
      }
    });
  }

  private spawnWorker(pythonCmd: string, workerScript: string): void {
    if (this.process) return;

    this.activePythonPath = pythonCmd;
    const env = this.getExpandedEnv();
    let lastStderr = '';

    try {
      this.process = spawn(pythonCmd, ['-u', workerScript], {
        stdio: ['pipe', 'pipe', 'pipe'],
        env,
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
            this.notifySetupProgress(false, `SymPy ${this.version} CAS Engine Active`, null, true);
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
        const msg = data.toString();
        lastStderr = (lastStderr + msg).slice(-2000);
        console.warn(`[SymPy Stderr] ${msg}`);
      });

      this.process.on('close', (code) => {
        this.process = null;
        this.isReady = false;
        this.rl?.close();
        this.rl = null;
        const detail = lastStderr.trim() ? `: ${lastStderr.trim()}` : '';
        const errMsg = `SymPy worker exited with code ${code}${detail}`;
        this.statusError = errMsg;
        for (const [, req] of this.pendingRequests.entries()) {
          req.reject(new Error(errMsg));
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

  public async reinstallVenv(): Promise<{ success: boolean; error?: string }> {
    this.stop();
    this.isReady = false;
    const ok = await this.ensureVenv(true);
    if (ok) {
      this.start();
      return { success: true };
    }
    return { success: false, error: this.setupError || 'Venv reinstallation failed' };
  }

  public getSetupStatus() {
    return {
      isSettingUp: this.isSettingUp,
      message: this.setupMessage,
      error: this.setupError,
      venvPath: this.getVenvDir(),
      ready: this.isReady,
      activePython: this.activePythonPath,
    };
  }

  public getStatus(): { ready: boolean; error: string | null; version: string | null; isSettingUp: boolean; setupMessage: string } {
    if (!this.process && !this.isSettingUp) {
      this.start();
    }
    return {
      ready: this.isReady,
      error: this.statusError,
      version: this.version,
      isSettingUp: this.isSettingUp,
      setupMessage: this.setupMessage,
    };
  }

  public async evaluate(id: string, code: string): Promise<any> {
    // If venv setup is currently executing in background, wait for it
    if (this.isSettingUp && this.setupPromise) {
      await this.setupPromise;
    }

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

ipcMain.handle('cas:sympy:setup-status', async () => {
  return sympyManager.getSetupStatus();
});

ipcMain.handle('cas:sympy:reinstall-venv', async () => {
  return sympyManager.reinstallVenv();
});

// --- Auto Updater State & Controller ---
type UpdaterStatus =
  | 'idle'
  | 'checking'
  | 'available'
  | 'not-available'
  | 'downloading'
  | 'downloaded'
  | 'error';

interface UpdateProgress {
  percent: number;
  bytesPerSecond: number;
  transferred: number;
  total: number;
}

interface UpdateInfo {
  version: string;
  releaseDate?: string;
  releaseNotes?: string | any[] | null;
}

interface UpdaterState {
  status: UpdaterStatus;
  info?: UpdateInfo | null;
  progress?: UpdateProgress | null;
  error?: string | null;
}

let updaterState: UpdaterState = {
  status: 'idle',
  info: null,
  progress: null,
  error: null,
};

let isManualCheck = false;

function broadcastUpdaterState(partial: Partial<UpdaterState>) {
  updaterState = { ...updaterState, ...partial };
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('updater:status-change', updaterState);
  }
}

function handleUpdaterError(err: any) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.setProgressBar(-1);
  }
  const errorMsg = err?.message ?? String(err);
  console.error('[AutoUpdater] Error:', errorMsg);
  broadcastUpdaterState({ status: 'error', error: errorMsg });

  if (isManualCheck) {
    isManualCheck = false;
    if (mainWindow && !mainWindow.isDestroyed()) {
      dialog.showMessageBox(mainWindow, {
        type: 'error',
        title: 'Update Check Failed',
        message: 'Could not complete update check or download.',
        detail: errorMsg,
        buttons: ['OK'],
      });
    }
  }
}

function startDownloadUpdate() {
  broadcastUpdaterState({
    status: 'downloading',
    progress: { percent: 0, bytesPerSecond: 0, transferred: 0, total: 0 },
    error: null,
  });
  autoUpdater.downloadUpdate().catch((err: any) => {
    handleUpdaterError(err);
  });
}

async function performUpdateCheck(manual = true) {
  if (isDev) {
    if (manual && mainWindow && !mainWindow.isDestroyed()) {
      dialog.showMessageBox(mainWindow, {
        type: 'info',
        title: 'Check for Updates',
        message: 'Update checks are disabled in development mode.',
        detail: `Running development build (v${app.getVersion()}). Updates are checked automatically in packaged releases.`,
        buttons: ['OK'],
      });
    }
    return;
  }

  isManualCheck = manual;
  broadcastUpdaterState({ status: 'checking', error: null });

  try {
    await autoUpdater.checkForUpdates();
  } catch (err: any) {
    handleUpdaterError(err);
  }
}

function setupAutoUpdater(): void {
  // Configure logging
  autoUpdater.logger = {
    info: (msg: any) => console.log('[AutoUpdater]', msg),
    warn: (msg: any) => console.warn('[AutoUpdater]', msg),
    error: (msg: any) => console.error('[AutoUpdater]', msg),
    debug: (msg: any) => console.log('[AutoUpdater DEBUG]', msg),
  } as any;

  // Do not auto-download blindly in background so users have full progress visibility & control
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('checking-for-update', () => {
    console.log('[AutoUpdater] Checking for update...');
    broadcastUpdaterState({ status: 'checking', error: null });
  });

  autoUpdater.on('update-available', (info) => {
    console.log('[AutoUpdater] Update available:', info.version);
    const infoPayload: UpdateInfo = {
      version: info.version,
      releaseDate: info.releaseDate,
      releaseNotes: info.releaseNotes,
    };
    broadcastUpdaterState({ status: 'available', info: infoPayload, error: null });
    mainWindow?.webContents.send('updater:update-available', infoPayload);

    if (isManualCheck) {
      isManualCheck = false;
      if (mainWindow && !mainWindow.isDestroyed()) {
        dialog.showMessageBox(mainWindow, {
          type: 'info',
          title: 'Update Available',
          message: `A new version of Regne is available (v${info.version}).`,
          detail: typeof info.releaseNotes === 'string'
            ? info.releaseNotes
            : 'Would you like to download and install this update now?',
          buttons: ['Download Update', 'Later'],
          defaultId: 0,
          cancelId: 1,
        }).then(({ response }) => {
          if (response === 0) {
            startDownloadUpdate();
          }
        });
      }
    }
  });

  autoUpdater.on('update-not-available', (info) => {
    console.log('[AutoUpdater] No update available. Current version:', info.version);
    broadcastUpdaterState({ status: 'not-available', info: { version: info.version }, error: null });
    if (isManualCheck) {
      isManualCheck = false;
      if (mainWindow && !mainWindow.isDestroyed()) {
        dialog.showMessageBox(mainWindow, {
          type: 'info',
          title: 'No Updates Available',
          message: `You are running the latest version of Regne (v${info.version}).`,
          buttons: ['OK'],
        });
      }
    }
  });

  autoUpdater.on('download-progress', (progressObj) => {
    const progress: UpdateProgress = {
      percent: Math.round(progressObj.percent * 10) / 10,
      bytesPerSecond: progressObj.bytesPerSecond || 0,
      transferred: progressObj.transferred || 0,
      total: progressObj.total || 0,
    };
    broadcastUpdaterState({ status: 'downloading', progress });
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('updater:download-progress', progress);
      mainWindow.setProgressBar(Math.min(Math.max(progressObj.percent / 100, 0), 1));
    }
  });

  autoUpdater.on('update-downloaded', (info) => {
    console.log('[AutoUpdater] Update downloaded:', info.version);
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.setProgressBar(-1);
    }
    const infoPayload: UpdateInfo = {
      version: info.version,
    };
    broadcastUpdaterState({ status: 'downloaded', info: infoPayload, error: null });
    mainWindow?.webContents.send('updater:update-downloaded', infoPayload);

    if (mainWindow && !mainWindow.isDestroyed()) {
      dialog.showMessageBox(mainWindow, {
        type: 'info',
        title: 'Update Ready',
        message: `Regne v${info.version} has been downloaded.`,
        detail: 'Restart the application now to apply the update.',
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
    handleUpdaterError(err);
  });
}

// IPC Handlers for Updater
ipcMain.handle('updater:get-state', async () => {
  return updaterState;
});

ipcMain.handle('updater:check', async () => {
  await performUpdateCheck(true);
});

ipcMain.handle('updater:download', async () => {
  startDownloadUpdate();
});

ipcMain.handle('updater:install-now', async () => {
  autoUpdater.quitAndInstall();
});

ipcMain.handle('app:get-version', () => {
  return app.getVersion();
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
      applicationVersion: app.getVersion(),
      version: app.getVersion(),
      copyright: 'Copyright © Regne',
      credits: 'Mathematical CAS Document Workspace',
      ...(dockIcon ? { iconPath: dockIcon } : {}),
    });
  } catch (err) {
    console.warn('[Electron] Could not set about panel options:', err);
  }

  sympyManager.start();
  setupAutoUpdater();
  createWindow();

  // Set up auto-updater background check in packaged builds only
  if (!isDev) {
    // Delay the first check slightly so the window has time to fully render
    setTimeout(() => {
      performUpdateCheck(false);
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
