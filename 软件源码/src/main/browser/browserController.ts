import { createRequire } from 'node:module';
import type { BrowserWindowConstructorOptions } from 'electron';

const require = createRequire(import.meta.url);

export interface BrowserSessionHandle {
  taskId: string;
  partition: string;
}

export interface BrowserController {
  createSession(taskId: string, initialUrl?: string): Promise<BrowserSessionHandle>;
  navigate(handle: BrowserSessionHandle, url: string): Promise<void>;
  destroySession(handle: BrowserSessionHandle): Promise<void>;
  snapshot(handle: BrowserSessionHandle): Promise<Buffer | undefined>;
}

export interface BrowserWindowLike {
  loadURL(url: string): Promise<void>;
  capturePage(): Promise<{ toPNG(): Buffer }>;
  close(): void;
  isDestroyed(): boolean;
}

export type BrowserWindowFactory = (options: BrowserWindowConstructorOptions) => BrowserWindowLike;

export class ElectronBrowserController implements BrowserController {
  private readonly sessions = new Map<string, BrowserWindowLike>();

  constructor(private readonly createWindow: BrowserWindowFactory = createElectronBrowserWindow) {}

  async createSession(taskId: string, initialUrl?: string): Promise<BrowserSessionHandle> {
    const handle = buildHandle(taskId);
    await this.destroySession(handle);

    const window = this.createWindow({
      width: 1280,
      height: 860,
      show: false,
      autoHideMenuBar: true,
      title: `Registration browser ${taskId}`,
      webPreferences: {
        partition: handle.partition,
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
      },
    });
    this.sessions.set(handle.taskId, window);

    if (initialUrl) {
      await window.loadURL(initialUrl);
    }

    return handle;
  }

  async navigate(handle: BrowserSessionHandle, url: string): Promise<void> {
    const window = this.sessions.get(handle.taskId);
    if (!window || window.isDestroyed()) {
      throw new Error(`Browser session not found: ${handle.taskId}`);
    }
    await window.loadURL(url);
  }

  async destroySession(handle: BrowserSessionHandle): Promise<void> {
    const window = this.sessions.get(handle.taskId);
    this.sessions.delete(handle.taskId);
    if (window && !window.isDestroyed()) {
      window.close();
    }
  }

  async snapshot(handle: BrowserSessionHandle): Promise<Buffer | undefined> {
    const window = this.sessions.get(handle.taskId);
    if (!window || window.isDestroyed()) {
      return undefined;
    }
    const image = await window.capturePage();
    return image.toPNG();
  }
}

function buildHandle(taskId: string): BrowserSessionHandle {
  return {
    taskId,
    partition: `persist:task-${taskId}`,
  };
}

function createElectronBrowserWindow(options: BrowserWindowConstructorOptions): BrowserWindowLike {
  const electron = require('electron') as typeof import('electron');
  return new electron.BrowserWindow(options);
}
