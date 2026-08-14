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

let vite = null;

// Wait a moment for the mock server to be ready
setTimeout(() => {
  vite = spawn('vite', [], { 
    stdio: 'inherit', 
    shell: true 
  });
  
  vite.on('close', (code) => {
    mockServer.kill();
    process.exit(code);
  });
}, 1500);

mockServer.on('close', (code) => {
  if (vite) vite.kill();
  process.exit(code);
});
