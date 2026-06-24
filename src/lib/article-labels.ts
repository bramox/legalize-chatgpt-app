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

const ORDINAL_WORDS: Record<string, string> = {
  primer: "1",
  primero: "1",
  segunda: "2",
  segundo: "2",
  tercer: "3",
  tercera: "3",
  tercero: "3",
  cuarta: "4",
  cuarto: "4",
  quinta: "5",
  quinto: "5",
  sexta: "6",
  sexto: "6",
  septima: "7",
  septimo: "7",
  octava: "8",
  octavo: "8",
  novena: "9",
  noveno: "9",
  decima: "10",
  decimo: "10",
  undecima: "11",
  undecimo: "11",
  duodecima: "12",
  duodecimo: "12",
  decimotercera: "13",
  decimotercero: "13",
  decimocuarta: "14",
  decimocuarto: "14",
  decimoquinta: "15",
  decimoquinto: "15",
  decimosexta: "16",
  decimosexto: "16",
  decimoseptima: "17",
  decimoseptimo: "17",
  decimoctava: "18",
  decimoctavo: "18",
  decimonovena: "19",
  decimonoveno: "19",
  vigesima: "20",
  vigesimo: "20",
};

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

  normalized = normalized.trim().replace(/[.:]+$/, "");

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

  const ordinal = ORDINAL_WORDS[normalizeTextForLabel(normalized)];
  if (ordinal) {
    return ordinal;
  }

  return null;
}

function normalizeTextForLabel(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
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
