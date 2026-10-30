import { describe, expect, test } from "bun:test"

import { BASE_FIELD_SIZE, proofToBytes, type SnarkjsProof } from "./proof"

// Shared vector from shield-contracts/circuits/test-vectors (see README): a real
// conservation proof, encoded by circuits/lib/soroban.js and accepted on-chain by
// ShieldVerifier in shield-contracts' vault tests.
const fixture: { proof: string } = await Bun.file(
  new URL("../test-vectors/conservation-proof.json", import.meta.url)
).json()

const hex = (bytes: Uint8Array) =>
  Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("")

const fromHex = (value: string) =>
  Uint8Array.from(value.slice(2).match(/../g)!, (byte) => parseInt(byte, 16))

/** Splits bytes into 32-byte big-endian words, as decimal strings. */
const words = (bytes: Uint8Array) =>
  Array.from({ length: bytes.length / 32 }, (_, i) =>
    BigInt("0x" + hex(bytes.subarray(32 * i, 32 * (i + 1)))).toString()
  )

/** The inverse of proofToBytes, so the fixture can be encoded again. */
function proofFromBytes(bytes: Uint8Array): SnarkjsProof {
  const [ax, ay, bx1, bx0, by1, by0, cx, cy] = words(bytes)
  return {
    pi_a: [ax!, ay!, "1"],
    pi_b: [
      [bx0!, bx1!],
      [by0!, by1!],
      ["1", "0"],
    ],
    pi_c: [cx!, cy!, "1"],
  }
}

const proof = (overrides: Partial<SnarkjsProof> = {}): SnarkjsProof => ({
  pi_a: ["5", "6", "1"],
  pi_b: [
    ["7", "8"],
    ["9", "10"],
    ["1", "0"],
  ],
  pi_c: ["11", "12", "1"],
  ...overrides,
})

describe("proofToBytes", () => {
  test("lays out A || B || C, with each G2 coordinate as c1 || c0", () => {
    const bytes = proofToBytes(proof())
    expect(bytes).toHaveLength(256)
    expect(words(bytes)).toEqual(["5", "6", "8", "7", "10", "9", "11", "12"])
  })

  test("re-encodes the shared real proof byte for byte", () => {
    const bytes = fromHex(fixture.proof)
    expect(hex(proofToBytes(proofFromBytes(bytes)))).toBe(
      fixture.proof.slice(2)
    )
  })

  test("rejects points that aren't affine", () => {
    expect(() => proofToBytes(proof({ pi_a: ["5", "6", "2"] }))).toThrow(
      RangeError
    )
  })

  test("rejects coordinates outside the base field, and missing ones", () => {
    const tooBig = BASE_FIELD_SIZE.toString()
    expect(() => proofToBytes(proof({ pi_c: [tooBig, "12", "1"] }))).toThrow(
      RangeError
    )
    expect(() => proofToBytes(proof({ pi_a: ["5"] }))).toThrow(RangeError)
  })

  test("uses the BN254 base field modulus", () => {
    // p from soroban-sdk's crypto/bn254.rs
    expect(BASE_FIELD_SIZE).toBe(
      0x30644e72e131a029b85045b68181585d97816a916871ca8d3c208c16d87cfd47n
    )
  })
})
