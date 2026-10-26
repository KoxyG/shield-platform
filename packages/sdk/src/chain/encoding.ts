import { isFieldElement } from "../field"
import { MAX_AMOUNT, MAX_BATCH_ID } from "../protocol"

/**
 * Encodes a field element as the vault's `BytesN<32>`: 32 bytes, big-endian.
 * Throws on a non-canonical value, which the vault would reject anyway
 * (NonCanonicalRoot / NonCanonicalNullifier).
 */
export function fieldToBytes32(value: bigint): Uint8Array {
  if (!isFieldElement(value)) {
    throw new RangeError(`Not a canonical field element: ${value}`)
  }
  const bytes = new Uint8Array(32)
  for (let i = 31, rest = value; i >= 0; i--, rest >>= 8n) {
    bytes[i] = Number(rest & 0xffn)
  }
  return bytes
}

/** Decodes a vault `BytesN<32>` (32 bytes, big-endian) to a field element. */
export function bytes32ToField(bytes: Uint8Array): bigint {
  if (bytes.length !== 32) {
    throw new RangeError(`Expected 32 bytes, got ${bytes.length}`)
  }
  return bytes.reduce((value, byte) => (value << 8n) | BigInt(byte), 0n)
}

/** Throws unless `amount` is a payout the vault accepts: 1 to MAX_AMOUNT base units. */
export function assertAmount(amount: bigint): void {
  if (amount < 1n || amount > MAX_AMOUNT) {
    throw new RangeError(`Amount out of range: ${amount}`)
  }
}

/** Throws unless `batchId` fits the vault's `u64`. */
export function assertBatchId(batchId: bigint): void {
  if (batchId < 0n || batchId > MAX_BATCH_ID) {
    throw new RangeError(`Batch id out of range: ${batchId}`)
  }
}
