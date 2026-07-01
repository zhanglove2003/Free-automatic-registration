import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { Orchestrator } from '../src/main/orchestrator/orchestrator.js';
import { InMemoryTaskRepository } from '../src/main/storage/taskRepository.js';
import type { BrowserController, BrowserSessionHandle, BrowserSessionSummary } from '../src/main/browser/browserController.js';

const root = process.cwd();

function readProjectFile(relativePath: string): string {
  return readFileSync(join(root, relativePath), 'utf8');
}

class FakeBrowserController implements BrowserController {
  readonly created: Array<{ taskId: string; initialUrl?: string }> = [];
  readonly navigated: Array<{ taskId: string; url: string }> = [];
  readonly attached: Array<{ taskId: string; bounds: Electron.Rectangle }> = [];
  readonly detached: string[] = [];
  readonly destroyed: string[] = [];
  readonly wentBack: string[] = [];
  readonly wentForward: string[] = [];
  readonly reloaded: string[] = [];
  readonly colorSchemes: Array<'light' | 'dark'> = [];
  readonly handleLookups: string[] = [];
  listSessionCalls = 0;

  async createSession(taskId: string, initialUrl?: string): Promise<BrowserSessionHandle> {
    this.created.push({ taskId, initialUrl });
    return { taskId, partition: `persist:task-${taskId}` };
  }

  async navigate(handle: BrowserSessionHandle, url: string): Promise<void> {
    this.navigated.push({ taskId: handle.taskId, url });
    return;
  }

  async destroySession(handle: BrowserSessionHandle): Promise<void> {
    this.destroyed.push(handle.taskId);
    return;
  }

  async snapshot(_handle: BrowserSessionHandle): Promise<Buffer | undefined> {
    return Buffer.from('png-bytes');
  }

  async attachSession(taskId: string, _host: unknown, bounds: Electron.Rectangle): Promise<void> {
    this.attached.push({ taskId, bounds });
  }

  async detachSession(taskId: string): Promise<void> {
    this.detached.push(taskId);
  }

  async goBack(handle: BrowserSessionHandle): Promise<void> {
    this.wentBack.push(handle.taskId);
  }

  async goForward(handle: BrowserSessionHandle): Promise<void> {
    this.wentForward.push(handle.taskId);
  }

  async reload(handle: BrowserSessionHandle): Promise<void> {
    this.reloaded.push(handle.taskId);
  }

  async setColorScheme(scheme: 'light' | 'dark'): Promise<void> {
    this.colorSchemes.push(scheme);
  }

  listSessions(): BrowserSessionSummary[] {
    this.listSessionCalls += 1;
    return this.created.filter((session) => !this.destroyed.includes(session.taskId)).map((session) => ({
      taskId: session.taskId,
      partition: `persist:task-${session.taskId}`,
      url: session.initialUrl ?? '',
      embedded: false,
      createdAt: '2026-07-01T00:00:00.000Z',
    }));
  }

  getSessionHandle(taskId: string): BrowserSessionHandle | undefined {
    this.handleLookups.push(taskId);
    const session = this.created.find((created) => created.taskId === taskId && !this.destroyed.includes(taskId));
    return session ? { taskId: session.taskId, partition: `persist:task-${session.taskId}` } : undefined;
  }
}

describe('browser monitoring workflow', () => {
  it('opens a task browser session when a job starts and exposes it in snapshots', async () => {
    const browser = new FakeBrowserController();
    const orchestrator = new Orchestrator(new InMemoryTaskRepository(), browser);

    const [task] = await orchestrator.createJob({ count: 1, site: 'chatgpt-openai' });
    const snapshot = await orchestrator.snapshot();

    expect(browser.created).toEqual([{ taskId: task.id, initialUrl: 'https://chatgpt.com/' }]);
    expect(snapshot.browserSessions).toEqual([
      {
        taskId: task.id,
        partition: `persist:task-${task.id}`,
        url: 'https://chatgpt.com/',
        embedded: false,
        createdAt: '2026-07-01T00:00:00.000Z',
      },
    ]);
    await orchestrator.openBrowserMonitor(task.id, { contentView: { addChildView: () => undefined, removeChildView: () => undefined } }, { x: 76, y: 38, width: 900, height: 600 });
    await orchestrator.closeBrowserMonitor(task.id);
    expect(browser.attached).toEqual([{ taskId: task.id, bounds: { x: 76, y: 38, width: 900, height: 600 } }]);
    expect(browser.detached).toEqual([task.id]);
  });

  it('destroys a browser monitor session and removes it from snapshots', async () => {
    const browser = new FakeBrowserController();
    const orchestrator = new Orchestrator(new InMemoryTaskRepository(), browser);

    const [task] = await orchestrator.createJob({ count: 1, site: 'chatgpt-openai' });
    await orchestrator.destroyBrowserMonitor(task.id);
    const snapshot = await orchestrator.snapshot();

    expect(browser.destroyed).toEqual([task.id]);
    expect(snapshot.browserSessions).toEqual([]);
  });

  it('opens the XiaoPoZhan utility browser in a reusable embedded session', async () => {
    const browser = new FakeBrowserController();
    const orchestrator = new Orchestrator(new InMemoryTaskRepository(), browser);
    const host = { contentView: { addChildView: () => undefined, removeChildView: () => undefined } };
    const bounds = { x: 92, y: 120, width: 960, height: 580 };

    await orchestrator.openUtilityBrowser('xiaopozhan', 'https://api.snowovo.cc.cd/login', host, bounds);
    await orchestrator.openUtilityBrowser('xiaopozhan', 'https://api.snowovo.cc.cd/login', host, bounds);
    const snapshot = await orchestrator.snapshot();
    await orchestrator.closeUtilityBrowser('xiaopozhan');

    expect(browser.created).toEqual([{ taskId: 'utility-xiaopozhan', initialUrl: 'https://api.snowovo.cc.cd/login' }]);
    expect(snapshot.browserSessions).toEqual([]);
    expect(browser.navigated).toEqual([]);
    expect(browser.attached).toEqual([
      { taskId: 'utility-xiaopozhan', bounds },
      { taskId: 'utility-xiaopozhan', bounds },
    ]);
    expect(browser.detached).toContain('utility-xiaopozhan');
    expect(browser.destroyed).toEqual([]);
  });

  it('rejects monitor actions against utility browser sessions', async () => {
    const browser = new FakeBrowserController();
    const orchestrator = new Orchestrator(new InMemoryTaskRepository(), browser);
    const host = { contentView: { addChildView: () => undefined, removeChildView: () => undefined } };

    await orchestrator.openUtilityBrowser('xiaopozhan', 'https://api.snowovo.cc.cd/login', host, { x: 0, y: 0, width: 960, height: 580 });

    await expect(orchestrator.openBrowserMonitor('utility-xiaopozhan', host, { x: 0, y: 0, width: 960, height: 580 })).rejects.toThrow('monitor browser task id cannot target utility sessions');
    await expect(orchestrator.closeBrowserMonitor('utility-xiaopozhan')).rejects.toThrow('monitor browser task id cannot target utility sessions');
    await expect(orchestrator.destroyBrowserMonitor('utility-xiaopozhan')).rejects.toThrow('monitor browser task id cannot target utility sessions');
    await expect(orchestrator.captureBrowser('utility-xiaopozhan')).rejects.toThrow('monitor browser task id cannot target utility sessions');

    expect(browser.destroyed).toEqual([]);
    expect(browser.attached).toEqual([{ taskId: 'utility-xiaopozhan', bounds: { x: 0, y: 0, width: 960, height: 580 } }]);
  });

  it('routes XiaoPoZhan browser navigation controls through the persistent utility session', async () => {
    const browser = new FakeBrowserController();
    const orchestrator = new Orchestrator(new InMemoryTaskRepository(), browser);
    const host = { contentView: { addChildView: () => undefined, removeChildView: () => undefined } };

    await orchestrator.openUtilityBrowser('xiaopozhan', 'https://api.snowovo.cc.cd/login', host, { x: 0, y: 0, width: 960, height: 580 });
    await orchestrator.goUtilityBrowserBack('xiaopozhan');
    await orchestrator.goUtilityBrowserForward('xiaopozhan');
    await orchestrator.reloadUtilityBrowser('xiaopozhan');

    expect(browser.wentBack).toEqual(['utility-xiaopozhan']);
    expect(browser.wentForward).toEqual(['utility-xiaopozhan']);
    expect(browser.reloaded).toEqual(['utility-xiaopozhan']);
  });

  it('syncs the app theme color scheme to all embedded browser sessions', async () => {
    const browser = new FakeBrowserController();
    const orchestrator = new Orchestrator(new InMemoryTaskRepository(), browser);

    await orchestrator.setBrowserColorScheme('dark');
    await orchestrator.createJob({ count: 1, site: 'chatgpt-openai' });

    expect(browser.colorSchemes).toEqual(['dark']);
  });

  it('does not rebroadcast browser color scheme for every task created in a batch', async () => {
    const browser = new FakeBrowserController();
    const orchestrator = new Orchestrator(new InMemoryTaskRepository(), browser);

    await orchestrator.setBrowserColorScheme('dark');
    await orchestrator.createJob({ count: 3, site: 'chatgpt-openai' });

    expect(browser.colorSchemes).toEqual(['dark']);
  });

  it('uses direct browser handle lookup for per-session operations', async () => {
    const browser = new FakeBrowserController();
    const orchestrator = new Orchestrator(new InMemoryTaskRepository(), browser);
    const [task] = await orchestrator.createJob({ count: 1, site: 'chatgpt-openai' });
    browser.listSessionCalls = 0;

    await orchestrator.captureBrowser(task.id);
    await orchestrator.destroyBrowserMonitor(task.id);

    expect(browser.handleLookups).toContain(task.id);
    expect(browser.listSessionCalls).toBe(0);
  });

  it('exposes monitoring IPC and preload APIs for embedded browser visibility', () => {
    const ipc = readProjectFile('src/main/ipc.ts');
    const preload = readProjectFile('src/preload/preload.cjs');
    const preloadTypes = readProjectFile('src/preload/preload.ts');

    expect(ipc).toContain("ipcMain.handle('monitor:openBrowser'");
    expect(ipc).toContain("ipcMain.handle('monitor:closeBrowser'");
    expect(ipc).toContain("ipcMain.handle('monitor:captureBrowser'");
    expect(ipc).toContain("ipcMain.handle('monitor:destroyBrowser'");
    expect(ipc).toContain("ipcMain.handle('utility:openBrowser'");
    expect(ipc).toContain("ipcMain.handle('utility:closeBrowser'");
    expect(ipc).toContain("ipcMain.handle('utility:goBack'");
    expect(ipc).toContain("ipcMain.handle('utility:goForward'");
    expect(ipc).toContain("ipcMain.handle('utility:reload'");
    expect(ipc).toContain("ipcMain.handle('utility:attachBrowser'");
    expect(ipc).toContain("ipcMain.handle('browser:setColorScheme'");
    expect(preload).toContain("openBrowserMonitor: (taskId, bounds) => ipcRenderer.invoke('monitor:openBrowser', taskId, bounds)");
    expect(preload).toContain("closeBrowserMonitor: (taskId) => ipcRenderer.invoke('monitor:closeBrowser', taskId)");
    expect(preload).toContain("captureBrowser: (taskId) => ipcRenderer.invoke('monitor:captureBrowser', taskId)");
    expect(preload).toContain("destroyBrowserMonitor: (taskId) => ipcRenderer.invoke('monitor:destroyBrowser', taskId)");
    expect(preload).toContain("openUtilityBrowser: (sessionId, url, bounds) => ipcRenderer.invoke('utility:openBrowser', sessionId, url, bounds)");
    expect(preload).toContain("closeUtilityBrowser: (sessionId) => ipcRenderer.invoke('utility:closeBrowser', sessionId)");
    expect(preload).toContain("goUtilityBrowserBack: (sessionId) => ipcRenderer.invoke('utility:goBack', sessionId)");
    expect(preload).toContain("goUtilityBrowserForward: (sessionId) => ipcRenderer.invoke('utility:goForward', sessionId)");
    expect(preload).toContain("reloadUtilityBrowser: (sessionId) => ipcRenderer.invoke('utility:reload', sessionId)");
    expect(preload).toContain("attachUtilityBrowser: (sessionId, bounds) => ipcRenderer.invoke('utility:attachBrowser', sessionId, bounds)");
    expect(preload).toContain("setBrowserColorScheme: (scheme) => ipcRenderer.invoke('browser:setColorScheme', scheme)");
    expect(preloadTypes).toContain('openBrowserMonitor(taskId: string, bounds: BrowserMonitorBounds): Promise<void>;');
    expect(preloadTypes).toContain('closeBrowserMonitor(taskId: string): Promise<void>;');
    expect(preloadTypes).toContain('captureBrowser(taskId: string): Promise<string | undefined>');
    expect(preloadTypes).toContain('destroyBrowserMonitor(taskId: string): Promise<void>;');
    expect(preloadTypes).toContain('openUtilityBrowser(sessionId: string, url: string, bounds: BrowserMonitorBounds): Promise<void>;');
    expect(preloadTypes).toContain('closeUtilityBrowser(sessionId: string): Promise<void>;');
    expect(preloadTypes).toContain('goUtilityBrowserBack(sessionId: string): Promise<void>;');
    expect(preloadTypes).toContain('goUtilityBrowserForward(sessionId: string): Promise<void>;');
    expect(preloadTypes).toContain('reloadUtilityBrowser(sessionId: string): Promise<void>;');
    expect(preloadTypes).toContain('attachUtilityBrowser(sessionId: string, bounds: BrowserMonitorBounds): Promise<void>;');
    expect(preloadTypes).toContain("setBrowserColorScheme(scheme: 'light' | 'dark'): Promise<void>;");
  });

  it('wires the app theme toggle to browser color-scheme synchronization', () => {
    const html = readProjectFile('src/renderer/index.html');
    const app = readProjectFile('src/renderer/app.ts');

    expect(html).toContain('class="theme-toggle"');
    expect(html).not.toContain('Theme toggle (in-memory only, no storage APIs)');
    expect(app).toContain('wireThemeToggle');
    expect(app).toContain('setBrowserColorScheme(next)');
    expect(app).toContain("root.setAttribute('data-theme', next)");
  });

  it('adds a monitor sidebar entry and renders embedded browser sessions in the monitor page', () => {
    const html = readProjectFile('src/renderer/index.html');
    const app = readProjectFile('src/renderer/app.ts');

    expect(html).toContain('data-nav-id="monitor"');
    expect(html).toContain('aria-label="监控"');
    expect(html).toContain('data-page="monitor"');
    expect(html).toContain('class="browser-monitor-list"');
    expect(html).not.toContain('embedded-browser-shell');
    expect(html).toContain('class="browser-monitor-lightbox"');
    expect(html).toContain('class="browser-monitor-stage"');
    expect(html).not.toContain('.browser-monitor-stage::before');
    expect(html).toContain('class="browser-close-confirm-modal"');
    expect(app).toContain('renderBrowserMonitor(snapshot.browserSessions)');
    expect(app).toContain('showPageById');
    expect(app).toContain("showPageById('monitor')");
    expect(app).toContain('captureBrowser');
    expect(app).toContain('showLiveBrowserMonitor');
    expect(app).toContain('hideLiveBrowserMonitor');
    expect(app).toContain('openBrowserMonitor');
    expect(app).toContain('closeBrowserMonitor');
    expect(app).not.toContain('openEmbeddedBrowserMonitor');
    expect(app).not.toContain('closeEmbeddedBrowserMonitor');
    expect(app).toContain('requestBrowserClose');
    expect(app).toContain('confirmBrowserClose');
    expect(app).toContain('data-browser-action="request-close"');
    expect(app).not.toContain('<img alt="任务浏览器画面"');
    expect(app).not.toContain('showBrowser(taskId)');
  });

  it('renders a launch mode toggle and multi-browser count modal', () => {
    const html = readProjectFile('src/renderer/index.html');
    const app = readProjectFile('src/renderer/app.ts');

    expect(html).toContain('class="launch-mode-toggle"');
    expect(html).toContain('data-launch-mode="single"');
    expect(html).toContain('data-launch-mode="multi"');
    expect(html).toContain('>单线程</button>');
    expect(html).toContain('>多线程</button>');
    expect(html).toMatch(/\.page-panel\[data-page="dashboard"\]:not\(\[hidden\]\)\s*\{[^}]*gap:\s*18px;/s);
    expect(html).not.toMatch(/\.page-panel\[data-page="dashboard"\]\s*\{[^}]*display:\s*grid;/s);
    expect(html).toContain('class="multi-launch-modal"');
    expect(html).toContain('data-multi-count');
    expect(html).toContain('class="multi-count-input"');
    expect(html).toContain('type="number"');
    expect(html).toContain('min="2"');
    expect(html).not.toContain('multi-count-label');
    expect(html).not.toContain('个浏览器');
    expect(html).toMatch(/\.launch-mode-option\.active\s*\{[^}]*background:\s*linear-gradient/s);
    expect(app).toContain("let launchMode: 'single' | 'multi' = 'single'");
    expect(app).toContain('showMultiLaunchModal');
    expect(app).toContain('readMultiLaunchCount');
    expect(app).toContain('showMultiLaunchValidation');
    expect(app).toContain('createJob({ count');
    expect(app).toContain('return null');
  });

  it('adds a XiaoPoZhan sidebar page that opens the login URL with the embedded browser', () => {
    const html = readProjectFile('src/renderer/index.html');
    const app = readProjectFile('src/renderer/app.ts');

    expect(html).toContain('data-nav-id="xiaopozhan"');
    expect(html).toContain('aria-label="小破站"');
    expect(html).toContain('data-page="xiaopozhan"');
    expect(html).toContain('class="xiaopozhan-browser-stage"');
    expect(html).toContain('class="xiaopozhan-browser-toolbar"');
    expect(html).toContain('data-xiaopozhan-action="back"');
    expect(html).toContain('data-xiaopozhan-action="forward"');
    expect(html).toContain('data-xiaopozhan-action="reload"');
    expect(html).toContain('https://api.snowovo.cc.cd/login');
    expect(app).toContain("const XIAOPOZHAN_SESSION_ID = 'xiaopozhan'");
    expect(app).toContain("const XIAOPOZHAN_URL = 'https://api.snowovo.cc.cd/login'");
    expect(app).toContain("pageId === 'xiaopozhan'");
    expect(app).toContain('showXiaoPoZhanBrowser');
    expect(app).toContain('hideXiaoPoZhanBrowser');
    expect(app).toContain('openUtilityBrowser');
    expect(app).toContain('closeUtilityBrowser');
    expect(app).toContain('wireXiaoPoZhanBrowserControls');
    expect(app).toContain('goUtilityBrowserBack');
    expect(app).toContain('goUtilityBrowserForward');
    expect(app).toContain('reloadUtilityBrowser');
    expect(app).toContain('boundsForElement(stage)');
    expect(app).toContain("let activePageId: 'dashboard' | 'monitor' | 'xiaopozhan' = 'dashboard'");
    expect(app).toContain("if (activePageId !== 'xiaopozhan') {");
    expect(app).toContain("showPageById('monitor');");
    expect(app).toContain('attachUtilityBrowser');
    expect(app).toContain('window.registrationApp.attachUtilityBrowser(XIAOPOZHAN_SESSION_ID, boundsForElement(stage))');
    expect(app).toContain('codePointAt(0)');
    expect(app).not.toContain('return value.replace(/["\\\\]/g');
  });
});
