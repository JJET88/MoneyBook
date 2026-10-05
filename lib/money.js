// Money is kept as whole minor units (6500 means 65.00). Decimal fractions
// such as 0.1 cannot be stored exactly as floating point numbers, so sums of
// them drift; whole numbers do not.

const LIMIT = 1e12; // the largest amount accepted, in major units

/**
 * "65", "1,234.50", " 7.5 " -> minor units. Returns null for anything that is
 * not a plain amount. Works on the text itself, so 1.005 rounds to 1.01
 * rather than whatever the nearest binary fraction happens to be.
 */
export function parseAmountMinor(value, { allowZero = false } = {}) {
  const text = String(value ?? "").replace(/[,\s]/g, "");
  const match = /^(\d{0,13})(?:\.(\d*))?$/.exec(text);
  if (!match || !(match[1] || match[2])) return null;
  const whole = Number(match[1] || 0);
  if (whole >= LIMIT) return null;
  const decimals = (match[2] ?? "").padEnd(3, "0");
  let minor = whole * 100 + Number(decimals.slice(0, 2));
  if (decimals[2] >= "5") minor += 1;
  if (minor === 0 && !allowZero) return null;
  return minor;
}

/** 123400 -> "1,234"; 6550 with "฿" -> "฿65.50"; negatives get a minus sign in front. */
export function formatMoney(minor, currency = "") {
  const abs = Math.abs(minor);
  const whole = Math.floor(abs / 100).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const cents = abs % 100;
  return (minor < 0 ? "−" : "") + currency + whole + (cents ? "." + String(cents).padStart(2, "0") : "");
}

/** For filling an input box: 6500 -> "65", 6550 -> "65.50". */
export function minorToInput(minor) {
  const cents = minor % 100;
  return String(Math.floor(minor / 100)) + (cents ? "." + String(cents).padStart(2, "0") : "");
}
