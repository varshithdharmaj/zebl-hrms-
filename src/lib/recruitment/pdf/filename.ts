/**
 * Builds the download filename for a generated offer letter, e.g.
 * "ZEBL_Offer_Letter_Jane_Doe.pdf". Candidate names are free text (can contain
 * punctuation, unicode, path-like characters) so this strips everything but
 * alphanumerics/spaces before collapsing whitespace to underscores.
 */
export function buildOfferLetterFileName(candidateName: string): string {
  const cleaned = candidateName
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "") // strip combining diacritics left by NFKD (e.g. é -> e + ́)
    .replace(/[^a-zA-Z0-9\s]/g, "")
    .trim()
    .replace(/\s+/g, "_")
    .slice(0, 80);

  const namePart = cleaned || "Candidate";
  return `ZEBL_Offer_Letter_${namePart}.pdf`;
}
