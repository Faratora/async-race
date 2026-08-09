import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const root = join(__dirname, '..');

const mockServer = spawn('npx', ['tsx', 'server/mock-server.ts'], {
  stdio: 'inherit',
  cwd: root,
  shell: true,
});
const vite = spawn('vite', [], { stdio: 'inherit', shell: true });

mockServer.on('close', (code) => process.exit(code));
vite.on('close', (code) => process.exit(code));

process.on('SIGINT', () => {
  mockServer.kill();
  vite.kill();
});
