import { describe, expect, it } from 'vitest';
import { assertTransition, nextTaskState } from '../src/main/domain/taskState.js';

describe('task state machine', () => {
  it('allows the documented happy-path transitions', () => {
    expect(nextTaskState('queued', 'start')).toBe('running');
    expect(nextTaskState('running', 'wait')).toBe('waiting');
    expect(nextTaskState('waiting', 'resume')).toBe('running');
    expect(nextTaskState('running', 'succeed')).toBe('ready');
  });

  it('allows any active state to fail', () => {
    expect(nextTaskState('queued', 'fail')).toBe('failed');
    expect(nextTaskState('running', 'fail')).toBe('failed');
    expect(nextTaskState('waiting', 'fail')).toBe('failed');
  });

  it('rejects transitions out of terminal states', () => {
    expect(() => assertTransition('ready', 'start')).toThrow('Invalid task transition: ready -> start');
    expect(() => assertTransition('failed', 'resume')).toThrow('Invalid task transition: failed -> resume');
  });
});
