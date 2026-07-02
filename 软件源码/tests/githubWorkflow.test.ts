import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const repositoryRoot = new URL('../../', import.meta.url);

function readRepositoryFile(relativePath: string): string {
  return readFileSync(new URL(relativePath, repositoryRoot), 'utf8').replace(/\r\n/g, '\n');
}

function readWorkflowEventBlock(workflow: string, eventName: string): string {
  const match = workflow.match(new RegExp(`^  ${eventName}:\\s*(?<body>(?:\\n(?: {4,}.*|\\s*#.*|\\s*$))*)`, 'm'));

  return match?.groups?.body ?? '';
}

describe('GitHub Actions Node CI workflow', () => {
  it('runs Node checks on every push and on PRs targeting main or develop', () => {
    const workflow = readRepositoryFile('.github/workflows/ci.yml');
    const pushBlock = readWorkflowEventBlock(workflow, 'push');

    expect(workflow).toMatch(/^  push:\s*(?:\n  pull_request:|\n\s*#)/m);
    expect(pushBlock).not.toMatch(/^\s+branches:/m);
    expect(workflow).toContain('pull_request:\n    branches: [main, develop]');
    expect(workflow).toContain('node-version: 24');
    expect(workflow).toContain('run: npm ci');
    expect(workflow).toContain('run: npm test --if-present');
    expect(workflow).toContain('run: npm run typecheck --if-present');
    expect(workflow).toContain('run: npm run build --if-present');
  });

  it('keeps Node runtime and TypeScript Node types on the same major version', () => {
    const packageJson = JSON.parse(readRepositoryFile('软件源码/package.json')) as {
      devDependencies: Record<string, string>;
    };

    expect(packageJson.devDependencies['@types/node']).toMatch(/^\^24\./);
  });
});
