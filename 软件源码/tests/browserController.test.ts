import { describe, expect, it } from 'vitest';
import { ElectronBrowserController, type BrowserViewFactory } from '../src/main/browser/browserController.js';

class FakeNativeImage {
  constructor(private readonly bytes: Buffer) {}

  toPNG(): Buffer {
    return this.bytes;
  }
}

class FakeWebContents {
  readonly loadedUrls: string[] = [];
  readonly capturedPages: Array<Record<string, never>> = [];
  readonly historyCommands: string[] = [];
  readonly debugger = {
    attached: false,
    attachVersion: '',
    commands: [] as Array<{ command: string; params?: unknown }>,
    isAttached: () => this.debugger.attached,
    attach: (version?: string) => {
      this.debugger.attached = true;
      this.debugger.attachVersion = version ?? '';
    },
    sendCommand: async (command: string, params?: unknown) => {
      this.debugger.commands.push({ command, params });
    },
  };
  windowOpenHandler?: (details: { url: string }) => { action: 'allow' | 'deny' };
  destroyed = false;
  backAvailable = true;
  forwardAvailable = true;
  rejectNextLoadUrl?: string;

  async loadURL(url: string): Promise<void> {
    this.loadedUrls.push(url);
    if (this.rejectNextLoadUrl === url) {
      this.rejectNextLoadUrl = undefined;
      throw new Error(`navigation failed: ${url}`);
    }
  }

  async capturePage(): Promise<FakeNativeImage> {
    this.capturedPages.push({});
    return new FakeNativeImage(Buffer.from('png-bytes'));
  }

  close(): void {
    this.destroyed = true;
  }

  isDestroyed(): boolean {
    return this.destroyed;
  }

  canGoBack(): boolean {
    return this.backAvailable;
  }

  canGoForward(): boolean {
    return this.forwardAvailable;
  }

  goBack(): void {
    this.historyCommands.push('back');
  }

  goForward(): void {
    this.historyCommands.push('forward');
  }

  reload(): void {
    this.historyCommands.push('reload');
  }

  setWindowOpenHandler(handler: (details: { url: string }) => { action: 'allow' | 'deny' }): void {
    this.windowOpenHandler = handler;
  }
}

class FakeBrowserView {
  readonly webContents = new FakeWebContents();
  bounds?: Electron.Rectangle;
  visible = false;

  constructor(readonly options: Record<string, unknown>) {}

  setBounds(bounds: Electron.Rectangle): void {
    this.bounds = bounds;
  }

  setVisible(visible: boolean): void {
    this.visible = visible;
  }
}

class FakeHostContentView {
  readonly added: FakeBrowserView[] = [];
  readonly removed: FakeBrowserView[] = [];

  addChildView(view: FakeBrowserView): void {
    this.added.push(view);
  }

  removeChildView(view: FakeBrowserView): void {
    this.removed.push(view);
  }
}

class FakeHostWindow {
  readonly contentView = new FakeHostContentView();
}

function createHarness(): { controller: ElectronBrowserController; views: FakeBrowserView[] } {
  const views: FakeBrowserView[] = [];
  const factory: BrowserViewFactory = (options) => {
    const view = new FakeBrowserView(options as Record<string, unknown>);
    views.push(view);
    return view;
  };

  return {
    controller: new ElectronBrowserController(factory),
    views,
  };
}

describe('ElectronBrowserController', () => {
  it('creates a task-scoped Chromium view with safe web preferences', async () => {
    const { controller, views } = createHarness();

    const handle = await controller.createSession('task-123');

    expect(handle).toEqual({
      taskId: 'task-123',
      partition: 'persist:task-task-123',
    });
    expect(views).toHaveLength(1);
    expect(views[0].options).toMatchObject({
      webPreferences: {
        partition: 'persist:task-task-123',
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
      },
    });
  });

  it('navigates to the initial URL when a session is created with a URL', async () => {
    const { controller, views } = createHarness();

    await controller.createSession('task-123', 'https://chatgpt.com/');

    expect(views[0].webContents.loadedUrls).toEqual(['https://chatgpt.com/']);
  });

  it('keeps new-window links inside the same Chromium view', async () => {
    const { controller, views } = createHarness();

    await controller.createSession('utility-xiaopozhan', 'https://api.snowovo.cc.cd/login');
    const decision = views[0].webContents.windowOpenHandler?.({ url: 'https://api.snowovo.cc.cd/dashboard' });
    await Promise.resolve();

    expect(decision).toEqual({ action: 'deny' });
    expect(views).toHaveLength(1);
    expect(views[0].webContents.loadedUrls).toEqual([
      'https://api.snowovo.cc.cd/login',
      'https://api.snowovo.cc.cd/dashboard',
    ]);
    expect(controller.listSessions()[0]).toMatchObject({ url: 'https://api.snowovo.cc.cd/dashboard' });
  });

  it('records the requested URL when an embedded new-window navigation fails', async () => {
    const { controller, views } = createHarness();

    await controller.createSession('utility-xiaopozhan', 'https://api.snowovo.cc.cd/login');
    views[0].webContents.rejectNextLoadUrl = 'https://api.snowovo.cc.cd/dashboard';
    const decision = views[0].webContents.windowOpenHandler?.({ url: 'https://api.snowovo.cc.cd/dashboard' });
    await Promise.resolve();

    expect(decision).toEqual({ action: 'deny' });
    expect(views[0].webContents.loadedUrls).toEqual([
      'https://api.snowovo.cc.cd/login',
      'https://api.snowovo.cc.cd/dashboard',
    ]);
    expect(controller.listSessions()[0]).toMatchObject({ url: 'https://api.snowovo.cc.cd/dashboard' });
  });

  it('exposes direct session handle lookup without sorting all sessions', async () => {
    const { controller } = createHarness();

    const handle = await controller.createSession('task-123', 'https://chatgpt.com/');

    expect(controller.getSessionHandle('task-123')).toEqual(handle);
    expect(controller.getSessionHandle('missing-task')).toBeUndefined();
  });

  it('uses a stable persistent partition for utility browser sessions', async () => {
    const { controller, views } = createHarness();

    const handle = await controller.createSession('utility-xiaopozhan', 'https://api.snowovo.cc.cd/login');

    expect(handle).toEqual({
      taskId: 'utility-xiaopozhan',
      partition: 'persist:utility-xiaopozhan',
    });
    expect(views[0].options).toMatchObject({
      webPreferences: {
        partition: 'persist:utility-xiaopozhan',
      },
    });
  });

  it('applies the selected color scheme to existing and new browser sessions', async () => {
    const { controller, views } = createHarness();

    await controller.createSession('task-123', 'https://chatgpt.com/');
    await controller.setColorScheme('dark');
    await controller.createSession('utility-xiaopozhan', 'https://api.snowovo.cc.cd/login');

    expect(views[0].webContents.debugger.commands).toContainEqual({
      command: 'Emulation.setEmulatedMedia',
      params: { features: [{ name: 'prefers-color-scheme', value: 'dark' }] },
    });
    expect(views[0].webContents.debugger.attachVersion).toBe('1.3');
    expect(views[1].webContents.debugger.commands[0]).toEqual({
      command: 'Emulation.setEmulatedMedia',
      params: { features: [{ name: 'prefers-color-scheme', value: 'dark' }] },
    });
  });

  it('navigates an existing session using the same view', async () => {
    const { controller, views } = createHarness();
    const handle = await controller.createSession('task-123');

    await controller.navigate(handle, 'https://auth.openai.com/');

    expect(views).toHaveLength(1);
    expect(views[0].webContents.loadedUrls).toEqual(['https://auth.openai.com/']);
  });

  it('captures a PNG snapshot from the session view', async () => {
    const { controller, views } = createHarness();
    const handle = await controller.createSession('task-123');

    const bytes = await controller.snapshot(handle);

    expect(bytes).toEqual(Buffer.from('png-bytes'));
    expect(views[0].webContents.capturedPages).toHaveLength(1);
  });

  it('routes history navigation commands to the session webContents', async () => {
    const { controller, views } = createHarness();
    const handle = await controller.createSession('utility-xiaopozhan');

    await controller.goBack(handle);
    await controller.goForward(handle);
    await controller.reload(handle);

    expect(views[0].webContents.historyCommands).toEqual(['back', 'forward', 'reload']);
  });

  it('closes and unregisters sessions, and repeated destroy is harmless', async () => {
    const { controller, views } = createHarness();
    const handle = await controller.createSession('task-123');

    await controller.destroySession(handle);
    await controller.destroySession(handle);

    expect(views[0].webContents.destroyed).toBe(true);
    await expect(controller.snapshot(handle)).resolves.toBeUndefined();
  });

  it('lists and embeds active browser sessions for the monitor page', async () => {
    const { controller, views } = createHarness();
    await controller.createSession('task-123', 'https://chatgpt.com/');

    expect(controller.listSessions()).toMatchObject([
      {
        taskId: 'task-123',
        partition: 'persist:task-task-123',
        url: 'https://chatgpt.com/',
        embedded: false,
      },
    ]);

    const host = new FakeHostWindow();
    await controller.attachSession('task-123', host, { x: 76, y: 38, width: 900, height: 600 });

    expect(host.contentView.added).toEqual([views[0]]);
    expect(views[0].bounds).toEqual({ x: 76, y: 38, width: 900, height: 600 });
    expect(views[0].visible).toBe(true);
    expect(controller.listSessions()[0]).toMatchObject({ embedded: true });

    await controller.detachSession('task-123', host);

    expect(host.contentView.removed).toEqual([views[0]]);
    expect(views[0].visible).toBe(false);
    expect(controller.listSessions()[0]).toMatchObject({ embedded: false });
  });
});
