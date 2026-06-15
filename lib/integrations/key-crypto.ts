import "server-only";
import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  scryptSync,
} from "node:crypto";

/**
 * Reversible encryption for API keys so the dashboard can show/copy a key more
 * than once (unlike the SHA-256 hash, which is one-way and only used for
 * verification). AES-256-GCM, authenticated. The encryption key is DERIVED from
 * an existing server secret (the Supabase service-role key) — no new env var to
 * configure — so a database dump alone never exposes API keys; an attacker also
 * needs the app's server secret.
 *
 * Blob layout (base64): [12-byte IV][16-byte GCM tag][ciphertext].
 */

const IV_LEN = 12;
const TAG_LEN = 16;
let cachedKey: Buffer | null = null;

function encKey(): Buffer {
  if (cachedKey) return cachedKey;
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) throw new Error("key-crypto: SUPABASE_SERVICE_ROLE_KEY is not set");
  // Fixed salt: derivation must be deterministic so any instance can decrypt.
  cachedKey = scryptSync(secret, "baam-review.apikey.enc.v1", 32);
  return cachedKey;
}

export function encryptApiKey(plaintext: string): string {
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv("aes-256-gcm", encKey(), iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString("base64");
}

export function decryptApiKey(blob: string): string {
  const buf = Buffer.from(blob, "base64");
  const iv = buf.subarray(0, IV_LEN);
  const tag = buf.subarray(IV_LEN, IV_LEN + TAG_LEN);
  const enc = buf.subarray(IV_LEN + TAG_LEN);
  const decipher = createDecipheriv("aes-256-gcm", encKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString("utf8");
}
