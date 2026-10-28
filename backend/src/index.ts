import { createApp } from './app';
import { config } from './config';
import { getDb } from './db/connection';
import { runMigrations } from './db/migrations';

async function startServer() {
  console.log('Connecting to database and running migrations...');
  const db = getDb();
  const { applied, skipped } = runMigrations(db);
  console.log(`Migrations complete. Applied: ${applied.length}, Skipped: ${skipped.length}`);

  const app = createApp();

  app.listen(config.port, '0.0.0.0', () => {
    console.log(`TripMates server running on http://localhost:${config.port} and http://127.0.0.1:${config.port}`);
  });
}

startServer().catch(err => {
  console.error('Fatal error starting TripMates backend:', err);
  process.exit(1);
});
