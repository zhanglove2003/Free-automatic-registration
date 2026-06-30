import { mkdirSync, copyFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

const files = [
  ['src/renderer/index.html', 'dist/src/renderer/index.html'],
  ['src/preload/preload.cjs', 'dist/src/preload/preload.cjs'],
];

for (const [from, to] of files) {
  mkdirSync(dirname(to), { recursive: true });
  copyFileSync(join(process.cwd(), from), join(process.cwd(), to));
}
