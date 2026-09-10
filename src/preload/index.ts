import { contextBridge, ipcRenderer } from 'electron';

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
  casSympy: {
    getStatus: () => Promise<{ ready: boolean; error: string | null; version: string | null }>;
    evaluate: (id: string, code: string) => Promise<any>;
    reset: () => Promise<any>;
    interrupt: () => void;
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

  casSympy: {
    getStatus: () => ipcRenderer.invoke('cas:sympy:status'),
    evaluate: (id: string, code: string) => ipcRenderer.invoke('cas:sympy:eval', { id, code }),
    reset: () => ipcRenderer.invoke('cas:sympy:reset'),
    interrupt: () => ipcRenderer.send('cas:sympy:interrupt'),
  },
};

contextBridge.exposeInMainWorld('regneAPI', api);
contextBridge.exposeInMainWorld('hypatiaAPI', api);
