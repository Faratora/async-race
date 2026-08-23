import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const root = join(__dirname, '..');

const apiServer = spawn('node', ['server/async-race-api/index.js'], {
  stdio: 'inherit',
  cwd: root,
  shell: true,
});

let vite = null;

// Wait for the API server to be ready before starting Vite
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
  const ready = await waitForServer('http://127.0.0.1:3000/garage');
  if (!ready) {
    console.error('API server did not start in time');
    apiServer.kill();
    process.exit(1);
  }

  vite = spawn('npx', ['vite'], { 
    stdio: 'inherit', 
    shell: true 
  });
  
  vite.on('close', (code) => {
    apiServer.kill();
    process.exit(code);
  });
})();

apiServer.on('close', (code) => {
  if (vite) vite.kill();
  process.exit(code);
});
