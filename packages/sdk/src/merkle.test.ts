import { describe, expect, test } from "bun:test"
import { poseidon2 } from "poseidon-lite/poseidon2"

import { MerkleTree } from "./merkle"
import { FIELD_SIZE } from "./protocol"

// Shared vectors from shield-contracts/circuits/test-vectors (see README).
interface BatchVector {
  name: string
  depth: number
  leaves: string[]
  root: string
  claims: { leafIndex: number; pathElements: string[]; pathIndices: number[] }[]
}
const batchVectors: {
  emptyRoots: Record<string, string>
  batches: BatchVector[]
} = await Bun.file(
  new URL("../test-vectors/batch.json", import.meta.url)
).json()

/** Reference tree: pads to 2^depth leaves and hashes every node, like lib/merkleTree.js. */
function naiveTree(leaves: bigint[], depth: number) {
  const empty = Array<bigint>(2 ** depth - leaves.length).fill(0n)
  const levels: bigint[][] = [[...leaves, ...empty]]
  for (let k = 0; k < depth; k++) {
    const level = levels[k]!
    levels.push(
      Array.from({ length: level.length / 2 }, (_, i) =>
        poseidon2([level[2 * i]!, level[2 * i + 1]!])
      )
    )
  }
  const path = (index: number) => ({
    pathElements: levels
      .slice(0, depth)
      .map((level, k) => level[(index >> k) ^ 1]!),
    pathIndices: levels.slice(0, depth).map((_, k) => (index >> k) & 1),
  })
  return { root: levels[depth]![0]!, path }
}

describe("MerkleTree", () => {
  for (const [depth, root] of Object.entries(batchVectors.emptyRoots)) {
    test(`matches the shared empty-tree root at depth ${depth}`, () => {
      expect(new MerkleTree([], Number(depth)).root).toBe(BigInt(root))
    })
  }

  for (const v of batchVectors.batches) {
    test(`matches the shared batch vector: ${v.name}`, () => {
      const tree = new MerkleTree(v.leaves.map(BigInt), v.depth)
      expect(tree.root).toBe(BigInt(v.root))
      for (const claim of v.claims) {
        expect(tree.path(claim.leafIndex)).toEqual({
          pathElements: claim.pathElements.map(BigInt),
          pathIndices: claim.pathIndices,
        })
      }
    })
  }

  test("matches a tree that hashes every slot, for every leaf count at depth 3", () => {
    for (let n = 0; n <= 8; n++) {
      const leaves = Array.from({ length: n }, (_, i) => BigInt(1000 + i))
      const tree = new MerkleTree(leaves, 3)
      const reference = naiveTree(leaves, 3)
      expect(tree.root).toBe(reference.root)
      for (let i = 0; i < n; i++) {
        expect(tree.path(i)).toEqual(reference.path(i))
      }
    }
  })

  test("defaults to the protocol depth of 10", () => {
    const tree = new MerkleTree([1n])
    expect(tree.depth).toBe(10)
    expect(tree.path(0).pathElements).toHaveLength(10)
  })

  test("rejects too many leaves, non-field leaves and missing indices", () => {
    expect(() => new MerkleTree(Array(9).fill(1n), 3)).toThrow(RangeError)
    expect(() => new MerkleTree([FIELD_SIZE], 3)).toThrow(RangeError)
    const tree = new MerkleTree([1n, 2n], 3)
    for (const index of [-1, 2, 1.5]) {
      expect(() => tree.path(index)).toThrow(RangeError)
    }
  })
})
