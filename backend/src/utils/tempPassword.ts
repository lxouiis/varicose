import crypto from 'crypto';

// Minimum length enforced on any newly-chosen password (self-service reset,
// and by construction, every generated temp password). Kept in one place so
// the admin-reset generator and the change-password validator can't drift.
export const MIN_PASSWORD_LENGTH = 8;

// Alphanumeric only, with ambiguous characters (0/O, 1/l/I) removed — an
// admin may need to read this aloud or write it on a sticky note for a
// doctor to type in, so it needs to survive that without transcription
// errors. No symbols, for the same reason (dictating "at sign" over the
// phone is worse than a longer alphanumeric string).
const CHARSET = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';

/**
 * Generates a cryptographically random temporary password. Never persisted
 * in plaintext anywhere — the caller must hash it before storing, and must
 * not pass it to logAudit() or console.log().
 */
export function generateTempPassword(length = 12): string {
  const bytes = crypto.randomBytes(length);
  let out = '';
  for (let i = 0; i < length; i++) {
    out += CHARSET[bytes[i] % CHARSET.length];
  }
  return out;
}
