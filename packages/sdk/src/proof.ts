/// <reference path="./types/snarkjs.d.ts" />
import * as snarkjs from "snarkjs"
import { addressToField } from "./recipient"
import { fieldToBytes32 } from "./chain/encoding"
import { FIELD_SIZE } from "./protocol"

// BN254 base field size where curve coordinates live
export const BASE_FIELD_SIZE =
  21888242871839275222246405745257275088696311157297823662689037894645226208583n

function coordinateToBytes(val: string | bigint): Uint8Array {
  const v = BigInt(val)
  if (v < 0n || v >= BASE_FIELD_SIZE) {
    throw new RangeError(`Not a BN254 base field element: ${v}`)
  }
  const hex = v.toString(16).padStart(64, "0")
  const out = new Uint8Array(32)
  for (let i = 0; i < 32; i++) {
    out[i] = parseInt(hex.substring(i * 2, i * 2 + 2), 16)
  }
  return out
}

function concatBytes(...arrays: Uint8Array[]): Uint8Array {
  const total = arrays.reduce((acc, a) => acc + a.length, 0)
  const result = new Uint8Array(total)
  let offset = 0
  for (const arr of arrays) {
    result.set(arr, offset)
    offset += arr.length
  }
  return result
}

/**
 * Encodes a Groth16 G1 affine point ([x, y, 1]) as 64 big-endian bytes.
 */
export function g1ToBytes(point: [string, string, string]): Uint8Array {
  return concatBytes(coordinateToBytes(point[0]), coordinateToBytes(point[1]))
}

/**
 * Encodes a Groth16 G2 affine point ([[x0, x1], [y0, y1], [1, 0]]) as 128 big-endian bytes.
 * Note: Swaps c0 and c1 to match Ethereum/Soroban EIP-197 format (c1 || c0).
 */
export function g2ToBytes(
  point: [[string, string], [string, string], [string, string]]
): Uint8Array {
  const [[x0, x1], [y0, y1]] = point
  return concatBytes(
    coordinateToBytes(x1),
    coordinateToBytes(x0),
    coordinateToBytes(y0),
    coordinateToBytes(y1)
  )
}

/**
 * Serializes a snarkjs Groth16 proof into Soroban's 256-byte A || B || C representation.
 */
export function formatGroth16ProofForSoroban(proof: any): Uint8Array {
  const a = g1ToBytes(proof.pi_a)
  const b = g2ToBytes(proof.pi_b)
  const c = g1ToBytes(proof.pi_c)
  return concatBytes(a, b, c)
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
  if (typeof wasm === "string" && typeof window !== "undefined") {
    const res = await fetch(wasm)
    if (!res.ok) throw new Error(`Failed to fetch WASM from ${wasm}: HTTP ${res.status}`)
    wasm = new Uint8Array(await res.arrayBuffer())
  } else if (wasm instanceof ArrayBuffer) {
    wasm = new Uint8Array(wasm)
  }

  if (typeof zkey === "string" && typeof window !== "undefined") {
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

  const proofBytes = formatGroth16ProofForSoroban(proof)
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
