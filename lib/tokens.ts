import "server-only";
import { customAlphabet } from "nanoid";

// URL-safe alphabet without ambiguous chars (no 0/O, 1/l/I) so customers
// can read a token aloud if they ever need to.
const TOKEN_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz";
const generate = customAlphabet(TOKEN_ALPHABET, 14);

export function generateTrackingToken(): string {
  return generate();
}
