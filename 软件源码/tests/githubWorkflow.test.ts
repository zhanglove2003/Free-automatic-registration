import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const repositoryRoot = join(process.cwd(), '..');

function readRepositoryFile(relativePath: string): string {
  return readFileSync(join(repositoryRoot, relativePath), 'utf8').replace(/\r\n/g, '\n');
}

describe('GitHub Actions Node CI workflow', () => {
  it('runs Node checks on every push and on PRs targeting main or develop', () => {
    const workflow = readRepositoryFile('.github/workflows/ci.yml');

    expect(workflow).toContain('  push:');
    expect(workflow).not.toContain('push:\n    branches: [main]');
    expect(workflow).toContain('pull_request:\n    branches: [main, develop]');
    expect(workflow).toContain('node-version: 24');
    expect(workflow).toContain('run: npm ci');
    expect(workflow).toContain('run: npm test --if-present');
    expect(workflow).toContain('run: npm run typecheck --if-present');
    expect(workflow).toContain('run: npm run build --if-present');
  });
});
