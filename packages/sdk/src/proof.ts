/// <reference path="./types/snarkjs.d.ts" />
import * as snarkjs from "snarkjs"

import { fieldToBytes32 } from "./chain/encoding"
import { addressToField } from "./recipient"

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

/** A G1 point as 64 bytes. */
export function g1ToBytes(point: string[]): Uint8Array {
  return g1(point)
}

/** A G2 point as 128 bytes, each coordinate's halves swapped to c1 || c0. */
export function g2ToBytes(point: string[][]): Uint8Array {
  return g2(point)
}

/** The same as proofToBytes. */
export const formatGroth16ProofForSoroban = proofToBytes

function concat(parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, part) => n + part.length, 0))
  let offset = 0
  for (const part of parts) {
    out.set(part, offset)
    offset += part.length
  }
  return out
}

export interface ClaimProofInput {
  root: bigint | string
  nullifierHash: bigint | string
  recipientAddress: string
  amount: bigint | string
  secret: bigint | string
  batchId: bigint | string
  pathElements: (bigint | string)[]
  pathIndices: number[]
}

export interface ClaimProofOutput {
  /** 256-byte Soroban-compatible Groth16 proof (A || B || C). */
  proofBytes: Uint8Array
  /** Hex-encoded proof string with 0x prefix. */
  proofHex: string
  /** 4 public inputs as 32-byte big-endian buffers: [root, nullifier, recipient, amount]. */
  publicInputs: Uint8Array[]
  /** Decimal public signals returned by snarkjs. */
  publicSignals: string[]
  /** Address as field element. */
  recipientField: bigint
}

/**
 * Generates a confidential claim proof for `claim.circom` and formats it
 * ready to submit to `ShieldVault.withdraw(...)`.
 */
export async function generateClaimProof(
  claimData: ClaimProofInput,
  wasmPathOrBuffer: string | Uint8Array | ArrayBuffer,
  zkeyPathOrBuffer: string | Uint8Array | ArrayBuffer
): Promise<ClaimProofOutput> {
  const recipientField = await addressToField(claimData.recipientAddress)

  const circuitInputs = {
    root: BigInt(claimData.root).toString(),
    nullifierHash: BigInt(claimData.nullifierHash).toString(),
    recipient: recipientField.toString(),
    amount: BigInt(claimData.amount).toString(),
    secret: BigInt(claimData.secret).toString(),
    batchId: BigInt(claimData.batchId).toString(),
    pathElements: claimData.pathElements.map((el) => BigInt(el).toString()),
    pathIndices: claimData.pathIndices,
  }

  let wasm: any = wasmPathOrBuffer
  let zkey: any = zkeyPathOrBuffer

  // If running in browser or given a URL, fetch into Uint8Array to enable memory-mode proving in snarkjs
  if (typeof wasm === "string" && "window" in globalThis) {
    const res = await fetch(wasm)
    if (!res.ok) throw new Error(`Failed to fetch WASM from ${wasm}: HTTP ${res.status}`)
    wasm = new Uint8Array(await res.arrayBuffer())
  } else if (wasm instanceof ArrayBuffer) {
    wasm = new Uint8Array(wasm)
  }

  if (typeof zkey === "string" && "window" in globalThis) {
    const res = await fetch(zkey)
    if (!res.ok) throw new Error(`Failed to fetch ZKey from ${zkey}: HTTP ${res.status}`)
    zkey = new Uint8Array(await res.arrayBuffer())
  } else if (zkey instanceof ArrayBuffer) {
    zkey = new Uint8Array(zkey)
  }

  const { proof, publicSignals } = await (snarkjs as any).groth16.fullProve(
    circuitInputs,
    wasm,
    zkey
  )

  const proofBytes = proofToBytes(proof)
  let proofHex = "0x"
  for (let i = 0; i < proofBytes.length; i++) {
    const b = proofBytes[i] ?? 0
    proofHex += b.toString(16).padStart(2, "0")
  }

  // Public inputs in circuit order: [root, nullifier, recipient, amount]
  const publicInputs = [
    fieldToBytes32(BigInt(publicSignals[0])),
    fieldToBytes32(BigInt(publicSignals[1])),
    fieldToBytes32(BigInt(publicSignals[2])),
    fieldToBytes32(BigInt(publicSignals[3])),
  ]

  return {
    proofBytes,
    proofHex,
    publicInputs,
    publicSignals,
    recipientField,
  }
}
