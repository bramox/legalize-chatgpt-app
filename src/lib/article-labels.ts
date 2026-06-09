/**
 * Article label canonicalization for Spanish law articles.
 * Handles natural language variations, prefixes, and compact formats.
 */

/**
 * Supported Spanish article suffixes in canonical order.
 */
export const SPANISH_SUFFIXES = [
  "bis",
  "ter",
  "quater",
  "quinquies",
  "sexies",
  "septies",
  "octies",
  "nonies",
  "decies",
] as const;

const PREFIX_PATTERNS = [
  /^Art[íi]culo\s+/i,
  /^art\.\s+/i,
];

const SUFFIX_PATTERN = SPANISH_SUFFIXES.join("|");

/**
 * Normalize an article label to its canonical form.
 * Handles:
 * - Trimming and collapsing whitespace
 * - Stripping "Artículo"/"Articulo"/"art." prefixes
 * - Converting compact labels like "38ter" to "38 ter"
 * - Preserving known suffixes
 *
 * @param label - The article label to normalize
 * @returns The canonical article number, or null if unparseable
 */
export function canonicalizeArticleLabel(label: string): string | null {
  if (!label || typeof label !== "string") {
    return null;
  }

  let normalized = label.trim().replace(/\s+/g, " ");

  for (const pattern of PREFIX_PATTERNS) {
    normalized = normalized.replace(pattern, "");
  }

  for (const suffix of SPANISH_SUFFIXES) {
    const compactPattern = new RegExp(`(\\d+)${suffix}$`, "i");
    if (compactPattern.test(normalized)) {
      normalized = normalized.replace(compactPattern, `$1 ${suffix}`);
      break;
    }
  }

  const numericMatch = normalized.match(
    new RegExp(`^(\\d+[ºª]?)(?:\\s*(${SUFFIX_PATTERN}))?$`, "i"),
  );
  if (numericMatch) {
    const [, base, suffix] = numericMatch;
    return suffix ? `${base} ${suffix.toLowerCase()}` : base;
  }

  if (/^[uú]nico$/i.test(normalized)) {
    return normalized.toLowerCase();
  }

  return null;
}

/**
 * Detect labels like "38 " after optional article prefixes.
 * This is not a canonical label; it is a legacy malformed suffix indicator.
 */
export function isMalformedBaseArticleLabel(label: string): boolean {
  if (!label || typeof label !== "string") {
    return false;
  }

  let normalized = label.trimStart().replace(/\s+/g, " ");
  for (const pattern of PREFIX_PATTERNS) {
    normalized = normalized.replace(pattern, "");
  }

  if (normalized === normalized.trimEnd()) {
    return false;
  }

  return /^\d+[ºª]?\s+$/.test(normalized);
}

/**
 * Check whether a canonical article number has a supported Spanish suffix.
 */
export function hasSupportedArticleSuffix(articleNumber: string): boolean {
  if (!articleNumber) {
    return false;
  }

  return SPANISH_SUFFIXES.some((suffix) =>
    articleNumber.toLowerCase().endsWith(` ${suffix}`),
  );
}

/**
 * Return the base numeric part of a canonical article number.
 */
export function getArticleBaseNumber(articleNumber: string): string | null {
  const match = articleNumber.match(/^(\d+[ºª]?)/);
  if (!match) {
    return null;
  }

  return match[1];
}

/**
 * Try to recover a canonical article number from a potentially malformed stored value.
 * Handles legacy malformed values like "38 " (trailing space) for suffix articles.
 *
 * Safe recovery conditions:
 * - The stored value must be a known malformed pattern (e.g., "38 " with trailing space)
 * - The canonical request must have a known suffix
 * - The base numbers must match exactly
 * - Recovery must not turn a normal Article 38 into Article 38 ter
 *
 * @param storedValue - The stored article number (possibly malformed)
 * @param canonicalRequest - The canonical article number being requested
 * @returns The recovered canonical article number, or null if recovery fails
 */
export function recoverCanonicalArticleNumber(
  storedValue: string,
  canonicalRequest: string
): string | null {
  if (!storedValue || !canonicalRequest) {
    return null;
  }

  // If stored value is already canonical, return it
  if (storedValue.trim() === canonicalRequest) {
    return canonicalRequest;
  }

  const baseNumber = getArticleBaseNumber(canonicalRequest);
  if (
    baseNumber &&
    hasSupportedArticleSuffix(canonicalRequest) &&
    isMalformedBaseArticleLabel(storedValue) &&
    storedValue.trim() === baseNumber
  ) {
    return canonicalRequest;
  }

  const canonicalizedStored = canonicalizeArticleLabel(storedValue);
  if (canonicalizedStored === canonicalRequest) {
    return canonicalRequest;
  }

  return null;
}
