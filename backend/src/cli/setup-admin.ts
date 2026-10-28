import { getDb } from '../db/connection';
import { runMigrations } from '../db/migrations';
import { createInitialSuperAdmin, hasSuperAdmin } from '../auth/setup';

async function main() {
  const db = getDb();
  runMigrations(db);

  if (hasSuperAdmin(db)) {
    console.log('A Super Admin is already configured.');
    process.exit(0);
  }

  const args = process.argv.slice(2);
  let email = '';
  let password = '';
  let name = '';

  for (const arg of args) {
    if (arg.startsWith('--email=')) email = arg.slice(8);
    else if (arg.startsWith('--password=')) password = arg.slice(11);
    else if (arg.startsWith('--name=')) name = arg.slice(7);
  }

  if (!email || !password || !name) {
    console.error('Usage: tsx backend/src/cli/setup-admin.ts --email=admin@tripmates.local --password=secretPass123 --name="System Administrator"');
    process.exit(1);
  }

  try {
    const { user, person } = createInitialSuperAdmin(db, email, password, name);
    console.log(`Successfully created initial Super Admin: ${user.email} (Person: ${person.display_name}, User ID: ${user.id})`);
  } catch (err) {
    console.error('Failed to set up Super Admin:', (err as Error).message);
    process.exit(1);
  }
}

main();
