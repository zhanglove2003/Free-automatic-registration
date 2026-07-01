import { BrowserWindow, ipcMain } from 'electron';
import type { AppSettings } from '../shared/types.js';
import { Orchestrator } from './orchestrator/orchestrator.js';
import type { CreateJobInput } from './orchestrator/orchestrator.js';
import { checkGptNetwork } from './network/gptNetwork.js';
import { isBrowserHostWindow, type BrowserMonitorBounds } from './browser/browserController.js';

export const orchestrator = new Orchestrator();

export function registerIpc(): void {
  ipcMain.handle('app:snapshot', async () => orchestrator.snapshot());
  ipcMain.handle('settings:get', async () => orchestrator.getSettings());
  ipcMain.handle('cmd:saveSettings', async (_event, settings: AppSettings) => saveSettings(settings));
  ipcMain.handle('settings:update', async (_event, settings: AppSettings) => {
    return saveSettings(settings);
  });
  ipcMain.handle('cmd:start', async (_event, input: CreateJobInput) => startJob(input));
  ipcMain.handle('job:create', async (_event, input: CreateJobInput) => {
    return startJob(input);
  });
  ipcMain.handle('network:check', async () => checkGptNetwork());
  ipcMain.handle('monitor:openBrowser', async (event, taskId: string, bounds: BrowserMonitorBounds) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (!isBrowserHostWindow(window)) {
      throw new Error('App window not found for browser monitor');
    }
    await orchestrator.openBrowserMonitor(taskId, window, normalizeMonitorBounds(bounds));
    await broadcastSnapshot();
  });
  ipcMain.handle('monitor:closeBrowser', async (_event, taskId: string) => {
    await orchestrator.closeBrowserMonitor(taskId);
    await broadcastSnapshot();
  });
  ipcMain.handle('monitor:destroyBrowser', async (_event, taskId: string) => {
    await orchestrator.destroyBrowserMonitor(taskId);
    await broadcastSnapshot();
  });
  ipcMain.handle('monitor:captureBrowser', async (_event, taskId: string) => {
    const bytes = await orchestrator.captureBrowser(taskId);
    return bytes ? `data:image/png;base64,${bytes.toString('base64')}` : undefined;
  });
  ipcMain.handle('utility:openBrowser', async (event, sessionId: string, url: string, bounds: BrowserMonitorBounds) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (!isBrowserHostWindow(window)) {
      throw new Error('App window not found for utility browser');
    }
    await orchestrator.openUtilityBrowser(sessionId, normalizeUtilityBrowserUrl(url), window, normalizeMonitorBounds(bounds));
    await broadcastSnapshot();
  });
  ipcMain.handle('utility:closeBrowser', async (_event, sessionId: string) => {
    await orchestrator.closeUtilityBrowser(sessionId);
    await broadcastSnapshot();
  });
  ipcMain.handle('utility:goBack', async (_event, sessionId: string) => {
    await orchestrator.goUtilityBrowserBack(sessionId);
  });
  ipcMain.handle('utility:goForward', async (_event, sessionId: string) => {
    await orchestrator.goUtilityBrowserForward(sessionId);
  });
  ipcMain.handle('utility:reload', async (_event, sessionId: string) => {
    await orchestrator.reloadUtilityBrowser(sessionId);
  });
  ipcMain.handle('browser:setColorScheme', async (_event, scheme: 'light' | 'dark') => {
    await orchestrator.setBrowserColorScheme(normalizeBrowserColorScheme(scheme));
  });
  ipcMain.on('window:minimize', (event) => BrowserWindow.fromWebContents(event.sender)?.minimize());
  ipcMain.on('window:toggleMaximize', (event) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (!window) return;
    if (window.isMaximized()) {
      window.unmaximize();
    } else {
      window.maximize();
    }
  });
  ipcMain.on('window:close', (event) => BrowserWindow.fromWebContents(event.sender)?.close());
}

async function startJob(input: CreateJobInput) {
  const tasks = await orchestrator.createJob(input);
  await broadcastSnapshot();
  return tasks;
}

function saveSettings(settings: AppSettings): AppSettings {
  orchestrator.updateSettings(settings);
  return orchestrator.getSettings();
}

export async function broadcastSnapshot(): Promise<void> {
  const snapshot = await orchestrator.snapshot();
  for (const window of BrowserWindow.getAllWindows()) {
    if (!isAppRendererWindow(window)) continue;
    window.webContents.send('app:snapshot', snapshot);
    window.webContents.send('evt:stats', snapshot.stats);
    for (const task of snapshot.tasks) {
      window.webContents.send('evt:taskUpdate', task);
    }
    for (const activity of snapshot.recentLogs) {
      window.webContents.send('evt:activity', activity);
    }
  }
}

function isAppRendererWindow(window: BrowserWindow): boolean {
  return window.webContents.getURL().includes('/renderer/index.html');
}

function normalizeMonitorBounds(bounds: BrowserMonitorBounds): BrowserMonitorBounds {
  const width = Math.max(240, Math.round(bounds.width));
  const height = Math.max(180, Math.round(bounds.height));
  return {
    x: Math.max(0, Math.round(bounds.x)),
    y: Math.max(0, Math.round(bounds.y)),
    width,
    height,
  };
}

function normalizeUtilityBrowserUrl(url: string): string {
  const parsed = new URL(url);
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new Error('Unsupported utility browser URL protocol');
  }
  return parsed.toString();
}

function normalizeBrowserColorScheme(scheme: string): 'light' | 'dark' {
  if (scheme !== 'light' && scheme !== 'dark') {
    throw new Error('Unsupported browser color scheme');
  }
  return scheme;
}
