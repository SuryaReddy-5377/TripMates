import crypto from 'node:crypto';

export function hashPassword(password: string): string {
  if (!password || password.length < 6) {
    throw new Error('Password must be at least 6 characters long');
  }
  const salt = crypto.randomBytes(16).toString('hex');
  const derivedKey = crypto.scryptSync(password, salt, 64);
  return `scrypt$${salt}$${derivedKey.toString('hex')}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  if (!password || !storedHash) return false;
  const parts = storedHash.split('$');
  if (parts.length !== 3 || parts[0] !== 'scrypt') {
    // If not our scrypt format, fallback to direct compare for testing dummy hashes if needed
    return false;
  }
  const [, salt, originalKeyHex] = parts;
  try {
    const originalKey = Buffer.from(originalKeyHex, 'hex');
    const derivedKey = crypto.scryptSync(password, salt, 64);
    return crypto.timingSafeEqual(originalKey, derivedKey);
  } catch {
    return false;
  }
}
