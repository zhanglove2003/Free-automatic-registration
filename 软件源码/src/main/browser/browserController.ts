export interface BrowserSessionHandle {
  taskId: string;
  partition: string;
}

export interface BrowserController {
  createSession(taskId: string): Promise<BrowserSessionHandle>;
  destroySession(handle: BrowserSessionHandle): Promise<void>;
  snapshot(handle: BrowserSessionHandle): Promise<Buffer | undefined>;
}

export class ElectronBrowserController implements BrowserController {
  async createSession(taskId: string): Promise<BrowserSessionHandle> {
    return {
      taskId,
      partition: `persist:task-${taskId}`,
    };
  }

  async destroySession(_handle: BrowserSessionHandle): Promise<void> {
    return;
  }

  async snapshot(_handle: BrowserSessionHandle): Promise<Buffer | undefined> {
    return undefined;
  }
}
