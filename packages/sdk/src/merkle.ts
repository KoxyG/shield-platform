import { poseidon2 } from "poseidon-lite/poseidon2"

import { isFieldElement } from "./field"
import { TREE_DEPTH } from "./protocol"

/** A leaf's Merkle path, as the claim circuit takes it. */
export interface MerklePath {
  /** Sibling hashes, from the leaf's sibling up to a child of the root. */
  pathElements: bigint[]
  /** Bit k of the leaf index: 0 when the path's node at height k is a left child. */
  pathIndices: number[]
}

/**
 * A batch's Merkle tree: binary, parent = Poseidon(left, right), leaves in
 * insertion order and every other leaf 0. Mirrors lib/merkleTree.js and the
 * circuits in shield-contracts.
 *
 * The tree is hashed once, when it's built, so paths cost no hashing. Only the
 * filled part of each level is hashed; the rest of a level is empty subtrees,
 * whose hashes are fixed.
 */
export class MerkleTree {
  readonly depth: number
  readonly root: bigint
  /** levels[k]: the filled nodes at height k, from the left. levels[0] are the leaves. */
  private readonly levels: bigint[][]
  /** zeros[k]: the hash of an empty subtree of height k. */
  private readonly zeros: bigint[]

  constructor(leaves: readonly bigint[], depth: number = TREE_DEPTH) {
    if (!Number.isInteger(depth) || depth < 1) {
      throw new RangeError(`Tree depth must be a positive integer: ${depth}`)
    }
    if (leaves.length > 2 ** depth) {
      throw new RangeError(
        `A depth-${depth} tree holds at most ${2 ** depth} leaves, got ${leaves.length}`
      )
    }
    if (!leaves.every(isFieldElement)) {
      throw new RangeError("Leaves must be field elements")
    }
    this.depth = depth

    this.zeros = [0n]
    for (let k = 0; k < depth; k++) {
      this.zeros.push(hash(this.zeros[k]!, this.zeros[k]!))
    }

    this.levels = [[...leaves]]
    for (let k = 0; k < depth; k++) {
      const level = this.levels[k]!
      const parents: bigint[] = []
      for (let i = 0; i < level.length; i += 2) {
        parents.push(hash(level[i]!, level[i + 1] ?? this.zeros[k]!))
      }
      this.levels.push(parents)
    }
    this.root = this.levels[depth]![0] ?? this.zeros[depth]!
  }

  /** Number of leaves in the tree, not counting empty slots. */
  get size(): number {
    return this.levels[0]!.length
  }

  /** Returns the Merkle path of the leaf at `index`. */
  path(index: number): MerklePath {
    if (!Number.isInteger(index) || index < 0 || index >= this.size) {
      throw new RangeError(`No leaf at index ${index}`)
    }
    const pathElements: bigint[] = []
    const pathIndices: number[] = []
    for (let k = 0, i = index; k < this.depth; k++, i >>= 1) {
      pathElements.push(this.levels[k]![i ^ 1] ?? this.zeros[k]!)
      pathIndices.push(i & 1)
    }
    return { pathElements, pathIndices }
  }
}

function hash(left: bigint, right: bigint): bigint {
  return poseidon2([left, right])
}
