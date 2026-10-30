/** Stellar asset contracts count in units of 10^-7 of a token. */
export const TOKEN_DECIMALS = 7

const UNIT = 10n ** BigInt(TOKEN_DECIMALS)

/**
 * Parses an amount typed in tokens ("12.5") into base units (125000000n), the
 * unit the API, the circuits and the vault use. Returns undefined unless it's a
 * positive number with at most 7 decimals.
 */
export function parseAmount(text: string): bigint | undefined {
  const match = /^(\d+)(?:\.(\d{1,7}))?$/.exec(text.trim())
  if (!match) return undefined
  const [, whole = "0", fraction = ""] = match
  const value =
    BigInt(whole) * UNIT + BigInt(fraction.padEnd(TOKEN_DECIMALS, "0"))
  return value > 0n ? value : undefined
}

/** Formats base units as tokens: 125000000n -> "12.5", 12345678901234567n -> "1,234,567,890.1234567". */
export function formatAmount(base: bigint): string {
  const sign = base < 0n ? "-" : ""
  const abs = base < 0n ? -base : base
  const fraction = (abs % UNIT)
    .toString()
    .padStart(TOKEN_DECIMALS, "0")
    .replace(/0+$/, "")
  return `${sign}${(abs / UNIT).toLocaleString("en-US")}${fraction && "." + fraction}`
}
