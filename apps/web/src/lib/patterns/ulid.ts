/** Crockford base32, the ULID alphabet (no I, L, O or U). */
const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

/**
 * A ULID for `kami:id`.
 *
 * DESIGN.md §2.3 gives every pattern one, and the schema checks its shape. The
 * layout is the real thing: a 48-bit millisecond timestamp in the first ten
 * characters, then 80 bits of randomness, which is what makes a set of them
 * sort by creation time without carrying a separate column to sort on.
 *
 * The seeds derive theirs from their slug (see scripts/seeds/ulid.ts) so that
 * re-running the generator does not churn every file. A saved pattern is
 * created once, so it gets a random one.
 */
export function ulid(now: number = Date.now()): string {
  let time = "";
  let remaining = Math.max(0, Math.min(now, 2 ** 48 - 1));
  for (let i = 0; i < 10; i += 1) {
    time = ALPHABET.charAt(remaining % 32) + time;
    remaining = Math.floor(remaining / 32);
  }

  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  let randomness = "";
  for (const byte of bytes) randomness += ALPHABET.charAt(byte % 32);

  return time + randomness;
}
