/**
 * @module main
 *
 * Application entry point.
 * Boots the Express server and registers graceful shutdown handlers.
 */

import { createApp } from './app';
import { env }       from './config/env';

const { app, logRepo } = createApp();

const server = app.listen(env.PORT, () => {
  console.log(`
  ╔══════════════════════════════════════════╗
  ║         🌸  Blossom API  🌸              ║
  ╠══════════════════════════════════════════╣
  ║  Port    : ${String(env.PORT).padEnd(30)}║
  ║  Env     : ${env.NODE_ENV.padEnd(30)}║
  ║  Docs    : http://localhost:${env.PORT}/docs${' '.repeat(Math.max(0, 13 - String(env.PORT).length))}║
  ║  Health  : http://localhost:${env.PORT}/health${' '.repeat(Math.max(0, 11 - String(env.PORT).length))}║
  ╚══════════════════════════════════════════╝
  `);
});

// ── Graceful shutdown ─────────────────────────────────────────────────────────

function shutdown(signal: string): void {
  console.log(`\n[shutdown] Received ${signal}. Closing server gracefully…`);

  server.close(() => {
    logRepo.close();
    console.log('[shutdown] Server closed. Goodbye! 👋');
    process.exit(0);
  });

  // Force exit after 10 s if graceful shutdown stalls
  setTimeout(() => {
    console.error('[shutdown] Forced exit after timeout.');
    process.exit(1);
  }, 10_000);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));

process.on('unhandledRejection', (reason) => {
  console.error('[unhandledRejection]', reason);
});

process.on('uncaughtException', (err) => {
  console.error('[uncaughtException]', err);
  process.exit(1);
});
