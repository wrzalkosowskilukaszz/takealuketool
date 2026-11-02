/** Small crypto helpers: password hashing (scrypt), constant-time comparison, hashing. */
import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

export function sha256Hex(data: string | Buffer): string {
  return createHash("sha256").update(data).digest("hex");
}

export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

// --- password hashing: "scrypt:N:r:p:saltB64:hashB64" (no "$", which env loaders may expand) ----
export function hashPassword(password: string): string {
  const N = 2 ** 15;
  const r = 8;
  const p = 1;
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, 32, { N, r, p, maxmem: 64 * 1024 * 1024 });
  return `scrypt:${N}:${r}:${p}:${salt.toString("base64")}:${hash.toString("base64")}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const parts = stored.trim().split(/[:$]/);
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;
  const [, n, r, p, saltB64, hashB64] = parts as [string, string, string, string, string, string];
  const expected = Buffer.from(hashB64, "base64");
  const actual = scryptSync(password, Buffer.from(saltB64, "base64"), expected.length, {
    N: Number(n),
    r: Number(r),
    p: Number(p),
    maxmem: 64 * 1024 * 1024,
  });
  return timingSafeEqual(actual, expected);
}
