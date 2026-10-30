import { describe, expect, test } from "bun:test"

import { buildBatch, conservationInput, type Allocation } from "./batch"
import { generateSecret } from "./field"
import { FIELD_SIZE, MAX_AMOUNT, MAX_BATCH_ID } from "./protocol"

// Shared vectors from shield-contracts/circuits/test-vectors (see README).
interface BatchVector {
  name: string
  depth: number
  batchId: string
  allocations: { amount: string; secret: string }[]
  leaves: string[]
  root: string
  total: string
  publicSignals: string[]
  claims: { leafIndex: number; pathElements: string[]; pathIndices: number[] }[]
}
const { batches }: { batches: BatchVector[] } = await Bun.file(
  new URL("../test-vectors/batch.json", import.meta.url)
).json()

const allocationsOf = (v: BatchVector): Allocation[] =>
  v.allocations.map(({ amount, secret }) => ({
    amount: BigInt(amount),
    secret: BigInt(secret),
  }))

describe("buildBatch", () => {
  for (const v of batches) {
    test(`matches the shared batch vector: ${v.name}`, () => {
      const batch = buildBatch(BigInt(v.batchId), allocationsOf(v), v.depth)

      expect(batch.root).toBe(BigInt(v.root))
      expect(batch.total).toBe(BigInt(v.total))
      expect(batch.leaves).toEqual(v.leaves.map(BigInt))
      expect(batch.claims).toEqual(
        v.claims.map((claim, i) => ({
          leafIndex: claim.leafIndex,
          amount: BigInt(v.allocations[i]!.amount),
          secret: BigInt(v.allocations[i]!.secret),
          pathElements: claim.pathElements.map(BigInt),
          pathIndices: claim.pathIndices,
        }))
      )
    })
  }

  test("builds a full production batch of 1024 allocations", () => {
    const allocations = Array.from({ length: 1024 }, (_, i) => ({
      amount: BigInt(i + 1),
      secret: generateSecret(),
    }))
    const batch = buildBatch(7n, allocations)

    expect(batch.depth).toBe(10)
    expect(batch.total).toBe((1024n * 1025n) / 2n)
    expect(batch.claims).toHaveLength(1024)
    expect(batch.claims[1023]!.pathIndices).toEqual(Array(10).fill(1))
  })

  test("rejects a batch id that doesn't fit the vault's u64", () => {
    const allocations = [{ amount: 1n, secret: 1n }]
    expect(() => buildBatch(-1n, allocations)).toThrow(RangeError)
    expect(() => buildBatch(MAX_BATCH_ID + 1n, allocations)).toThrow(RangeError)
  })

  test("rejects an empty batch and one with more allocations than slots", () => {
    expect(() => buildBatch(1n, [])).toThrow(RangeError)
    const nine = Array.from({ length: 9 }, (_, i) => ({
      amount: 1n,
      secret: BigInt(i + 1),
    }))
    expect(() => buildBatch(1n, nine, 3)).toThrow(RangeError)
  })

  test("rejects amounts the vault can't pay out", () => {
    // 0 could never be claimed: the vault rejects zero payouts
    for (const amount of [0n, -1n, MAX_AMOUNT + 1n]) {
      expect(() => buildBatch(1n, [{ amount, secret: 1n }])).toThrow(RangeError)
    }
  })

  test("rejects secrets that aren't field elements", () => {
    expect(() => buildBatch(1n, [{ amount: 1n, secret: FIELD_SIZE }])).toThrow(
      RangeError
    )
  })

  test("rejects two allocations with the same secret", () => {
    // Whoever holds the shared secret could claim both allocations
    const allocations = [
      { amount: 50n, secret: 111n },
      { amount: 30n, secret: 111n },
    ]
    expect(() => buildBatch(1n, allocations)).toThrow(RangeError)
  })
})

describe("conservationInput", () => {
  for (const v of batches) {
    test(`gives the circuit's public signals for: ${v.name}`, () => {
      const input = conservationInput(
        buildBatch(BigInt(v.batchId), allocationsOf(v), v.depth)
      )
      expect([input.root, input.total, input.batchId]).toEqual(v.publicSignals)
    })
  }

  test("fills every slot, with empty slots set to 0", () => {
    const batch = buildBatch(
      42n,
      [
        { amount: 50n, secret: 111n },
        { amount: 30n, secret: 222n },
      ],
      3
    )
    const input = conservationInput(batch)

    expect(input.amounts).toEqual(["50", "30", "0", "0", "0", "0", "0", "0"])
    expect(input.secrets).toEqual(["111", "222", "0", "0", "0", "0", "0", "0"])
    expect(input.active).toEqual(["1", "1", "0", "0", "0", "0", "0", "0"])
  })
})
