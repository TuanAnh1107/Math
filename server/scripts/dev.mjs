import { spawn } from 'node:child_process';
import { watchFile, unwatchFile } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(new URL('../package.json', import.meta.url));
const directory = fileURLToPath(new URL('../', import.meta.url));
const envFile = fileURLToPath(new URL('../.env', import.meta.url));
const child = spawn(process.execPath, [require.resolve('tsx/cli'), 'watch', '--clear-screen=false', 'src/index.ts'], {
  cwd: directory, stdio: ['pipe', 'inherit', 'inherit'], env: process.env, windowsHide: true,
});
let closing = false;
// tsx ignores dotfiles even with --include. Poll metadata only, never credential contents.
watchFile(envFile, { interval: 500 }, (current, previous) => {
  if (closing || current.mtimeMs === previous.mtimeMs && current.size === previous.size) return;
  console.info('server/.env changed; restarting AI process to reload configuration.');
  if (child.stdin.writable) child.stdin.write('\n');
});
const input = data => { if (!closing && child.stdin.writable) child.stdin.write(data); };
process.stdin.on('data', input);
const stop = () => {
  if (closing) return;
  closing = true; unwatchFile(envFile); process.stdin.off('data', input); process.stdin.pause();
  child.kill('SIGTERM');
};
process.once('SIGINT', stop); process.once('SIGTERM', stop);
child.stdin.on('error', () => { /* A departing watcher cannot receive another restart. */ });
child.once('error', () => { console.error('AI development watcher failed to start. Check server dependencies.'); stop(); process.exitCode = 1; });
child.once('exit', code => { unwatchFile(envFile); process.stdin.off('data', input); process.stdin.pause(); process.exitCode = code ?? 0; });
