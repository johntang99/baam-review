const NANOID_ALPHABET = "abcdefghijkmnpqrstuvwxyz23456789";

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

export function randomSuffix(len = 4): string {
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  let out = "";
  for (let i = 0; i < len; i++) {
    out += NANOID_ALPHABET[bytes[i] % NANOID_ALPHABET.length];
  }
  return out;
}

export function buildLocationSlug(displayName: string): string {
  const base = slugify(displayName) || "location";
  return `${base}-${randomSuffix()}`;
}
