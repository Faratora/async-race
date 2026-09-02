import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const root = join(__dirname, '..');

let vite = null;

(async () => {
  console.log('Starting Vite dev server...');

  vite = spawn('node', ['node_modules/vite/bin/vite.js'], {
    stdio: 'inherit',
    shell: false,
    cwd: root,
  });

  vite.on('close', (code) => {
    process.exit(code);
  });
})();
