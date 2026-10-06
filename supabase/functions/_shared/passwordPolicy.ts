// Mirrors the sign-in system's password policy (checked 2026-10-06):
// minimum 6 characters, no required character classes, leaked-password (HIBP) check on.
// The leaked-password check can only run inside the auth server, so createUser reports it.
// Keep in sync with src/lib/passwordPolicy.ts.
export const PASSWORD_MIN_LENGTH = 6;
export const PASSWORD_MAX_LENGTH = 72;

export function checkPassword(password: unknown): "weak_password" | null {
  if (typeof password !== "string") return "weak_password";
  if (password.length < PASSWORD_MIN_LENGTH || password.length > PASSWORD_MAX_LENGTH) return "weak_password";
  return null;
}
