import { poseidon3 } from "poseidon-lite/poseidon3"

import { isFieldElement } from "./field"
import { MAX_AMOUNT, MAX_BATCH_ID } from "./protocol"

/**
 * Commitment to one allocation: Poseidon(amount, secret, batchId), circomlib
 * parameters over BN254. The secret hides the amount, and batchId ties the
 * allocation to its batch. Mirrors AllocationCommitment in
 * shield-contracts/circuits/commitment.circom.
 *
 * Throws on inputs the circuits reject: amount and batchId must fit in 64 bits,
 * and secret must be a field element.
 */
export function allocationCommitment(
  amount: bigint,
  secret: bigint,
  batchId: bigint
): bigint {
  if (amount < 0n || amount > MAX_AMOUNT) {
    throw new RangeError(`Amount out of range: ${amount}`)
  }
  // Never put the secret itself in an error: errors end up in logs
  if (!isFieldElement(secret)) {
    throw new RangeError("Secret must be a field element")
  }
  if (batchId < 0n || batchId > MAX_BATCH_ID) {
    throw new RangeError(`Batch id out of range: ${batchId}`)
  }
  return poseidon3([amount, secret, batchId])
}
