import type { AppSettings } from '../../shared/types.js';
import { defaultSettings, validateSettings } from '../domain/settings.js';
import type { AppSnapshot, DashboardStats, RegistrationTask, TaskLogEntry } from '../domain/models.js';
import { InMemoryTaskRepository, type TaskRepository } from '../storage/taskRepository.js';
import { ConfigurationError } from '../domain/errors.js';
import {
  ElectronBrowserController,
  type BrowserController,
  type BrowserColorScheme,
  type BrowserHostWindowLike,
  type BrowserMonitorBounds,
  type BrowserSessionHandle,
} from '../browser/browserController.js';

const DEFAULT_BROWSER_START_URL = 'https://chatgpt.com/';
const UTILITY_BROWSER_PREFIX = 'utility-';

export interface CreateJobInput {
  count: number;
  site: RegistrationTask['site'];
}

export class Orchestrator {
  private settings: AppSettings;
  private browserColorScheme: BrowserColorScheme = 'light';

  constructor(
    private readonly repository: TaskRepository = new InMemoryTaskRepository(),
    private readonly browser: BrowserController = new ElectronBrowserController(),
  ) {
    this.settings = defaultSettings();
  }

  getSettings(): AppSettings {
    return structuredClone(this.settings);
  }

  updateSettings(settings: AppSettings): void {
    const validation = validateSettings(settings);
    if (!validation.ok) {
      throw new ConfigurationError(validation.errors.join('; '));
    }
    this.settings = structuredClone(settings);
  }

  async createJob(input: CreateJobInput): Promise<RegistrationTask[]> {
    if (input.count < 1) {
      throw new ConfigurationError('job count must be at least 1');
    }

    const tasks: RegistrationTask[] = [];
    for (let index = 0; index < input.count; index += 1) {
      const now = new Date().toISOString();
      const task: RegistrationTask = {
        id: crypto.randomUUID(),
        site: input.site,
        status: 'queued',
        attempts: 0,
        createdAt: now,
        updatedAt: now,
      };
      await this.repository.create(task);
      await this.log(task.id, 'info', `Queued ${task.site} registration task`);
      const browser = await this.browser.createSession(task.id, DEFAULT_BROWSER_START_URL);
      await this.browser.setColorScheme(this.browserColorScheme);
      await this.log(task.id, 'info', `Opened browser session ${browser.partition}`);
      tasks.push(task);
    }
    return tasks;
  }

  async snapshot(): Promise<AppSnapshot> {
    const tasks = await this.repository.list();
    return {
      settings: this.getSettings(),
      stats: toStats(tasks),
      tasks,
      recentLogs: await this.repository.recentLogs(20),
      browserSessions: this.browser.listSessions().filter((session) => !isUtilityBrowserTaskId(session.taskId)),
    };
  }

  async openBrowserMonitor(taskId: string, host: BrowserHostWindowLike, bounds: BrowserMonitorBounds): Promise<void> {
    await this.browser.attachSession(taskId, host, bounds);
  }

  async closeBrowserMonitor(taskId: string): Promise<void> {
    await this.browser.detachSession(taskId);
  }

  async destroyBrowserMonitor(taskId: string): Promise<void> {
    const handle = this.findBrowserHandle(taskId);
    if (!handle) {
      return;
    }
    await this.browser.destroySession(handle);
  }

  async captureBrowser(taskId: string): Promise<Buffer | undefined> {
    const handle = this.findBrowserHandle(taskId);
    if (!handle) {
      return undefined;
    }
    return this.browser.snapshot(handle);
  }

  async openUtilityBrowser(sessionId: string, url: string, host: BrowserHostWindowLike, bounds: BrowserMonitorBounds): Promise<void> {
    const taskId = toUtilityBrowserTaskId(sessionId);
    const existing = this.findBrowserHandle(taskId);
    const handle = existing ?? await this.browser.createSession(taskId, url);
    if (!existing) {
      await this.browser.setColorScheme(this.browserColorScheme);
    }
    await this.browser.attachSession(taskId, host, bounds);
  }

  async setBrowserColorScheme(scheme: BrowserColorScheme): Promise<void> {
    this.browserColorScheme = scheme;
    await this.browser.setColorScheme(scheme);
  }

  async closeUtilityBrowser(sessionId: string): Promise<void> {
    await this.browser.detachSession(toUtilityBrowserTaskId(sessionId));
  }

  async goUtilityBrowserBack(sessionId: string): Promise<void> {
    const handle = this.findBrowserHandle(toUtilityBrowserTaskId(sessionId));
    if (!handle) return;
    await this.browser.goBack(handle);
  }

  async goUtilityBrowserForward(sessionId: string): Promise<void> {
    const handle = this.findBrowserHandle(toUtilityBrowserTaskId(sessionId));
    if (!handle) return;
    await this.browser.goForward(handle);
  }

  async reloadUtilityBrowser(sessionId: string): Promise<void> {
    const handle = this.findBrowserHandle(toUtilityBrowserTaskId(sessionId));
    if (!handle) return;
    await this.browser.reload(handle);
  }

  private async log(taskId: string, level: TaskLogEntry['level'], message: string): Promise<void> {
    await this.repository.appendLog({
      taskId,
      level,
      message,
      at: new Date().toISOString(),
    });
  }

  private findBrowserHandle(taskId: string): BrowserSessionHandle | undefined {
    return this.browser.listSessions().find((session) => session.taskId === taskId);
  }
}

function toUtilityBrowserTaskId(sessionId: string): string {
  const normalized = sessionId.trim().toLowerCase();
  if (!/^[a-z0-9-]+$/.test(normalized)) {
    throw new ConfigurationError('utility browser session id contains invalid characters');
  }
  return `${UTILITY_BROWSER_PREFIX}${normalized}`;
}

function isUtilityBrowserTaskId(taskId: string): boolean {
  return taskId.startsWith(UTILITY_BROWSER_PREFIX);
}

function toStats(tasks: RegistrationTask[]): DashboardStats {
  const stats: DashboardStats = { running: 0, queued: 0, completed: 0, failed: 0 };
  for (const task of tasks) {
    if (task.status === 'running' || task.status === 'waiting') stats.running += 1;
    else if (task.status === 'queued') stats.queued += 1;
    else if (task.status === 'ready') stats.completed += 1;
    else if (task.status === 'failed') stats.failed += 1;
  }
  return stats;
}
