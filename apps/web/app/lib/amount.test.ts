import { describe, expect, test } from "bun:test"

import { formatAmount, parseAmount } from "./amount"

describe("parseAmount", () => {
  test("turns tokens into base units (7 decimals)", () => {
    expect(parseAmount("12.5")).toBe(125_000_000n)
    expect(parseAmount("1")).toBe(10_000_000n)
    expect(parseAmount("0.0000001")).toBe(1n)
    expect(parseAmount(" 3 ")).toBe(30_000_000n)
    expect(parseAmount("01.5")).toBe(15_000_000n)
  })

  test("rejects anything that isn't a positive amount with at most 7 decimals", () => {
    for (const text of [
      "",
      "0",
      "0.0",
      "-1",
      "1.12345678",
      "1e5",
      "1,000",
      "abc",
      "1.",
    ]) {
      expect(parseAmount(text)).toBeUndefined()
    }
  })
})

describe("formatAmount", () => {
  test("turns base units into tokens, without trailing zeros", () => {
    expect(formatAmount(125_000_000n)).toBe("12.5")
    expect(formatAmount(10_000_000n)).toBe("1")
    expect(formatAmount(1n)).toBe("0.0000001")
    expect(formatAmount(0n)).toBe("0")
    expect(formatAmount(12_345_678_901_234_567n)).toBe("1,234,567,890.1234567")
  })

  test("round-trips with parseAmount", () => {
    for (const base of [1n, 99n, 10_000_000n, 123_456_789n, (1n << 64n) - 1n]) {
      expect(parseAmount(formatAmount(base).replaceAll(",", ""))).toBe(base)
    }
  })
})
