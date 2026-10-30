import { describe, expect, test } from "bun:test"
import { buildBatch, conservationInput, proofToBytes } from "@workspace/sdk"
import { pino } from "pino"

import { sealClaim } from "../db/batches"
import { MemoryBatchStore } from "../db/memory-batches"
import { nodeConservationProver } from "./conservation"
import { ConservationProofs } from "./proofs"

/*
 * The real prover: shield-contracts' circuits/lib/conservation.js in a Node child
 * process. Skipped unless CONSERVATION_TEST_CIRCUITS_DIR points at shield-contracts'
 * circuits directory after `pnpm build`, which sets up test_conservation (depth 3):
 *   CONSERVATION_TEST_CIRCUITS_DIR=../../../shield-contracts/circuits bun test
 */
const circuitsDir = process.env.CONSERVATION_TEST_CIRCUITS_DIR

// test_conservation.circom is Conservation(3); production batches use depth 10
const CIRCUIT = "test_conservation"
const DEPTH = 3

// The depth-3 batch of circuits/test-vectors/batch.json
const ALLOCATIONS = [
  { amount: 50n, secret: 111111111n },
  { amount: 30n, secret: 222222222n },
  { amount: 20n, secret: 333333333n },
]

describe.skipIf(!circuitsDir)("nodeConservationProver", () => {
  test("proves a batch, with public signals [root, total, batchId]", async () => {
    const prove = nodeConservationProver(circuitsDir!, CIRCUIT)
    const batch = buildBatch(42n, ALLOCATIONS, DEPTH)

    const { proof, publicSignals } = await prove(conservationInput(batch))
    expect(publicSignals).toEqual([batch.root, batch.total, 42n].map(String))
    expect(proofToBytes(proof)).toHaveLength(256)
  }, 60_000)

  test("fails without echoing the input when the allocations don't add up", async () => {
    const prove = nodeConservationProver(circuitsDir!, CIRCUIT)
    const input = conservationInput(buildBatch(42n, ALLOCATIONS, DEPTH))
    input.total = "101"

    const err = await prove(input).then(
      () => undefined,
      (e: Error) => e
    )
    expect(err?.message).toContain("Assert Failed")
    expect(err?.message).not.toContain("111111111")
  }, 60_000)

  test("takes a stored batch from proving to proved", async () => {
    const store = new MemoryBatchStore()
    const key = Buffer.alloc(32, 6)
    const batch = buildBatch(7n, ALLOCATIONS, DEPTH)
    await store.create(
      {
        batchId: 7n,
        name: null,
        status: "proving",
        root: batch.root,
        total: batch.total,
        depth: DEPTH,
        recipientCount: ALLOCATIONS.length,
        createdAt: new Date(),
      },
      batch.claims.map((claim) => ({
        batchId: 7n,
        leafIndex: claim.leafIndex,
        recipient: `receiver-${claim.leafIndex}`,
        claim: sealClaim(key, 7n, claim),
      }))
    )
    const proofs = new ConservationProofs({
      store,
      prover: nodeConservationProver(circuitsDir!, CIRCUIT),
      claimDataKey: key,
      logger: pino({ level: "silent" }),
    })

    proofs.start(7n)
    await proofs.idle()
    const proved = await store.get(7n)
    expect(proved?.status).toBe("proved")
    expect(proved?.proof).toMatch(/^0x[0-9a-f]{512}$/)
  }, 60_000)
})
