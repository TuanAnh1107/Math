import { config as dotenv } from 'dotenv';
import { fileURLToPath } from 'node:url';

export function serverEnvPath(entryUrl: string): string {
  const compiled = new URL(entryUrl).pathname.includes('/dist/server/src/');
  return fileURLToPath(new URL(compiled ? '../../../.env' : '../.env', entryUrl));
}

/** Keep deployment environment authoritative; report precedence without revealing secrets. */
export function loadServerEnvironment(entryUrl: string, target: NodeJS.ProcessEnv = process.env) {
  const inheritedOrigins = target.ALLOWED_ORIGINS !== undefined;
  const result = dotenv({ path: serverEnvPath(entryUrl), processEnv: target, override: false, quiet: true });
  if (result.error && (result.error as NodeJS.ErrnoException).code !== 'ENOENT') {
    throw new Error('Unable to read server environment file');
  }
  return {
    fileLoaded: !result.error,
    originSource: inheritedOrigins ? 'process environment' : result.parsed?.ALLOWED_ORIGINS !== undefined ? 'server/.env' : 'defaults',
  };
}
