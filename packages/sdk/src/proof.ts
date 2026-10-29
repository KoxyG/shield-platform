/*
 * Groth16 proofs from snarkjs, in the byte format ShieldVerifier reads:
 * A || B || C, 256 bytes. A G1 point is be(x) || be(y); a G2 point is
 * be(x.c1) || be(x.c0) || be(y.c1) || be(y.c0); each coordinate is 32 bytes,
 * big-endian. That's Soroban's BN254 encoding (Ethereum's, EIP-197). snarkjs
 * stores the two halves of a G2 coordinate the other way round, as [c0, c1].
 * Mirrors shield-contracts/circuits/lib/soroban.js.
 */

/** A Groth16 proof as snarkjs returns it, with affine points (z = 1). */
export interface SnarkjsProof {
  pi_a: string[]
  pi_b: string[][]
  pi_c: string[]
}

/** BN254 base field modulus. Point coordinates live below it, not below FIELD_SIZE. */
export const BASE_FIELD_SIZE =
  21888242871839275222246405745257275088696311157297823662689037894645226208583n

/** Encodes a snarkjs proof as the 256 bytes that fund_batch and withdraw take. */
export function proofToBytes(proof: SnarkjsProof): Uint8Array {
  const bytes = new Uint8Array(256)
  bytes.set(g1(proof.pi_a), 0)
  bytes.set(g2(proof.pi_b), 64)
  bytes.set(g1(proof.pi_c), 192)
  return bytes
}

function g1(point: string[]): Uint8Array {
  checkAffine(point[2], "1")
  return concat([coordinate(point[0]), coordinate(point[1])])
}

function g2(point: string[][]): Uint8Array {
  checkAffine(point[2]?.[0], "1")
  checkAffine(point[2]?.[1], "0")
  const [x, y] = point
  return concat([
    coordinate(x?.[1]),
    coordinate(x?.[0]),
    coordinate(y?.[1]),
    coordinate(y?.[0]),
  ])
}

// snarkjs returns affine points. Anything else would need converting first.
function checkAffine(actual: string | undefined, expected: string): void {
  if (actual === undefined || BigInt(actual) !== BigInt(expected)) {
    throw new RangeError("Expected an affine point (z = 1), as snarkjs returns")
  }
}

/** One point coordinate as 32 big-endian bytes. */
function coordinate(value: string | undefined): Uint8Array {
  if (value === undefined) {
    throw new RangeError("Malformed proof: missing a point coordinate")
  }
  const v = BigInt(value)
  if (v < 0n || v >= BASE_FIELD_SIZE) {
    throw new RangeError(`Not a BN254 base field element: ${v}`)
  }
  const bytes = new Uint8Array(32)
  for (let i = 31, rest = v; i >= 0; i--, rest >>= 8n) {
    bytes[i] = Number(rest & 0xffn)
  }
  return bytes
}

function concat(parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, part) => n + part.length, 0))
  let offset = 0
  for (const part of parts) {
    out.set(part, offset)
    offset += part.length
  }
  return out
}
