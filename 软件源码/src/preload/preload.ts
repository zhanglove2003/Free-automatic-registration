import { contextBridge, ipcRenderer } from 'electron';
import type { AppSnapshot, RegistrationTask } from '../main/domain/models.js';
import type { AppSettings } from '../shared/types.js';
import type { SmsCountry } from '../shared/smsCountries.js';
import type { SmsCountryPrice } from '../shared/smsHeroApi.js';

export interface BrowserMonitorBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface RegistrationAppApi {
  snapshot(): Promise<AppSnapshot>;
  getSettings(): Promise<AppSettings>;
  updateSettings(settings: AppSettings): Promise<AppSettings>;
  getSmsCountries(): Promise<SmsCountry[]>;
  getCheapestSmsCountries(): Promise<SmsCountryPrice[]>;
  getSmsBalance(): Promise<{ configured: boolean; balance?: number }>;
  createJob(input: { count: number; site: RegistrationTask['site'] }): Promise<RegistrationTask[]>;
  testSmsPurchase(): Promise<{ orderId: string; phone: string; country: string; cancelScheduledAt: string }>;
  checkNetwork(): Promise<unknown>;
  openBrowserMonitor(taskId: string, bounds: BrowserMonitorBounds): Promise<void>;
  closeBrowserMonitor(taskId: string): Promise<void>;
  destroyBrowserMonitor(taskId: string): Promise<void>;
  captureBrowser(taskId: string): Promise<string | undefined>;
  openUtilityBrowser(sessionId: string, url: string, bounds: BrowserMonitorBounds): Promise<void>;
  closeUtilityBrowser(sessionId: string): Promise<void>;
  attachUtilityBrowser(sessionId: string, bounds: BrowserMonitorBounds): Promise<void>;
  goUtilityBrowserBack(sessionId: string): Promise<void>;
  goUtilityBrowserForward(sessionId: string): Promise<void>;
  reloadUtilityBrowser(sessionId: string): Promise<void>;
  setBrowserColorScheme(scheme: 'light' | 'dark'): Promise<void>;
  minimizeWindow(): void;
  toggleMaximizeWindow(): void;
  closeWindow(): void;
  onSnapshot(callback: (snapshot: AppSnapshot) => void): () => void;
}

const api: RegistrationAppApi = {
  snapshot: () => ipcRenderer.invoke('app:snapshot'),
  getSettings: () => ipcRenderer.invoke('settings:get'),
  updateSettings: (settings) => ipcRenderer.invoke('cmd:saveSettings', settings),
  getSmsCountries: () => ipcRenderer.invoke('sms:countries'),
  getCheapestSmsCountries: () => ipcRenderer.invoke('sms:autoCountries'),
  getSmsBalance: () => ipcRenderer.invoke('sms:balance'),
  createJob: (input) => ipcRenderer.invoke('cmd:start', input),
  testSmsPurchase: () => ipcRenderer.invoke('sms:testPurchase'),
  checkNetwork: () => ipcRenderer.invoke('network:check'),
  openBrowserMonitor: (taskId, bounds) => ipcRenderer.invoke('monitor:openBrowser', taskId, bounds),
  closeBrowserMonitor: (taskId) => ipcRenderer.invoke('monitor:closeBrowser', taskId),
  destroyBrowserMonitor: (taskId) => ipcRenderer.invoke('monitor:destroyBrowser', taskId),
  captureBrowser: (taskId) => ipcRenderer.invoke('monitor:captureBrowser', taskId),
  openUtilityBrowser: (sessionId, url, bounds) => ipcRenderer.invoke('utility:openBrowser', sessionId, url, bounds),
  closeUtilityBrowser: (sessionId) => ipcRenderer.invoke('utility:closeBrowser', sessionId),
  attachUtilityBrowser: (sessionId, bounds) => ipcRenderer.invoke('utility:attachBrowser', sessionId, bounds),
  goUtilityBrowserBack: (sessionId) => ipcRenderer.invoke('utility:goBack', sessionId),
  goUtilityBrowserForward: (sessionId) => ipcRenderer.invoke('utility:goForward', sessionId),
  reloadUtilityBrowser: (sessionId) => ipcRenderer.invoke('utility:reload', sessionId),
  setBrowserColorScheme: (scheme) => ipcRenderer.invoke('browser:setColorScheme', scheme),
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
