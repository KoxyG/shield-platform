import { buildBatch, conservationInput, proofToBytes } from "@workspace/sdk"
import type { Logger } from "pino"

import { openClaim, type BatchStore } from "../db/batches"
import type { ConservationProver } from "./conservation"

type Deps = {
  store: BatchStore
  prover: ConservationProver
  claimDataKey: Uint8Array
  logger: Logger
}

/**
 * Generates batches' conservation proofs (step 2 of the end-to-end flow) in the
 * background, one at a time: a depth-10 proof takes minutes and gigabytes.
 *
 * Follows shield-contracts' scripts/export-conservation-fixture.js: rebuild the
 * circuit input from the allocations and check it against the stored batch, prove
 * and verify, then check that the public signals are the batch's
 * [root, total, batchId], the order fund_batch passes them to the verifier.
 */
export class ConservationProofs {
  private readonly deps: Deps
  private queue: Promise<void> = Promise.resolve()

  constructor(deps: Deps) {
    this.deps = deps
  }

  /** Proves a batch in status "proving", after the proofs already started. */
  start(batchId: bigint): void {
    this.queue = this.queue.then(() => this.prove(batchId))
  }

  /** Resolves once every proof started so far has finished. */
  idle(): Promise<void> {
    return this.queue
  }

  private async prove(batchId: bigint): Promise<void> {
    const { store, prover, claimDataKey, logger } = this.deps
    try {
      const batch = await store.get(batchId)
      if (batch?.status !== "proving") return

      const claims = (await store.allocations(batchId)).map((allocation) =>
        openClaim(claimDataKey, allocation)
      )
      const rebuilt = buildBatch(batchId, claims, batch.depth)
      if (rebuilt.root !== batch.root || rebuilt.total !== batch.total) {
        throw new Error(
          "The stored allocations don't rebuild the batch's root and total"
        )
      }

      const { proof, publicSignals } = await prover(conservationInput(rebuilt))
      const expected = [batch.root, batch.total, batchId].map(String)
      if (publicSignals.join() !== expected.join()) {
        throw new Error(
          "The proof's public signals aren't the batch's [root, total, batchId]"
        )
      }

      const bytes = proofToBytes(proof)
      await store.setStatus(batchId, "proving", "proved", {
        proof: "0x" + Buffer.from(bytes).toString("hex"),
      })
    } catch (err) {
      // Messages come from these checks, the decryption or the prover's stderr:
      // none of them hold claim data.
      const message = err instanceof Error ? err.message : String(err)
      logger.error(
        { err, batchId: String(batchId) },
        "conservation proof failed"
      )
      await store
        .setStatus(batchId, "proving", "failed", {
          error: message.slice(0, 500),
        })
        .catch((e: unknown) =>
          logger.error({ err: e }, "could not record a failed proof")
        )
    }
  }
}
