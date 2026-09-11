import { contextBridge, ipcRenderer } from 'electron';

export interface UpdateProgress {
  percent: number;
  bytesPerSecond: number;
  transferred: number;
  total: number;
}

export interface UpdateInfo {
  version: string;
  releaseDate?: string;
  releaseNotes?: string | any[] | null;
}

export type UpdaterStatus =
  | 'idle'
  | 'checking'
  | 'available'
  | 'not-available'
  | 'downloading'
  | 'downloaded'
  | 'error';

export interface UpdaterState {
  status: UpdaterStatus;
  info?: UpdateInfo | null;
  progress?: UpdateProgress | null;
  error?: string | null;
}

export interface VenvSetupState {
  isSettingUp: boolean;
  message: string;
  error: string | null;
  venvPath: string;
  ready: boolean;
}

export interface RegneAPI {
  saveDocument: (
    data: string,
    filePath?: string | null,
    defaultPath?: string
  ) => Promise<{ success: boolean; filePath?: string; canceled?: boolean; error?: string }>;
  openDocument: () => Promise<{ success: boolean; content?: string; filePath?: string; canceled?: boolean; error?: string }>;
  exportDocument: (
    data: string,
    ext: string,
    filterName: string
  ) => Promise<{ success: boolean; filePath?: string; canceled?: boolean; error?: string }>;
  confirmDiscard: (docTitle: string) => Promise<'save' | 'discard' | 'cancel'>;
  updateWindowState: (info: { filePath: string | null; isDirty: boolean; title: string }) => void;
  readFile: (filePath: string) => Promise<{ success: boolean; content?: string; error?: string }>;
  onMenuCommand: (callback: (command: string) => void) => () => void;
  onFileOpenRequest: (callback: (data: { filePath: string; content: string }) => void) => () => void;
  getPlatform: () => string;
  getVersion: () => Promise<string>;
  casSympy: {
    getStatus: () => Promise<{ ready: boolean; error: string | null; version: string | null }>;
    evaluate: (id: string, code: string) => Promise<any>;
    reset: () => Promise<any>;
    interrupt: () => void;
    getSetupStatus: () => Promise<VenvSetupState>;
    reinstallVenv: () => Promise<{ success: boolean; error?: string }>;
    onSetupProgress: (callback: (state: VenvSetupState) => void) => () => void;
  };
  updater: {
    getState: () => Promise<UpdaterState>;
    checkForUpdates: () => Promise<void>;
    downloadUpdate: () => Promise<void>;
    installUpdate: () => Promise<void>;
    onStatusChange: (callback: (state: UpdaterState) => void) => () => void;
    onDownloadProgress: (callback: (progress: UpdateProgress) => void) => () => void;
    onUpdateAvailable: (callback: (info: { version: string; releaseNotes?: any }) => void) => () => void;
    onUpdateDownloaded: (callback: (info: { version: string }) => void) => () => void;
  };
}

export type HypatiaAPI = RegneAPI;

const api: RegneAPI = {
  saveDocument: (data: string, filePath?: string | null, defaultPath?: string) =>
    ipcRenderer.invoke('dialog:saveDocument', { data, filePath, defaultPath }),

  openDocument: () =>
    ipcRenderer.invoke('dialog:openDocument'),

  readFile: (filePath: string) =>
    ipcRenderer.invoke('file:readFile', { filePath }),

  exportDocument: (data: string, ext: string, filterName: string) =>
    ipcRenderer.invoke('dialog:exportDocument', { data, ext, filterName }),

  confirmDiscard: (docTitle: string) =>
    ipcRenderer.invoke('dialog:confirmDiscard', { docTitle }),

  updateWindowState: (info: { filePath: string | null; isDirty: boolean; title: string }) => {
    ipcRenderer.send('window:updateState', info);
  },

  onMenuCommand: (callback: (command: string) => void) => {
    const subscription = (_event: Electron.IpcRendererEvent, command: string) => callback(command);
    ipcRenderer.on('menu:command', subscription);
    return () => {
      ipcRenderer.removeListener('menu:command', subscription);
    };
  },

  onFileOpenRequest: (callback: (data: { filePath: string; content: string }) => void) => {
    const subscription = (_event: Electron.IpcRendererEvent, data: { filePath: string; content: string }) => callback(data);
    ipcRenderer.on('file:open-request', subscription);
    return () => {
      ipcRenderer.removeListener('file:open-request', subscription);
    };
  },

  getPlatform: () => process.platform,
  getVersion: () => ipcRenderer.invoke('app:get-version'),

  casSympy: {
    getStatus: () => ipcRenderer.invoke('cas:sympy:status'),
    evaluate: (id: string, code: string) => ipcRenderer.invoke('cas:sympy:eval', { id, code }),
    reset: () => ipcRenderer.invoke('cas:sympy:reset'),
    interrupt: () => ipcRenderer.send('cas:sympy:interrupt'),
    getSetupStatus: () => ipcRenderer.invoke('cas:sympy:setup-status'),
    reinstallVenv: () => ipcRenderer.invoke('cas:sympy:reinstall-venv'),
    onSetupProgress: (callback: (state: VenvSetupState) => void) => {
      const subscription = (_event: Electron.IpcRendererEvent, state: VenvSetupState) => callback(state);
      ipcRenderer.on('cas:sympy:setup-progress', subscription);
      return () => ipcRenderer.removeListener('cas:sympy:setup-progress', subscription);
    },
  },

  updater: {
    getState: () => ipcRenderer.invoke('updater:get-state'),
    checkForUpdates: () => ipcRenderer.invoke('updater:check'),
    downloadUpdate: () => ipcRenderer.invoke('updater:download'),
    installUpdate: () => ipcRenderer.invoke('updater:install-now'),
    onStatusChange: (callback: (state: UpdaterState) => void) => {
      const subscription = (_event: Electron.IpcRendererEvent, state: UpdaterState) => callback(state);
      ipcRenderer.on('updater:status-change', subscription);
      return () => ipcRenderer.removeListener('updater:status-change', subscription);
    },
    onDownloadProgress: (callback: (progress: UpdateProgress) => void) => {
      const subscription = (_event: Electron.IpcRendererEvent, progress: UpdateProgress) => callback(progress);
      ipcRenderer.on('updater:download-progress', subscription);
      return () => ipcRenderer.removeListener('updater:download-progress', subscription);
    },
    onUpdateAvailable: (callback: (info: { version: string; releaseNotes?: any }) => void) => {
      const subscription = (_event: Electron.IpcRendererEvent, info: { version: string; releaseNotes?: any }) => callback(info);
      ipcRenderer.on('updater:update-available', subscription);
      return () => ipcRenderer.removeListener('updater:update-available', subscription);
    },
    onUpdateDownloaded: (callback: (info: { version: string }) => void) => {
      const subscription = (_event: Electron.IpcRendererEvent, info: { version: string }) => callback(info);
      ipcRenderer.on('updater:update-downloaded', subscription);
      return () => ipcRenderer.removeListener('updater:update-downloaded', subscription);
    },
  },
};

contextBridge.exposeInMainWorld('regneAPI', api);
contextBridge.exposeInMainWorld('hypatiaAPI', api);
