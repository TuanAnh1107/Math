/** Compare URL origins, never Host/Referer/forwarded headers. Paths are not origins. */
export function normalizeOrigin(value: string, configuration = false): string | null {
  if (!value || value.length > 2048 || value === 'null' || value !== value.trim() || /[\\\s]/.test(value)) return null;
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash || url.pathname !== '/') return null;
    // Config permits a single trailing slash; browser Origin must have no path at all.
    const authority = value.match(/^https?:\/\/([^/?#]+)(\/?)$/i);
    if (!authority || !configuration && authority[2]) return null;
    return url.origin;
  } catch { return null; }
}

export function parseAllowedOrigins(value?: string): string[] {
  const raw = value === undefined ? 'http://localhost:8443,http://127.0.0.1:8443' : value;
  if (!raw.trim() || raw.length > 8192) throw new Error('Invalid server configuration: ALLOWED_ORIGINS');
  const entries = raw.split(',');
  if (entries.length > 64) throw new Error('Invalid server configuration: ALLOWED_ORIGINS');
  const origins = entries.map(entry => normalizeOrigin(entry.trim(), true));
  if (origins.some(origin => !origin)) throw new Error('Invalid server configuration: ALLOWED_ORIGINS');
  return [...new Set(origins as string[])];
}
