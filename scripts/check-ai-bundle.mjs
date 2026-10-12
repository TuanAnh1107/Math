import { spawnSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

// This marker is only passed to the Vite build process, never to an AI server/provider.
const marker = 'MATH_MENTOR_BUNDLE_SENTINEL_DO_NOT_USE';
const example = readFileSync('server/.env.example', 'utf8');
const exampleKey = example.match(/^GEMINI_API_KEY[ \t]*=[ \t]*(.*)$/m)?.[1]?.trim();
if (exampleKey && !['""', "''"].includes(exampleKey)) {
  console.error('Secret policy failed: server/.env.example must have an empty GEMINI_API_KEY.');
  process.exit(1);
}
const destination = path.resolve('.cache/gemini-build-verification');
const build = spawnSync(process.execPath, ['node_modules/vite/bin/vite.js', 'build', '--outDir', destination, '--emptyOutDir'], {
  stdio: 'inherit', env: { ...process.env, GEMINI_API_KEY: marker },
});
if (build.status !== 0) process.exit(build.status ?? 1);
const walk = directory => readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
  const filename = path.join(directory, entry.name);
  return entry.isDirectory() ? walk(filename) : [filename];
});
const assets = walk(destination).filter(filename => /\.(js|css|html|map)$/.test(filename));
for (const filename of assets) {
  const source = readFileSync(filename, 'utf8');
  if (source.includes(marker) || /AIza[\w-]{35}|generativelanguage\.googleapis\.com|GoogleGenAI|@google\/genai/.test(source)) {
    console.error(`Frontend isolation check failed: ${path.relative(destination, filename)}`);
    process.exit(1);
  }
}
console.info(`Frontend isolation passed: ${assets.length} text assets checked; no server secret marker or Gemini SDK/provider endpoint.`);
