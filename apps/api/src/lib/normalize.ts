/**
 * Persian text normalization for search.
 *
 * Folds Arabic/Persian spelling variants, strips diacritics and zero-width
 * characters, and converts Persian/Arabic-Indic digits to ASCII so that queries
 * match regardless of how the user typed them.
 *
 * `کار` == `كار`, `۱۲۰` == `120`, `میرود` == `می رود`.
 */
export function normalizePersian(input: string): string {
  return input
    .replace(/[\u064A\u0649]/g, '\u06CC') // ي / ى -> ی
    .replace(/\u0643/g, '\u06A9') // ك -> ک
    .replace(/[\u0623\u0625\u0622]/g, '\u0627') // أ إ آ -> ا
    .replace(/\u0629/g, '\u0647') // ة -> ه
    .replace(/[\u064B-\u0652\u0670]/g, '') // harakat / diacritics
    .replace(/\u0640/g, '') // kashida
    .replace(/[\u200B\u200D-\u200F\u202A-\u202E]/g, '') // ZWSP + bidi marks (ZWNJ kept)
    .replace(/\u200C/g, ' ') // ZWNJ -> boundary
    .replace(/[\u06F0-\u06F9]/g, (d) => String(d.charCodeAt(0) - 0x06f0)) // Persian digits
    .replace(/[\u0660-\u0669]/g, (d) => String(d.charCodeAt(0) - 0x0660)) // Arabic-Indic digits
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/** True when `haystack` contains `needle` after normalizing both. */
export function matchesPersian(haystack: string, needle: string): boolean {
  return normalizePersian(haystack).includes(normalizePersian(needle));
}
