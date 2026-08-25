import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const root = join(__dirname, '..');

let apiServer = null;
let restartAttempts = 0;
const MAX_RESTARTS = 2;

function startApiServer() {
  apiServer = spawn('node', ['async-race-api/index.js'], {
    stdio: 'inherit',
    cwd: root,
    shell: true,
  });

  apiServer.on('error', (err) => {
    if (err.code === 'EADDRINUSE' || err.message.includes('EADDRINUSE')) {
      console.error('Port 3000 is already in use. Trying to free it...');
      freePort(3000);
      if (restartAttempts < MAX_RESTARTS) {
        restartAttempts++;
        console.log(`Restarting API server (attempt ${restartAttempts}/${MAX_RESTARTS})...`);
        setTimeout(startApiServer, 1000);
      } else {
        console.error('Could not start API server. Please free port 3000 manually and try again.');
        process.exit(1);
      }
    } else {
      console.error('API server error:', err);
    }
  });

  apiServer.on('close', (code) => {
    if (code !== 0 && code !== null && vite) {
      console.error(`API server exited with code ${code}`);
      vite.kill();
      process.exit(1);
    }
  });
}

function freePort(port) {
  try {
    const { execSync } = require('node:child_process');
    const command = `netstat -ano | findstr :${port}`;
    const output = execSync(command, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] });
    const lines = output.split('\n').filter(line => line.includes('LISTENING'));
    for (const line of lines) {
      const parts = line.trim().split(/\s+/);
      const pid = parts[parts.length - 1];
      if (pid && pid !== '0') {
        console.log(`Killing process ${pid} on port ${port}`);
        execSync(`taskkill /F /PID ${pid}`, { stdio: 'ignore' });
      }
    }
  } catch {
    // ignore errors if no process found or command fails
  }
}

let vite = null;

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
  startApiServer();

  const ready = await waitForServer('http://127.0.0.1:3000/garage');
  if (!ready) {
    console.error('API server did not start in time');
    if (apiServer) apiServer.kill();
    process.exit(1);
  }

  vite = spawn('npx', ['vite'], { 
    stdio: 'inherit', 
    shell: true 
  });
  
  vite.on('close', (code) => {
    if (apiServer) apiServer.kill();
    process.exit(code);
  });
})();
