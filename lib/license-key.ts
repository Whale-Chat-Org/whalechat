import { randomInt } from "node:crypto";

/**
 * Crockford's base32 alphabet, minus the characters people misread when copying
 * a key out of an email: no `0`/`O`, no `1`/`I`/`L`.
 */
const ALPHABET = "23456789ABCDEFGHJKMNPQRSTVWXYZ";

const GROUPS = 3;
const GROUP_SIZE = 5;

/**
 * Generate an admin license key, e.g. `WHALE-4T7QM-92XKD-HRC3P`.
 *
 * @remarks 15 characters from a 30-symbol alphabet is a little over 73 bits —
 * far past guessing, and comfortably above Better Auth's 8-character minimum,
 * because this key goes on to *be* the administrator's password.
 *
 * `randomInt` is rejection-sampled by Node, so the alphabet stays uniform even
 * though 30 does not divide evenly into a power of two.
 */
export function generateLicenseKey() {
  const groups = Array.from({ length: GROUPS }, () =>
    Array.from(
      { length: GROUP_SIZE },
      () => ALPHABET[randomInt(ALPHABET.length)]
    ).join("")
  );

  return `WHALE-${groups.join("-")}`;
}

/**
 * Accept a key however it was typed — lowercased, spaced, or missing the prefix.
 *
 * @remarks Only normalises shape. Whether the key is *correct* is decided by
 * comparing against the stored hash, never here.
 */
export function normaliseLicenseKey(input: string) {
  return input.trim().toUpperCase().replace(/\s+/g, "");
}
