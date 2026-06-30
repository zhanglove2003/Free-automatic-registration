import type { AccountRecord, AppSettings, TaskStatus } from '../../shared/types.js';

export interface TaskLogEntry {
  taskId: string;
  level: 'info' | 'warn' | 'error';
  message: string;
  at: string;
}

export interface RegistrationTask {
  id: string;
  site: 'chatgpt-openai' | 'generic';
  status: TaskStatus;
  attempts: number;
  createdAt: string;
  updatedAt: string;
  account?: AccountRecord;
  error?: string;
}

export interface DashboardStats {
  running: number;
  queued: number;
  completed: number;
  failed: number;
}

export interface AppSnapshot {
  settings: AppSettings;
  stats: DashboardStats;
  tasks: RegistrationTask[];
  recentLogs: TaskLogEntry[];
}
