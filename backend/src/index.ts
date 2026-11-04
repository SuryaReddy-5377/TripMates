import { createApp } from './app';
import { config } from './config';
import { getDb } from './db/connection';
import { runMigrations } from './db/migrations';

async function startServer() {
  if (config.nodeEnv === 'production' && !config.isPostgres) {
    console.warn('\n*******************************************************************************');
    console.warn('⚠️  CRITICAL PRODUCTION WARNING: DATABASE_URL IS NOT SET!');
    console.warn('TripMates is running in production mode with local SQLite on an ephemeral disk.');
    console.warn('If hosted on Render Free tier, ALL SAVED DATA WILL BE LOST on container sleep/restart.');
    console.warn('ACTION REQUIRED: Set DATABASE_URL in Render Dashboard to your Neon PostgreSQL string.');
    console.warn('*******************************************************************************\n');
  } else if (config.isPostgres) {
    console.log('[TripMates] Storage: Neon PostgreSQL Managed Database (Persistent, ACID Transactions Active)');
  }

  console.log('Connecting to database and running migrations...');
  const db = getDb();
  const { applied, skipped } = await runMigrations(db);
  console.log(`Migrations complete. Applied: ${applied.length}, Skipped: ${skipped.length}`);

  const app = createApp();

  app.listen(config.port, '0.0.0.0', () => {
    console.log(`TripMates server running on port ${config.port} bound to 0.0.0.0 (http://0.0.0.0:${config.port})`);
  });
}

startServer().catch(err => {
  console.error('Fatal error starting TripMates backend:', err);
  process.exit(1);
});
