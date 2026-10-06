// Mirrors the sign-in system's password policy: minimum 6 characters, no required
// character classes; leaked passwords are rejected by the server (HIBP check).
// Keep in sync with supabase/functions/_shared/passwordPolicy.ts.
export const PASSWORD_MIN_LENGTH = 6;
export const PASSWORD_MAX_LENGTH = 72;

export function isPasswordAcceptable(password: string): boolean {
  return password.length >= PASSWORD_MIN_LENGTH && password.length <= PASSWORD_MAX_LENGTH;
}

/** 0 = empty, 1 = too short, 2 = weak, 3 = fair, 4 = strong. Guidance only, not enforced. */
export function passwordStrength(password: string): 0 | 1 | 2 | 3 | 4 {
  if (!password) return 0;
  if (password.length < PASSWORD_MIN_LENGTH) return 1;
  let variety = 0;
  if (/[a-z]/.test(password)) variety++;
  if (/[A-Z]/.test(password)) variety++;
  if (/\d/.test(password)) variety++;
  if (/[^A-Za-z0-9]/.test(password)) variety++;
  if (password.length >= 12 && variety >= 3) return 4;
  if (password.length >= 8 && variety >= 2) return 3;
  return 2;
}
