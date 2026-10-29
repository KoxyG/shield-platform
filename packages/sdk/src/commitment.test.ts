import { describe, expect, test } from "bun:test"

import { allocationCommitment } from "./commitment"
import { FIELD_SIZE, MAX_AMOUNT, MAX_BATCH_ID } from "./protocol"

// Shared vectors from shield-contracts/circuits/test-vectors (see README).
interface CommitmentVector {
  name: string
  amount: string
  secret: string
  batchId: string
  commitment: string
}
const { vectors }: { vectors: CommitmentVector[] } = await Bun.file(
  new URL("../test-vectors/commitment.json", import.meta.url)
).json()

describe("allocationCommitment", () => {
  for (const v of vectors) {
    test(`matches the shared vector: ${v.name}`, () => {
      const commitment = allocationCommitment(
        BigInt(v.amount),
        BigInt(v.secret),
        BigInt(v.batchId)
      )
      expect(commitment).toBe(BigInt(v.commitment))
    })
  }

  test("rejects inputs the circuits don't accept", () => {
    expect(() => allocationCommitment(-1n, 1n, 1n)).toThrow(RangeError)
    expect(() => allocationCommitment(MAX_AMOUNT + 1n, 1n, 1n)).toThrow(
      RangeError
    )
    expect(() => allocationCommitment(1n, FIELD_SIZE, 1n)).toThrow(RangeError)
    expect(() => allocationCommitment(1n, 1n, MAX_BATCH_ID + 1n)).toThrow(
      RangeError
    )
  })

  test("keeps the secret out of error messages", () => {
    const secret = FIELD_SIZE + 12345n
    let message = ""
    try {
      allocationCommitment(1n, secret, 1n)
    } catch (err) {
      message = (err as Error).message
    }
    expect(message).not.toBe("")
    expect(message).not.toContain(secret.toString())
  })
})
