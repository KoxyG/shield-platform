import { allocationCommitment } from "./commitment"
import { isFieldElement } from "./field"
import { MerkleTree, type MerklePath } from "./merkle"
import { MAX_AMOUNT, MAX_BATCH_ID, TREE_DEPTH } from "./protocol"

/** One recipient's allocation. */
export interface Allocation {
  /** Amount in token base units, 1 to MAX_AMOUNT. */
  amount: bigint
  /** A fresh secret from generateSecret(), never given to anyone else. */
  secret: bigint
}

/**
 * What a recipient needs to claim their allocation, along with the batch's id
 * (architecture flow, step 4). Private: it includes the secret.
 */
export interface ClaimData extends MerklePath {
  leafIndex: number
  amount: bigint
  secret: bigint
}

/** A confidential batch, ready to prove and fund. */
export interface Batch {
  batchId: bigint
  /** Tree depth. The conservation circuit used to prove the batch must match it. */
  depth: number
  /** Merkle root of the allocation commitments: `root` in fund_batch. */
  root: bigint
  /** Sum of the allocations: `total` in fund_batch. */
  total: bigint
  /** The allocation commitments, in tree order. */
  leaves: bigint[]
  /** Claim data for each allocation, in the order the allocations were given. */
  claims: ClaimData[]
}

/**
 * Builds a batch: one commitment per allocation, in the order given, then the
 * Merkle tree, the total and every recipient's claim data. Mirrors
 * buildConservationInput in shield-contracts/circuits/lib/conservation.js.
 *
 * Rejects what the circuits or the vault would reject later, or what would
 * hurt a recipient:
 * - batchId must fit the vault's u64;
 * - a batch has 1 to 2^depth allocations;
 * - each amount is 1 to MAX_AMOUNT. The vault never pays out 0, so a zero
 *   allocation could never be claimed;
 * - each secret is a field element, used once. A recipient who shared a secret
 *   with their Merkle-path neighbour could also claim the neighbour's allocation:
 *   the neighbour's leaf is in their own path, so only the amount is left to
 *   guess.
 */
export function buildBatch(
  batchId: bigint,
  allocations: readonly Allocation[],
  depth: number = TREE_DEPTH
): Batch {
  if (batchId < 0n || batchId > MAX_BATCH_ID) {
    throw new RangeError(`Batch id out of range: ${batchId}`)
  }
  if (allocations.length === 0 || allocations.length > 2 ** depth) {
    throw new RangeError(
      `A batch has 1 to ${2 ** depth} allocations, got ${allocations.length}`
    )
  }
  const secrets = new Set<bigint>()
  allocations.forEach(({ amount, secret }, i) => {
    if (amount < 1n || amount > MAX_AMOUNT) {
      throw new RangeError(`Allocation ${i}: amount out of range: ${amount}`)
    }
    if (!isFieldElement(secret)) {
      throw new RangeError(`Allocation ${i}: secret must be a field element`)
    }
    if (secrets.has(secret)) {
      throw new RangeError(
        `Allocation ${i}: secret is already used by another allocation`
      )
    }
    secrets.add(secret)
  })

  const leaves = allocations.map(({ amount, secret }) =>
    allocationCommitment(amount, secret, batchId)
  )
  const tree = new MerkleTree(leaves, depth)
  const claims = allocations.map(({ amount, secret }, leafIndex) => ({
    leafIndex,
    amount,
    secret,
    ...tree.path(leafIndex),
  }))
  const total = allocations.reduce((sum, { amount }) => sum + amount, 0n)

  return { batchId, depth, root: tree.root, total, leaves, claims }
}

/** The conservation circuit's input, as snarkjs takes it. */
export interface ConservationInput {
  root: string
  total: string
  batchId: string
  amounts: string[]
  secrets: string[]
  active: string[]
}

/**
 * The input that proves a batch with the conservation circuit
 * (`Conservation(depth)`): all 2^depth slots, empty slots set to 0. The proof's
 * public signals come out as [root, total, batchId].
 */
export function conservationInput(batch: Batch): ConservationInput {
  const slots = 2 ** batch.depth
  const amounts = Array<string>(slots).fill("0")
  const secrets = Array<string>(slots).fill("0")
  const active = Array<string>(slots).fill("0")
  for (const { leafIndex, amount, secret } of batch.claims) {
    amounts[leafIndex] = amount.toString()
    secrets[leafIndex] = secret.toString()
    active[leafIndex] = "1"
  }
  return {
    root: batch.root.toString(),
    total: batch.total.toString(),
    batchId: batch.batchId.toString(),
    amounts,
    secrets,
    active,
  }
}
