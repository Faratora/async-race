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

// Wait for the mock server to be ready before starting Vite
async function waitForServer(url, timeout = 10000, interval = 200) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    try {
      const res = await fetch(url);
      if (res.ok) return true;
    } catch {}
    await new Promise(r => setTimeout(r, interval));
  }
  return false;
}

(async () => {
  const ready = await waitForServer('http://127.0.0.1:3000/api/health');
  if (!ready) {
    console.error('Mock server did not start in time');
    mockServer.kill();
    process.exit(1);
  }

  vite = spawn('npx', ['vite'], { 
    stdio: 'inherit', 
    shell: true 
  });
  
  vite.on('close', (code) => {
    mockServer.kill();
    process.exit(code);
  });
})();

mockServer.on('close', (code) => {
  if (vite) vite.kill();
  process.exit(code);
});
