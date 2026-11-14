// Pure helpers for the agreement field: joining dictated or imported text, tidying PDF text.

const MAX_AGREEMENT_CHARS = 4000;

/** Append `addition` to `existing`, one space apart; capitalise after a sentence end. */
export function appendText(existing: string, addition: string): string {
  const add = addition.trim();
  const base = existing.trim();
  if (!add) return base;
  if (!base) return add;
  const sentenceEnd = /[.!?]$/.test(base);
  return `${base} ${sentenceEnd ? add[0].toUpperCase() + add.slice(1) : add}`;
}

/** Collapse the spacing noise PDF text extraction produces and cap the length. */
export function cleanPdfText(raw: string): string {
  return raw
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, MAX_AGREEMENT_CHARS);
}
