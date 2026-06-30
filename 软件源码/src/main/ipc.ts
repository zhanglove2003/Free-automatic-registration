import { BrowserWindow, ipcMain } from 'electron';
import type { AppSettings } from '../shared/types.js';
import { Orchestrator } from './orchestrator/orchestrator.js';
import type { CreateJobInput } from './orchestrator/orchestrator.js';
import { checkGptNetwork } from './network/gptNetwork.js';

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
