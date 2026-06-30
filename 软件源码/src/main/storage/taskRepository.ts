import type { RegistrationTask, TaskLogEntry } from '../domain/models.js';

export interface TaskRepository {
  create(task: RegistrationTask): Promise<void>;
  update(task: RegistrationTask): Promise<void>;
  list(): Promise<RegistrationTask[]>;
  findById(taskId: string): Promise<RegistrationTask | undefined>;
  appendLog(entry: TaskLogEntry): Promise<void>;
  recentLogs(limit: number): Promise<TaskLogEntry[]>;
}

export class InMemoryTaskRepository implements TaskRepository {
  private readonly tasks = new Map<string, RegistrationTask>();
  private readonly logs: TaskLogEntry[] = [];

  async create(task: RegistrationTask): Promise<void> {
    this.tasks.set(task.id, task);
  }

  async update(task: RegistrationTask): Promise<void> {
    this.tasks.set(task.id, task);
  }

  async list(): Promise<RegistrationTask[]> {
    return [...this.tasks.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  async findById(taskId: string): Promise<RegistrationTask | undefined> {
    return this.tasks.get(taskId);
  }

  async appendLog(entry: TaskLogEntry): Promise<void> {
    this.logs.unshift(entry);
  }

  async recentLogs(limit: number): Promise<TaskLogEntry[]> {
    return this.logs.slice(0, limit);
  }
}
