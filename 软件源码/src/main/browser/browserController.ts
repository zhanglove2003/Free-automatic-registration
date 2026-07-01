import { createRequire } from 'node:module';
import type { BrowserWindow, Rectangle, WebContentsViewConstructorOptions } from 'electron';

const require = createRequire(import.meta.url);

export interface BrowserSessionHandle {
  taskId: string;
  partition: string;
}

export interface BrowserSessionSummary extends BrowserSessionHandle {
  url: string;
  embedded: boolean;
  createdAt: string;
}

export interface BrowserController {
  createSession(taskId: string, initialUrl?: string): Promise<BrowserSessionHandle>;
  navigate(handle: BrowserSessionHandle, url: string): Promise<void>;
  goBack(handle: BrowserSessionHandle): Promise<void>;
  goForward(handle: BrowserSessionHandle): Promise<void>;
  reload(handle: BrowserSessionHandle): Promise<void>;
  setColorScheme(scheme: BrowserColorScheme): Promise<void>;
  destroySession(handle: BrowserSessionHandle): Promise<void>;
  snapshot(handle: BrowserSessionHandle): Promise<Buffer | undefined>;
  attachSession(taskId: string, host: BrowserHostWindowLike, bounds: BrowserMonitorBounds): Promise<void>;
  detachSession(taskId: string, host?: BrowserHostWindowLike): Promise<void>;
  listSessions(): BrowserSessionSummary[];
  getSessionHandle(taskId: string): BrowserSessionHandle | undefined;
}

export type BrowserMonitorBounds = Rectangle;
export type BrowserColorScheme = 'light' | 'dark';

export interface BrowserDebuggerLike {
  isAttached(): boolean;
  attach(protocolVersion?: string): void;
  detach?(): void;
  sendCommand(command: string, params?: unknown): Promise<unknown>;
}

export interface BrowserWebContentsLike {
  loadURL(url: string): Promise<unknown>;
  capturePage(): Promise<{ toPNG(): Buffer }>;
  isDestroyed(): boolean;
  close(): void;
  canGoBack?(): boolean;
  canGoForward?(): boolean;
  goBack?(): void;
  goForward?(): void;
  reload?(): void;
  navigationHistory?: {
    canGoBack(): boolean;
    canGoForward(): boolean;
    goBack(): void;
    goForward(): void;
  };
  setWindowOpenHandler?(handler: (details: { url: string }) => { action: 'allow' | 'deny' }): void;
  debugger?: BrowserDebuggerLike;
}

export interface BrowserViewLike {
  webContents: BrowserWebContentsLike;
  setBounds(bounds: BrowserMonitorBounds): void;
  setVisible(visible: boolean): void;
}

export interface BrowserHostContentViewLike {
  addChildView(view: unknown): void;
  removeChildView(view: unknown): void;
}

export interface BrowserHostWindowLike {
  contentView: BrowserHostContentViewLike;
}

export type BrowserViewFactory = (options: WebContentsViewConstructorOptions) => BrowserViewLike;

export class ElectronBrowserController implements BrowserController {
  private readonly sessions = new Map<string, BrowserViewLike>();
  private readonly sessionSummaries = new Map<string, BrowserSessionSummary>();
  private readonly attachedHosts = new Map<string, BrowserHostWindowLike>();
  private colorScheme: BrowserColorScheme = 'light';

  constructor(private readonly createView: BrowserViewFactory = createElectronBrowserView) {}

  async createSession(taskId: string, initialUrl?: string): Promise<BrowserSessionHandle> {
    const handle = buildHandle(taskId);
    await this.destroySession(handle);

    const view = this.createView({
      webPreferences: {
        partition: handle.partition,
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
      },
    });
    view.setVisible(false);
    this.keepNewWindowsInCurrentView(handle.taskId, view);
    this.sessions.set(handle.taskId, view);
    this.sessionSummaries.set(handle.taskId, {
      ...handle,
      url: '',
      embedded: false,
      createdAt: new Date().toISOString(),
    });
    if (initialUrl) {
      try {
        await view.webContents.loadURL(initialUrl);
        this.updateSession(handle.taskId, { url: initialUrl });
        await this.applyColorScheme(view);
      } catch (error) {
        await this.destroySession(handle);
        throw error;
      }
    }

    return handle;
  }

  async navigate(handle: BrowserSessionHandle, url: string): Promise<void> {
    const view = this.sessions.get(handle.taskId);
    if (!view || view.webContents.isDestroyed()) {
      throw new Error(`Browser session not found: ${handle.taskId}`);
    }
    await this.loadSessionUrl(handle.taskId, view, url);
    this.updateSession(handle.taskId, { url });
    await this.applyColorScheme(view);
  }

  async goBack(handle: BrowserSessionHandle): Promise<void> {
    const webContents = this.requireWebContents(handle);
    if (webContents.navigationHistory?.canGoBack()) {
      webContents.navigationHistory.goBack();
      return;
    }
    if (webContents.canGoBack?.()) {
      webContents.goBack?.();
    }
  }

  async goForward(handle: BrowserSessionHandle): Promise<void> {
    const webContents = this.requireWebContents(handle);
    if (webContents.navigationHistory?.canGoForward()) {
      webContents.navigationHistory.goForward();
      return;
    }
    if (webContents.canGoForward?.()) {
      webContents.goForward?.();
    }
  }

  async reload(handle: BrowserSessionHandle): Promise<void> {
    const webContents = this.requireWebContents(handle);
    webContents.reload?.();
  }

  async setColorScheme(scheme: BrowserColorScheme): Promise<void> {
    this.colorScheme = scheme;
    await Promise.all([...this.sessions.entries()]
      .filter(([taskId]) => Boolean(this.sessionSummaries.get(taskId)?.url))
      .map(([, view]) => this.applyColorScheme(view)));
  }

  async destroySession(handle: BrowserSessionHandle): Promise<void> {
    const view = this.sessions.get(handle.taskId);
    await this.detachSession(handle.taskId);
    this.sessions.delete(handle.taskId);
    this.sessionSummaries.delete(handle.taskId);
    if (view && !view.webContents.isDestroyed()) {
      view.webContents.close();
    }
  }

  async snapshot(handle: BrowserSessionHandle): Promise<Buffer | undefined> {
    const view = this.sessions.get(handle.taskId);
    if (!view || view.webContents.isDestroyed()) {
      return undefined;
    }
    const image = await view.webContents.capturePage();
    return image.toPNG();
  }

  async attachSession(taskId: string, host: BrowserHostWindowLike, bounds: BrowserMonitorBounds): Promise<void> {
    const view = this.sessions.get(taskId);
    if (!view || view.webContents.isDestroyed()) {
      throw new Error(`Browser session not found: ${taskId}`);
    }
    const previousHost = this.attachedHosts.get(taskId);
    if (previousHost && previousHost !== host) {
      previousHost.contentView.removeChildView(view);
    }
    host.contentView.addChildView(view);
    view.setBounds(bounds);
    view.setVisible(true);
    this.attachedHosts.set(taskId, host);
    this.updateSession(taskId, { embedded: true });
  }

  async detachSession(taskId: string, host?: BrowserHostWindowLike): Promise<void> {
    const view = this.sessions.get(taskId);
    const attachedHost = host ?? this.attachedHosts.get(taskId);
    if (view && attachedHost) {
      attachedHost.contentView.removeChildView(view);
      view.setVisible(false);
    }
    this.attachedHosts.delete(taskId);
    this.updateSession(taskId, { embedded: false });
  }

  listSessions(): BrowserSessionSummary[] {
    return [...this.sessionSummaries.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  getSessionHandle(taskId: string): BrowserSessionHandle | undefined {
    const session = this.sessionSummaries.get(taskId);
    return session ? { taskId: session.taskId, partition: session.partition } : undefined;
  }

  private updateSession(taskId: string, patch: Partial<Pick<BrowserSessionSummary, 'url' | 'embedded'>>): void {
    const current = this.sessionSummaries.get(taskId);
    if (!current) return;
    this.sessionSummaries.set(taskId, {
      ...current,
      ...patch,
    });
  }

  private requireWebContents(handle: BrowserSessionHandle): BrowserWebContentsLike {
    const view = this.sessions.get(handle.taskId);
    if (!view || view.webContents.isDestroyed()) {
      throw new Error(`Browser session not found: ${handle.taskId}`);
    }
    return view.webContents;
  }

  private keepNewWindowsInCurrentView(taskId: string, view: BrowserViewLike): void {
    view.webContents.setWindowOpenHandler?.(({ url }) => {
      if (isBrowserNavigableUrl(url)) {
        void view.webContents.loadURL(url)
          .then(() => this.updateSession(taskId, { url }))
          .catch((error) => {
            console.warn(`Embedded browser navigation failed for ${taskId}`, error);
          });
      }
      return { action: 'deny' };
    });
  }

  private async loadSessionUrl(taskId: string, view: BrowserViewLike, url: string): Promise<void> {
    if (taskId.startsWith('utility-') && view.webContents.debugger) {
      const browserDebugger = view.webContents.debugger;
      if (!browserDebugger.isAttached()) {
        browserDebugger.attach('1.3');
      }
      try {
        await browserDebugger.sendCommand('Page.navigate', { url });
      } finally {
        browserDebugger.detach?.();
      }
      return;
    }
    await view.webContents.loadURL(url);
  }

  private async applyColorScheme(view: BrowserViewLike): Promise<void> {
    if (view.webContents.isDestroyed()) return;
    const browserDebugger = view.webContents.debugger;
    if (!browserDebugger) return;
    if (!browserDebugger.isAttached()) {
      browserDebugger.attach('1.3');
    }
    try {
      await browserDebugger.sendCommand('Emulation.setEmulatedMedia', {
        features: [{ name: 'prefers-color-scheme', value: this.colorScheme }],
      });
    } finally {
      browserDebugger.detach?.();
    }
  }
}

function buildHandle(taskId: string): BrowserSessionHandle {
  return {
    taskId,
    partition: taskId.startsWith('utility-') ? `persist:${taskId}` : `persist:task-${taskId}`,
  };
}

function createElectronBrowserView(options: WebContentsViewConstructorOptions): BrowserViewLike {
  const electron = require('electron') as typeof import('electron');
  return new electron.WebContentsView(options);
}

function isBrowserNavigableUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export function isBrowserHostWindow(window: BrowserWindow | undefined | null): window is BrowserWindow & BrowserHostWindowLike {
  return Boolean(window?.contentView);
}
