import { getDb } from '../db/connection';
import { verifyDatabaseIntegrity } from '../db/backup';

async function run() {
  console.log('--- TripMates Database Verification ---');
  const db = getDb();
  const result = await verifyDatabaseIntegrity(db);

  console.log(`Engine: ${result.stats.engine.toUpperCase()}`);
  console.log(`Status: ${result.ok ? 'SUCCESS (Healthy)' : 'WARNING / FAILURE'}`);
  console.log(`Details: ${result.message}`);
  console.log('\n--- Record Counts ---');
  console.log(`Database Path / Source: ${result.stats.databasePath}`);
  console.log(`Storage Mode: ${result.stats.isPersistentDisk ? 'Persistent Disk / Cloud Managed' : 'Local / Ephemeral'}`);
  if (result.stats.engine === 'sqlite') {
    console.log(`Database Size: ${(result.stats.sizeBytes / 1024).toFixed(2)} KB`);
  }
  console.log(`Users: ${result.stats.usersCount}`);
  console.log(`Persons: ${result.stats.personsCount}`);
  console.log(`Families: ${result.stats.familiesCount}`);
  console.log(`Trips: ${result.stats.tripsCount}`);
  console.log(`Expenses: ${result.stats.expensesCount}`);
  console.log(`Repayments: ${result.stats.repaymentsCount}`);
  console.log(`Family Invite Codes: ${result.stats.familyInviteCodesCount}`);
  console.log(`Audit Logs: ${result.stats.auditLogsCount}`);
  console.log('--------------------------------------');
}

run().catch((err) => {
  console.error('[Verification Error]:', err);
  process.exit(1);
});
