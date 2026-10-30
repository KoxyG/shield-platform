import { Address } from "@stellar/stellar-sdk"
import { fieldToBytes32 } from "./chain/encoding"
import { FIELD_SIZE } from "./protocol"

/**
 * Encodes a Stellar address (account `G...` or contract `C...`) as a BN254 field element
 * according to architecture decision D4:
 *
 * recipient = sha256(ScVal XDR of the address) with top 3 bits cleared (< 253 bits).
 *
 * Must match `recipient_to_field` in `shield-vault/src/lib.rs` and `circuits/lib/recipient.js`.
 */
export async function addressToField(address: string): Promise<bigint> {
  const scVal = Address.fromString(address).toScVal()
  const xdr = scVal.toXDR()
  
  const xdrBytes = new Uint8Array(xdr)
  // Copy to dedicated ArrayBuffer for Web Crypto BufferSource compatibility
  const copy = new Uint8Array(xdrBytes.length)
  copy.set(xdrBytes)
  const hashBuffer = await crypto.subtle.digest("SHA-256", copy.buffer)
  const hash = new Uint8Array(hashBuffer)
  
  // Clear top 3 bits so it fits in 253 bits (< BN254 scalar field modulus)
  const firstByte = hash[0] ?? 0
  hash[0] = firstByte & 0x1f
  
  let hex = ""
  for (let i = 0; i < hash.length; i++) {
    const b = hash[i] ?? 0
    hex += b.toString(16).padStart(2, "0")
  }
  const field = BigInt("0x" + hex)
  if (field >= FIELD_SIZE) {
    throw new RangeError("Address hash exceeds BN254 field modulus")
  }
  return field
}

/**
 * Synchronous version using Node/Bun crypto if available, or fallback.
 */
export function addressToFieldSync(address: string): bigint {
  const scVal = Address.fromString(address).toScVal()
  const xdr = scVal.toXDR()

  const cryptoModule = (globalThis as any).crypto
  if (typeof cryptoModule?.createHash === "function") {
    const hash = cryptoModule.createHash("sha256").update(xdr).digest()
    hash[0] &= 0x1f
    return BigInt("0x" + hash.toString("hex"))
  }

  try {
    const req = typeof require !== "undefined" ? require : null
    if (req) {
      const nodeCrypto = req("crypto")
      const hash = nodeCrypto.createHash("sha256").update(xdr).digest()
      hash[0] &= 0x1f
      return BigInt("0x" + hash.toString("hex"))
    }
  } catch {}

  throw new Error(
    "Synchronous hash requires Node/Bun crypto. In browser contexts, use await addressToField(address)."
  )
}

/**
 * Encodes address directly to 32 big-endian bytes for the contract's public inputs.
 */
export async function addressToBytes32(address: string): Promise<Uint8Array> {
  const field = await addressToField(address)
  return fieldToBytes32(field)
}
