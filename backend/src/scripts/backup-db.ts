import { getDb } from '../db/connection';
import { createDatabaseBackup } from '../db/backup';

function run() {
  console.log('--- Creating TripMates Database Backup ---');
  const db = getDb();
  try {
    const { backupPath, stats } = createDatabaseBackup(db);
    console.log(`[Backup Success] Created snapshot at: ${backupPath}`);
    console.log(`Database Size: ${(stats.sizeBytes / 1024).toFixed(2)} KB`);
    console.log(`Verified Records: ${stats.usersCount} users, ${stats.tripsCount} trips, ${stats.expensesCount} expenses, ${stats.familyInviteCodesCount} invite codes.`);
  } catch (err: any) {
    console.error(`[Backup Failed] Error: ${err.message}`);
    process.exit(1);
  }
}

run();

