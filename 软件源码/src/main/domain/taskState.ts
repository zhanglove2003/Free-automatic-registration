import type { TaskStatus } from '../../shared/types.js';

export type TaskEvent = 'start' | 'wait' | 'resume' | 'succeed' | 'fail' | 'cancel';

const transitions: Record<TaskStatus, Partial<Record<TaskEvent, TaskStatus>>> = {
  queued: {
    start: 'running',
    fail: 'failed',
    cancel: 'cancelled',
  },
  running: {
    wait: 'waiting',
    succeed: 'ready',
    fail: 'failed',
    cancel: 'cancelled',
  },
  waiting: {
    resume: 'running',
    fail: 'failed',
    cancel: 'cancelled',
  },
  ready: {},
  failed: {},
  cancelled: {},
};

export function assertTransition(from: TaskStatus, event: TaskEvent): TaskStatus {
  const next = transitions[from][event];
  if (!next) {
    throw new Error(`Invalid task transition: ${from} -> ${event}`);
  }
  return next;
}

/** @deprecated Use assertTransition directly. */
export const nextTaskState = assertTransition;
