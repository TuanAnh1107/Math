import { createApp } from "./app.js";
import { loadConfig } from "./config/env.js";
import { loadServerEnvironment } from './config/environment.js';

try {
  const environment = loadServerEnvironment(import.meta.url);
  const config = loadConfig();
  const server = createApp(config).listen(config.port, config.host, () => {
    console.info(`Math Mentor AI server: http://${config.host}:${config.port} (${config.mode})`);
    console.info(`Browser Origin allowlist (${environment.originSource}): ${config.allowedOrigins.join(', ')}`);
    console.info('Environment is read at startup; npm dev restarts on .env changes. Production/inherited environment changes require restart. Host/Referer/forwarded headers do not grant Origin permission.');
  });
  server.headersTimeout = 10000;
  server.requestTimeout = 30000;
  const stop = () => { server.close(() => process.exit(0)); setTimeout(() => process.exit(1), 5000).unref(); };
  process.once("SIGINT", stop); process.once("SIGTERM", stop);
  server.on("error", () => { console.error("AI server failed to bind. Check HOST and PORT."); process.exitCode = 1; });
} catch {
  // No environment values, request contents or provider errors are logged.
  console.error("AI server configuration is invalid. Check server environment; production requires a verified authentication adapter.");
  process.exitCode = 1;
}
