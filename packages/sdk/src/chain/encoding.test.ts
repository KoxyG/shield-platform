import { describe, expect, test } from "bun:test"

import { FIELD_SIZE, MAX_AMOUNT, MAX_BATCH_ID } from "../protocol"
import {
  assertAmount,
  assertBatchId,
  bytes32ToField,
  fieldToBytes32,
} from "./encoding"

const hex = (bytes: Uint8Array) =>
  Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("")

describe("fieldToBytes32", () => {
  test("encodes big-endian into 32 bytes", () => {
    expect(hex(fieldToBytes32(1n))).toBe("00".repeat(31) + "01")
    expect(hex(fieldToBytes32(0x0102n))).toBe("00".repeat(30) + "0102")
  })

  test("FIELD_SIZE - 1 is the vault's FIELD_MODULUS minus one", () => {
    expect(hex(fieldToBytes32(FIELD_SIZE - 1n))).toBe(
      "30644e72e131a029b85045b68181585d2833e84879b9709143e1f593f0000000"
    )
  })

  test("rejects values outside the field", () => {
    expect(() => fieldToBytes32(-1n)).toThrow(RangeError)
    expect(() => fieldToBytes32(FIELD_SIZE)).toThrow(RangeError)
  })
})

describe("bytes32ToField", () => {
  test("inverts fieldToBytes32", () => {
    for (const value of [0n, 1n, 255n, 256n, 123n << 200n, FIELD_SIZE - 1n]) {
      expect(bytes32ToField(fieldToBytes32(value))).toBe(value)
    }
  })

  test("rejects inputs that aren't 32 bytes", () => {
    expect(() => bytes32ToField(new Uint8Array(31))).toThrow(RangeError)
    expect(() => bytes32ToField(new Uint8Array(33))).toThrow(RangeError)
  })
})

describe("assertAmount", () => {
  test("accepts 1 to MAX_AMOUNT", () => {
    expect(() => assertAmount(1n)).not.toThrow()
    expect(() => assertAmount(MAX_AMOUNT)).not.toThrow()
  })

  test("rejects 0 and anything above MAX_AMOUNT", () => {
    expect(() => assertAmount(0n)).toThrow(RangeError)
    expect(() => assertAmount(MAX_AMOUNT + 1n)).toThrow(RangeError)
  })
})

describe("assertBatchId", () => {
  test("accepts the full u64 range", () => {
    expect(() => assertBatchId(0n)).not.toThrow()
    expect(() => assertBatchId(MAX_BATCH_ID)).not.toThrow()
  })

  test("rejects negatives and values above u64", () => {
    expect(() => assertBatchId(-1n)).toThrow(RangeError)
    expect(() => assertBatchId(MAX_BATCH_ID + 1n)).toThrow(RangeError)
  })
})
