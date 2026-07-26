// Repairs text that began life as UTF-8, was decoded as Windows-1252 (CP1252)
// somewhere in its history, and then re-saved -- the classic mojibake where an em
// dash shows up as three garbled characters. Spreadsheet exports and Google Drive
// round-trips introduce it.
//
// Rather than a hand table of garbled sequences (fragile to this file's own
// encoding), we reverse the corruption directly: map each character back to the
// CP1252 byte it was decoded from, then decode those bytes as UTF-8 with a FATAL
// decoder. The fatal decoder makes this self-validating -- a repair is accepted
// only when the reversed bytes form valid UTF-8, which genuine mojibake always does
// and clean text almost never does. Clean strings are therefore left untouched.

// CP1252's 0x80-0x9F map to these Unicode code points (everything else in
// 0x00-0xFF is identity). This is the reverse: Unicode code point -> original byte.
const CP1252_TO_BYTE = {
  0x20ac: 0x80, 0x201a: 0x82, 0x0192: 0x83, 0x201e: 0x84, 0x2026: 0x85,
  0x2020: 0x86, 0x2021: 0x87, 0x02c6: 0x88, 0x2030: 0x89, 0x0160: 0x8a,
  0x2039: 0x8b, 0x0152: 0x8c, 0x017d: 0x8e, 0x2018: 0x91, 0x2019: 0x92,
  0x201c: 0x93, 0x201d: 0x94, 0x2022: 0x95, 0x2013: 0x96, 0x2014: 0x97,
  0x02dc: 0x98, 0x2122: 0x99, 0x0161: 0x9a, 0x203a: 0x9b, 0x0153: 0x9c,
  0x017e: 0x9e, 0x0178: 0x9f,
};

// The lead characters a CP1252-mangled multi-byte UTF-8 sequence always starts
// with: U+00E2 (three-byte punctuation), U+00C2 / U+00C3 (two-byte Latin-1).
const MOJIBAKE_MARKER = /[ÂÃâ]/;

/**
 * Return `input` with common CP1252-over-UTF-8 mojibake repaired. Non-strings and
 * strings without a mojibake marker are returned unchanged. Idempotent.
 */
export function fixMojibake(input) {
  if (typeof input !== "string" || input.length === 0) return input;
  if (!MOJIBAKE_MARKER.test(input)) return input;

  const bytes = new Uint8Array(input.length);
  for (let i = 0; i < input.length; i++) {
    const cp = input.charCodeAt(i);
    let b;
    if (cp <= 0xff) b = cp;
    else if (cp in CP1252_TO_BYTE) b = CP1252_TO_BYTE[cp];
    else return input; // a char that can't come from CP1252 -> not mojibake, bail
    bytes[i] = b;
  }

  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return input; // reversed bytes are not valid UTF-8 -> genuine text, leave as-is
  }
}

/**
 * Given Chart-of-Accounts rows, return only those whose display text contains
 * mojibake, each with the corrected values. Nothing is written -- the caller
 * previews the list and confirms before applying.
 *
 * @param {Array<{id:*, account_code:*, account_name?:string, account_description?:string}>} accounts
 * @returns {Array<{id:*, account_code:*, changed:Record<string,{before:string,after:string}>}>}
 */
export function findMojibakeFixes(accounts = []) {
  const fixes = [];
  for (const a of accounts) {
    if (!a) continue;
    const changed = {};
    for (const field of ["account_name", "account_description"]) {
      const before = a[field];
      if (typeof before !== "string") continue;
      const after = fixMojibake(before);
      if (after !== before) changed[field] = { before, after };
    }
    if (Object.keys(changed).length > 0) {
      fixes.push({ id: a.id, account_code: a.account_code, changed });
    }
  }
  return fixes;
}
