import { getDb } from '../db/connection';
import { runMigrations } from '../db/migrations';
import { createInitialSuperAdmin, hasSuperAdmin } from '../auth/setup';
import { hashPassword } from '../auth/password';
import { revokeAllUserSessions } from '../auth/session';
import { recordAuditLog } from '../auth/audit';

async function main() {
  const db = getDb();
  runMigrations(db);

  const args = process.argv.slice(2);
  let email = process.env.ADMIN_EMAIL || '';
  let password = process.env.ADMIN_PASSWORD || '';
  let name = process.env.ADMIN_NAME || '';
  let isUpdate = Boolean(process.env.ADMIN_UPDATE);

  for (const arg of args) {
    if (arg.startsWith('--email=')) email = arg.slice(8).trim();
    else if (arg.startsWith('--password=')) password = arg.slice(11).trim();
    else if (arg.startsWith('--name=')) name = arg.slice(7).trim();
    else if (arg === '--update' || arg === '--reset-password') isUpdate = true;
  }

  const existingAdmin = db.prepare(`
    SELECT u.id, u.email, u.role, u.is_active, p.display_name
    FROM users u
    LEFT JOIN persons p ON p.user_id = u.id
    WHERE u.role = 'super_admin'
    ORDER BY u.id ASC
    LIMIT 1
  `).get() as { id: number; email: string; role: string; is_active: number; display_name: string | null } | undefined;

  if (existingAdmin && !isUpdate) {
    console.log(`A Super Admin is already configured: ${existingAdmin.email} (User ID: ${existingAdmin.id}).`);
    console.log('To update password or credentials, run with --update flag:');
    console.log('  npx tsx backend/src/cli/setup-admin.ts --update --password="<newPassword>" [--email="<newEmail>"] [--name="<newName>"]');
    process.exit(0);
  }

  if (existingAdmin && isUpdate) {
    if (!password || password.length < 6) {
      console.error('Error: A secure password with at least 6 characters is required to update admin credentials.');
      process.exit(1);
    }

    const targetEmail = email || existingAdmin.email;
    const newHash = hashPassword(password);

    db.prepare(`
      UPDATE users
      SET password_hash = ?, email = ?, is_active = 1
      WHERE id = ?
    `).run(newHash, targetEmail, existingAdmin.id);

    if (name) {
      db.prepare(`
        UPDATE persons
        SET display_name = ?, is_active = 1
        WHERE user_id = ?
      `).run(name, existingAdmin.id);
    }

    // Revoke all existing sessions for security
    revokeAllUserSessions(db, existingAdmin.id);

    recordAuditLog(db, existingAdmin.id, 'CLI_SUPER_ADMIN_PASSWORD_RESET', 'users', existingAdmin.id, null, {
      updated_email: targetEmail,
      updated_name: name || existingAdmin.display_name,
    });

    console.log(`Successfully updated Super Admin credentials for ${targetEmail}.`);
    console.log('All previous active sessions have been revoked for security.');
    process.exit(0);
  }

  // Creating first-time Super Admin
  if (!email || !password || !name) {
    console.error('Usage for bootstrap:');
    console.error('  npx tsx backend/src/cli/setup-admin.ts --email=admin@example.com --password="<securePassword>" --name="Administrator"');
    console.error('Or provide ADMIN_EMAIL, ADMIN_PASSWORD, and ADMIN_NAME environment variables.');
    process.exit(1);
  }

  if (password.length < 6) {
    console.error('Error: Password must be at least 6 characters.');
    process.exit(1);
  }

  try {
    const { user, person } = createInitialSuperAdmin(db, email, password, name);
    console.log(`Successfully bootstrapped initial Super Admin: ${user.email} (Person: ${person.display_name}, User ID: ${user.id}).`);
  } catch (err) {
    console.error('Failed to set up Super Admin:', (err as Error).message);
    process.exit(1);
  }
}

main();
