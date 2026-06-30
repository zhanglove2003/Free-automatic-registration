import type { AppSettings } from '../../shared/types.js';
import { defaultSettings, validateSettings } from '../domain/settings.js';
import type { AppSnapshot, DashboardStats, RegistrationTask, TaskLogEntry } from '../domain/models.js';
import { InMemoryTaskRepository, type TaskRepository } from '../storage/taskRepository.js';
import { ConfigurationError } from '../domain/errors.js';

export interface CreateJobInput {
  count: number;
  site: RegistrationTask['site'];
}

export class Orchestrator {
  private settings: AppSettings;

  constructor(private readonly repository: TaskRepository = new InMemoryTaskRepository()) {
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
    };
  }

  private async log(taskId: string, level: TaskLogEntry['level'], message: string): Promise<void> {
    await this.repository.appendLog({
      taskId,
      level,
      message,
      at: new Date().toISOString(),
    });
  }
}

function toStats(tasks: RegistrationTask[]): DashboardStats {
  return {
    running: tasks.filter((task) => task.status === 'running' || task.status === 'waiting').length,
    queued: tasks.filter((task) => task.status === 'queued').length,
    completed: tasks.filter((task) => task.status === 'ready').length,
    failed: tasks.filter((task) => task.status === 'failed').length,
  };
}
