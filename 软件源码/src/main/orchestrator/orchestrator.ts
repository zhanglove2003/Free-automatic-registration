import type { AppSettings } from '../../shared/types.js';
import { defaultSettings, validateSettings } from '../domain/settings.js';
import type { AppSnapshot, DashboardStats, RegistrationTask, TaskLogEntry } from '../domain/models.js';
import { InMemoryTaskRepository, type TaskRepository } from '../storage/taskRepository.js';
import { ConfigurationError } from '../domain/errors.js';
import { HeroSmsProvider, waitForSmsCodeOrCancelNumber, type SmsActivation, type SmsProvider, type SmsTimeoutPolicy } from '../providers/smsProvider.js';
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

export interface SettingsStore {
  load(): AppSettings | undefined;
  save(settings: AppSettings): void;
}

export interface SmsCancellationScheduler {
  schedule(provider: SmsProvider, activation: SmsActivation, policy: SmsTimeoutPolicy): void;
}

class NoopSettingsStore implements SettingsStore {
  load(): AppSettings | undefined {
    return undefined;
  }

  save(_settings: AppSettings): void {
    return;
  }
}

class DefaultSmsCancellationScheduler implements SmsCancellationScheduler {
  schedule(provider: SmsProvider, activation: SmsActivation, policy: SmsTimeoutPolicy): void {
    void waitForSmsCodeOrCancelNumber(provider, activation, policy).catch((error) => {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`SmsHero cancellation workflow ended: ${message}`);
    });
  }
}

export class Orchestrator {
  private settings: AppSettings;
  private browserColorScheme: BrowserColorScheme = 'light';

  constructor(
    private readonly repository: TaskRepository = new InMemoryTaskRepository(),
    private readonly browser: BrowserController = new ElectronBrowserController(),
    private readonly smsProvider: SmsProvider = new HeroSmsProvider(),
    private readonly settingsStore: SettingsStore = new NoopSettingsStore(),
    private readonly smsCancellationScheduler: SmsCancellationScheduler = new DefaultSmsCancellationScheduler(),
  ) {
    this.settings = mergeSettings(defaultSettings(), this.settingsStore.load());
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
    this.settingsStore.save(this.settings);
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
      await this.log(task.id, 'info', `Opened browser session ${browser.partition}`);
      tasks.push(task);
    }
    return tasks;
  }

  async testSmsPurchase(): Promise<{ orderId: string; phone: string; country: string; cancelScheduledAt: string }> {
    const validation = validateSettings(this.settings);
    if (!validation.ok) {
      throw new ConfigurationError(validation.errors.join('; '));
    }
    if (!this.settings.sms.apiKey?.trim()) {
      throw new ConfigurationError('sms.apiKey is required for HeroSMS number purchase');
    }

    const activation = await this.smsProvider.acquireNumber(this.settings.sms);
    const policy = {
      codeTimeoutMs: this.settings.sms.codeTimeoutMs,
      cancelDelayMs: this.settings.sms.cancelDelayMs,
    };
    this.smsCancellationScheduler.schedule(this.smsProvider, activation, policy);
    return {
      ...activation,
      cancelScheduledAt: new Date(Date.now() + this.settings.sms.codeTimeoutMs + this.settings.sms.cancelDelayMs).toISOString(),
    };
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
    assertMonitorBrowserTaskId(taskId);
    await this.browser.attachSession(taskId, host, bounds);
  }

  async closeBrowserMonitor(taskId: string): Promise<void> {
    assertMonitorBrowserTaskId(taskId);
    await this.browser.detachSession(taskId);
  }

  async destroyBrowserMonitor(taskId: string): Promise<void> {
    assertMonitorBrowserTaskId(taskId);
    const handle = this.findBrowserHandle(taskId);
    if (!handle) {
      return;
    }
    await this.browser.destroySession(handle);
  }

  async captureBrowser(taskId: string): Promise<Buffer | undefined> {
    assertMonitorBrowserTaskId(taskId);
    const handle = this.findBrowserHandle(taskId);
    if (!handle) {
      return undefined;
    }
    return this.browser.snapshot(handle);
  }

  async openUtilityBrowser(sessionId: string, url: string, host: BrowserHostWindowLike, bounds: BrowserMonitorBounds): Promise<void> {
    const taskId = toUtilityBrowserTaskId(sessionId);
    const existing = this.findBrowserHandle(taskId);
    if (existing) {
      await this.browser.attachSession(taskId, host, bounds);
      return;
    }

    const handle = await this.browser.createSession(taskId);
    try {
      await this.browser.attachSession(taskId, host, bounds);
      await this.browser.navigate(handle, url);
    } catch (error) {
      await this.browser.destroySession(handle);
      throw error;
    }
  }

  async attachUtilityBrowser(sessionId: string, host: BrowserHostWindowLike, bounds: BrowserMonitorBounds): Promise<void> {
    await this.browser.attachSession(toUtilityBrowserTaskId(sessionId), host, bounds);
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
    return this.browser.getSessionHandle(taskId);
  }
}

function mergeSettings(defaults: AppSettings, saved: AppSettings | undefined): AppSettings {
  if (!saved) return defaults;
  return {
    ...defaults,
    ...saved,
    sms: { ...defaults.sms, ...saved.sms },
    captcha: { ...defaults.captcha, ...saved.captcha },
    email: { ...defaults.email, ...saved.email },
    codexManager: {
      directoryExport: { ...defaults.codexManager.directoryExport, ...saved.codexManager?.directoryExport },
      rpcImport: { ...defaults.codexManager.rpcImport, ...saved.codexManager?.rpcImport },
    },
    runtime: { ...defaults.runtime, ...saved.runtime },
  };
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

function assertMonitorBrowserTaskId(taskId: string): void {
  if (isUtilityBrowserTaskId(taskId)) {
    throw new ConfigurationError('monitor browser task id cannot target utility sessions');
  }
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
