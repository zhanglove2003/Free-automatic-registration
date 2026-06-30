import { BrowserWindow, ipcMain } from 'electron';
import type { AppSettings } from '../shared/types.js';
import { Orchestrator } from './orchestrator/orchestrator.js';
import { checkGptNetwork } from './network/gptNetwork.js';

export const orchestrator = new Orchestrator();

export function registerIpc(): void {
  ipcMain.handle('app:snapshot', async () => orchestrator.snapshot());
  ipcMain.handle('settings:get', async () => orchestrator.getSettings());
  ipcMain.handle('settings:update', async (_event, settings: AppSettings) => {
    orchestrator.updateSettings(settings);
    return orchestrator.getSettings();
  });
  ipcMain.handle('job:create', async (_event, input: { count: number; site: 'chatgpt-openai' | 'generic' }) => {
    const tasks = await orchestrator.createJob(input);
    await broadcastSnapshot();
    return tasks;
  });
  ipcMain.handle('network:check', async () => checkGptNetwork());
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

export async function broadcastSnapshot(): Promise<void> {
  const snapshot = await orchestrator.snapshot();
  for (const window of BrowserWindow.getAllWindows()) {
    window.webContents.send('app:snapshot', snapshot);
  }
}
