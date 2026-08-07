import { sha256 } from "@noble/hashes/sha256";

/** Crockford base32, the ULID alphabet (no I, L, O or U). */
const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

/**
 * A ULID derived from a seed's slug rather than from randomness, so
 * re-running the seed script does not churn every `kami:id`.
 *
 * The layout is a real ULID: 48-bit millisecond timestamp in the first ten
 * characters, then 80 bits that would normally be random and here come from
 * SHA-256 of the slug. Collisions across a dozen fixed slugs are not a
 * concern; uploaded patterns get real random ULIDs.
 */
export function deterministicUlid(slug: string, timestampMs: number): string {
  if (!Number.isInteger(timestampMs) || timestampMs < 0 || timestampMs > 2 ** 48 - 1) {
    throw new RangeError(`timestamp out of ULID range: ${timestampMs}`);
  }

  let time = "";
  let remaining = timestampMs;
  for (let i = 0; i < 10; i += 1) {
    time = ALPHABET[remaining % 32] + time;
    remaining = Math.floor(remaining / 32);
  }

  const digest = sha256(new TextEncoder().encode(slug));
  let randomness = "";
  for (let i = 0; i < 16; i += 1) {
    randomness += ALPHABET[digest[i]! % 32];
  }

  return time + randomness;
}
