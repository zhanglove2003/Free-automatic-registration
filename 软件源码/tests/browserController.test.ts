import { describe, expect, it } from 'vitest';
import { ElectronBrowserController, type BrowserWindowFactory } from '../src/main/browser/browserController.js';

class FakeNativeImage {
  constructor(private readonly bytes: Buffer) {}

  toPNG(): Buffer {
    return this.bytes;
  }
}

class FakeBrowserWindow {
  readonly loadedUrls: string[] = [];
  readonly capturedPages: Array<Record<string, never>> = [];
  closed = false;

  constructor(readonly options: Record<string, unknown>) {}

  async loadURL(url: string): Promise<void> {
    this.loadedUrls.push(url);
  }

  async capturePage(): Promise<FakeNativeImage> {
    this.capturedPages.push({});
    return new FakeNativeImage(Buffer.from('png-bytes'));
  }

  close(): void {
    this.closed = true;
  }

  isDestroyed(): boolean {
    return this.closed;
  }
}

function createHarness(): { controller: ElectronBrowserController; windows: FakeBrowserWindow[] } {
  const windows: FakeBrowserWindow[] = [];
  const factory: BrowserWindowFactory = (options) => {
    const window = new FakeBrowserWindow(options as Record<string, unknown>);
    windows.push(window);
    return window;
  };

  return {
    controller: new ElectronBrowserController(factory),
    windows,
  };
}

describe('ElectronBrowserController', () => {
  it('creates a hidden task-scoped Chromium session with safe web preferences', async () => {
    const { controller, windows } = createHarness();

    const handle = await controller.createSession('task-123');

    expect(handle).toEqual({
      taskId: 'task-123',
      partition: 'persist:task-task-123',
    });
    expect(windows).toHaveLength(1);
    expect(windows[0].options).toMatchObject({
      show: false,
      autoHideMenuBar: true,
      webPreferences: {
        partition: 'persist:task-task-123',
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
      },
    });
  });

  it('navigates to the initial URL when a session is created with a URL', async () => {
    const { controller, windows } = createHarness();

    await controller.createSession('task-123', 'https://chatgpt.com/');

    expect(windows[0].loadedUrls).toEqual(['https://chatgpt.com/']);
  });

  it('navigates an existing session using the same window', async () => {
    const { controller, windows } = createHarness();
    const handle = await controller.createSession('task-123');

    await controller.navigate(handle, 'https://auth.openai.com/');

    expect(windows).toHaveLength(1);
    expect(windows[0].loadedUrls).toEqual(['https://auth.openai.com/']);
  });

  it('captures a PNG snapshot from the session window', async () => {
    const { controller, windows } = createHarness();
    const handle = await controller.createSession('task-123');

    const bytes = await controller.snapshot(handle);

    expect(bytes).toEqual(Buffer.from('png-bytes'));
    expect(windows[0].capturedPages).toHaveLength(1);
  });

  it('closes and unregisters sessions, and repeated destroy is harmless', async () => {
    const { controller, windows } = createHarness();
    const handle = await controller.createSession('task-123');

    await controller.destroySession(handle);
    await controller.destroySession(handle);

    expect(windows[0].closed).toBe(true);
    await expect(controller.snapshot(handle)).resolves.toBeUndefined();
  });
});
