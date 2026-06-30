import { contextBridge, ipcRenderer } from 'electron';
import type { AppSnapshot, RegistrationTask } from '../main/domain/models.js';
import type { AppSettings } from '../shared/types.js';

export interface RegistrationAppApi {
  snapshot(): Promise<AppSnapshot>;
  getSettings(): Promise<AppSettings>;
  updateSettings(settings: AppSettings): Promise<AppSettings>;
  createJob(input: { count: number; site: RegistrationTask['site'] }): Promise<RegistrationTask[]>;
  checkNetwork(): Promise<unknown>;
  minimizeWindow(): void;
  toggleMaximizeWindow(): void;
  closeWindow(): void;
  onSnapshot(callback: (snapshot: AppSnapshot) => void): () => void;
}

const api: RegistrationAppApi = {
  snapshot: () => ipcRenderer.invoke('app:snapshot'),
  getSettings: () => ipcRenderer.invoke('settings:get'),
  updateSettings: (settings) => ipcRenderer.invoke('settings:update', settings),
  createJob: (input) => ipcRenderer.invoke('job:create', input),
  checkNetwork: () => ipcRenderer.invoke('network:check'),
  minimizeWindow: () => ipcRenderer.send('window:minimize'),
  toggleMaximizeWindow: () => ipcRenderer.send('window:toggleMaximize'),
  closeWindow: () => ipcRenderer.send('window:close'),
  onSnapshot: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, snapshot: AppSnapshot) => callback(snapshot);
    ipcRenderer.on('app:snapshot', listener);
    return () => ipcRenderer.off('app:snapshot', listener);
  },
};

contextBridge.exposeInMainWorld('registrationApp', api);
