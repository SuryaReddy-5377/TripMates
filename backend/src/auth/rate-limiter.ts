interface AttemptRecord {
  count: number;
  firstAttemptAt: number;
  lockedUntil?: number;
}

const attemptsMap = new Map<string, AttemptRecord>();

const MAX_FAILED_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const LOCKOUT_MS = 15 * 60 * 1000; // 15 minutes lockout

export function checkRateLimit(key: string): { allowed: boolean; remaining: number; retryAfterSeconds?: number } {
  const now = Date.now();
  const record = attemptsMap.get(key);

  if (!record) {
    return { allowed: true, remaining: MAX_FAILED_ATTEMPTS };
  }

  // If locked out
  if (record.lockedUntil && record.lockedUntil > now) {
    const retryAfterSeconds = Math.ceil((record.lockedUntil - now) / 1000);
    return { allowed: false, remaining: 0, retryAfterSeconds };
  }

  // If window expired, reset
  if (now - record.firstAttemptAt > WINDOW_MS) {
    attemptsMap.delete(key);
    return { allowed: true, remaining: MAX_FAILED_ATTEMPTS };
  }

  const remaining = Math.max(0, MAX_FAILED_ATTEMPTS - record.count);
  return { allowed: remaining > 0, remaining };
}

export function recordFailedAttempt(key: string): { remaining: number; locked: boolean; retryAfterSeconds?: number } {
  const now = Date.now();
  const record = attemptsMap.get(key);

  if (!record || now - record.firstAttemptAt > WINDOW_MS) {
    attemptsMap.set(key, { count: 1, firstAttemptAt: now });
    return { remaining: MAX_FAILED_ATTEMPTS - 1, locked: false };
  }

  record.count += 1;
  if (record.count >= MAX_FAILED_ATTEMPTS) {
    record.lockedUntil = now + LOCKOUT_MS;
    const retryAfterSeconds = Math.ceil(LOCKOUT_MS / 1000);
    return { remaining: 0, locked: true, retryAfterSeconds };
  }

  return { remaining: MAX_FAILED_ATTEMPTS - record.count, locked: false };
}

export function clearRateLimit(key: string): void {
  attemptsMap.delete(key);
}
