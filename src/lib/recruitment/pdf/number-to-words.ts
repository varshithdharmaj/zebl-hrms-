const ONES = [
  "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
  "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen",
  "Seventeen", "Eighteen", "Nineteen",
];

const TENS = [
  "", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety",
];

function threeDigitsToWords(n: number): string {
  const parts: string[] = [];
  if (n >= 100) {
    parts.push(`${ONES[Math.floor(n / 100)]} Hundred`);
    n %= 100;
  }
  if (n >= 20) {
    const tensWord = TENS[Math.floor(n / 10)];
    const onesWord = ONES[n % 10];
    parts.push(onesWord ? `${tensWord} ${onesWord}` : tensWord);
  } else if (n > 0) {
    parts.push(ONES[n]);
  }
  return parts.join(" ");
}

/**
 * Converts a non-negative whole-rupee amount into words using the Indian
 * numbering system (lakh/crore), matching the wording style already used in
 * the ZEBL offer letter template: "Rs. 2,16,000 (Two Lakhs Sixteen Thousand Only)".
 * Deterministic — no external calls, no AI generation of legal/financial text.
 */
export function amountToIndianWords(amount: number): string {
  const whole = Math.round(Math.abs(amount));
  if (whole === 0) return "Zero";

  const crore = Math.floor(whole / 10000000);
  const lakh = Math.floor((whole % 10000000) / 100000);
  const thousand = Math.floor((whole % 100000) / 1000);
  const rest = whole % 1000;

  const segments: string[] = [];
  if (crore > 0) segments.push(`${threeDigitsToWords(crore)} Crore${crore > 1 ? "s" : ""}`);
  if (lakh > 0) segments.push(`${threeDigitsToWords(lakh)} Lakh${lakh > 1 ? "s" : ""}`);
  if (thousand > 0) segments.push(`${threeDigitsToWords(thousand)} Thousand`);
  if (rest > 0) segments.push(threeDigitsToWords(rest));

  return segments.join(" ");
}

/** e.g. "Rs. 2,16,000 (Two Lakhs Sixteen Thousand Only)" */
export function formatIndianRupeesWithWords(amount: number): string {
  const numeral = Math.round(amount).toLocaleString("en-IN");
  return `Rs. ${numeral} (${amountToIndianWords(amount)} Only)`;
}

/** Indian-grouped numeral only, no currency symbol/words, e.g. "2,16,000". */
export function formatIndianNumeral(amount: number): string {
  return Math.round(amount).toLocaleString("en-IN");
}
