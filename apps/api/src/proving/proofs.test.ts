import { describe, expect, test } from "bun:test"
import {
  proofToBytes,
  type ConservationInput,
  type SnarkjsProof,
} from "@workspace/sdk"
import type { Express } from "express"
import { pino } from "pino"
import request from "supertest"

import { createApp } from "../app"
import { MemoryBatchStore } from "../db/memory-batches"
import type { ConservationProver } from "./conservation"
import { ConservationProofs } from "./proofs"

const CLAIM_DATA_KEY = Buffer.alloc(32, 5)

const PROOF: SnarkjsProof = {
  pi_a: ["1", "2", "1"],
  pi_b: [
    ["3", "4"],
    ["5", "6"],
    ["1", "0"],
  ],
  pi_c: ["7", "8", "1"],
}
const PROOF_HEX = "0x" + Buffer.from(proofToBytes(PROOF)).toString("hex")

/** Answers like the real prover: public signals [root, total, batchId]. */
const honest: ConservationProver = async (input) => ({
  proof: PROOF,
  publicSignals: [input.root, input.total, input.batchId],
})

function setup(prover: ConservationProver | null = honest) {
  const store = new MemoryBatchStore()
  const logger = pino({ level: "silent" })
  const proofs = prover
    ? new ConservationProofs({
        store,
        prover,
        claimDataKey: CLAIM_DATA_KEY,
        logger,
      })
    : undefined
  const app = createApp({
    config: { CORS_ORIGINS: ["http://localhost:5173"], CLAIM_DATA_KEY },
    logger,
    readinessChecks: {},
    batches: store,
    proofs,
  })
  return { app, store, proofs }
}

async function createBatch(app: Express): Promise<string> {
  const res = await request(app)
    .post("/v1/batches")
    .send({
      allocations: [
        { recipient: "receiver-alice", amount: "500000000" },
        { recipient: "receiver-bob", amount: "300000000" },
      ],
    })
  return res.body.batchId
}

describe("POST /v1/batches/:batchId/prove", () => {
  test("proves a created batch in the background, storing the proof fund_batch takes", async () => {
    const inputs: ConservationInput[] = []
    const { app, proofs } = setup(async (input) => {
      inputs.push(input)
      return honest(input)
    })
    const id = await createBatch(app)

    const started = await request(app).post(`/v1/batches/${id}/prove`)
    expect(started.status).toBe(202)
    expect(started.body.status).toBe("proving")

    await proofs!.idle()
    const res = await request(app).get(`/v1/batches/${id}`)
    expect(res.body.status).toBe("proved")
    expect(res.body.proof).toBe(PROOF_HEX)
    expect(res.body).not.toHaveProperty("error")

    // The prover got the whole depth-10 batch: 1024 slots, two of them filled
    const [input] = inputs
    expect([input!.root, input!.total, input!.batchId]).toEqual([
      res.body.root,
      "800000000",
      id,
    ])
    expect(input!.amounts).toHaveLength(1024)
    expect(input!.active.filter((flag) => flag === "1")).toHaveLength(2)
  })

  test("records a failed proof, and proves the batch again on request", async () => {
    let calls = 0
    const { app, proofs } = setup(async (input) => {
      if (calls++ === 0) throw new Error("Prover exited with code 1")
      return honest(input)
    })
    const id = await createBatch(app)

    await request(app).post(`/v1/batches/${id}/prove`)
    await proofs!.idle()
    const failed = await request(app).get(`/v1/batches/${id}`)
    expect(failed.body).toMatchObject({
      status: "failed",
      error: "Prover exited with code 1",
    })

    const retried = await request(app).post(`/v1/batches/${id}/prove`)
    expect(retried.status).toBe(202)
    expect(retried.body).not.toHaveProperty("error")
    await proofs!.idle()
    const res = await request(app).get(`/v1/batches/${id}`)
    expect(res.body.status).toBe("proved")
  })

  test("rejects a proof whose public signals aren't the batch's [root, total, batchId]", async () => {
    const { app, proofs } = setup(async (input) => ({
      proof: PROOF,
      publicSignals: [input.root, "1", input.batchId],
    }))
    const id = await createBatch(app)

    await request(app).post(`/v1/batches/${id}/prove`)
    await proofs!.idle()
    const res = await request(app).get(`/v1/batches/${id}`)
    expect(res.body.status).toBe("failed")
    expect(res.body.error).toContain("public signals")
    expect(res.body).not.toHaveProperty("proof")
  })

  test("doesn't prove a batch whose stored allocations don't rebuild it", async () => {
    let proverCalled = false
    const { app, store, proofs } = setup(async (input) => {
      proverCalled = true
      return honest(input)
    })
    const id = await createBatch(app)
    store.batches.get(BigInt(id))!.total += 1n

    await request(app).post(`/v1/batches/${id}/prove`)
    await proofs!.idle()
    const res = await request(app).get(`/v1/batches/${id}`)
    expect(res.body.status).toBe("failed")
    expect(res.body.error).toContain("don't rebuild")
    expect(proverCalled).toBe(false)
  })

  test("only proves a created or failed batch", async () => {
    let release!: () => void
    const gate = new Promise<void>((resolve) => (release = resolve))
    const { app, proofs } = setup(async (input) => {
      await gate
      return honest(input)
    })
    const id = await createBatch(app)
    await request(app).post(`/v1/batches/${id}/prove`)

    const whileProving = await request(app).post(`/v1/batches/${id}/prove`)
    expect(whileProving.status).toBe(409)
    expect(whileProving.body.error.code).toBe("invalid_status")

    release()
    await proofs!.idle()
    const onceProved = await request(app).post(`/v1/batches/${id}/prove`)
    expect(onceProved.status).toBe(409)
  })

  test("returns 503 when proving isn't configured, and 404 for an unknown batch", async () => {
    const off = setup(null)
    const id = await createBatch(off.app)
    const res = await request(off.app).post(`/v1/batches/${id}/prove`)
    expect(res.status).toBe(503)
    expect(res.body.error.code).toBe("proving_unavailable")

    const missing = await request(setup().app).post("/v1/batches/12345/prove")
    expect(missing.status).toBe(404)
  })
})
