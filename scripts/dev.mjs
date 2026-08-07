import { spawn } from 'node:child_process';

const mockServer = spawn('node', ['mock-server.mjs'], { stdio: 'inherit' });
const vite = spawn('vite', [], { stdio: 'inherit', shell: true });

mockServer.on('close', (code) => process.exit(code));
vite.on('close', (code) => process.exit(code));

process.on('SIGINT', () => {
  mockServer.kill();
  vite.kill();
});
