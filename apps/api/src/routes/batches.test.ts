import { describe, expect, test } from "bun:test"
import { MAX_ALLOCATIONS, MAX_AMOUNT, buildBatch } from "@workspace/sdk"
import { pino } from "pino"
import request from "supertest"

import { createApp } from "../app"
import {
  BatchIdTakenError,
  openClaim,
  type AllocationRecord,
  type BatchRecord,
} from "../db/batches"
import { MemoryBatchStore } from "../db/memory-batches"
import { jsonReplacer } from "../lib/json"

const CLAIM_DATA_KEY = Buffer.alloc(32, 9)

function makeApp(
  store = new MemoryBatchStore(),
  logger = pino({ level: "silent" })
) {
  const app = createApp({
    config: { CORS_ORIGINS: ["http://localhost:5173"], CLAIM_DATA_KEY },
    logger,
    readinessChecks: {},
    batches: store,
  })
  return { app, store }
}

const ALLOCATIONS = [
  { recipient: "receiver-alice", amount: "500000000" },
  { recipient: "receiver-bob", amount: "300000000" },
  { recipient: "receiver-carol", amount: "200000000" },
]

describe("POST /v1/batches", () => {
  test("builds and stores a batch, and returns its public summary", async () => {
    const { app, store } = makeApp()
    const res = await request(app)
      .post("/v1/batches")
      .send({ name: "October stipends", allocations: ALLOCATIONS })

    expect(res.status).toBe(201)
    expect(res.body).toEqual({
      batchId: expect.stringMatching(/^\d+$/),
      name: "October stipends",
      status: "created",
      root: expect.stringMatching(/^\d+$/),
      total: "1000000000",
      recipientCount: 3,
      createdAt: expect.any(String),
    })
    expect(store.batches.get(BigInt(res.body.batchId))?.root).toBe(
      BigInt(res.body.root)
    )
  })

  test("stores each recipient's claim data encrypted, in input order", async () => {
    const { app, store } = makeApp()
    const res = await request(app)
      .post("/v1/batches")
      .send({ allocations: ALLOCATIONS })
    const batchId = BigInt(res.body.batchId)
    const allocations = await store.allocations(batchId)

    expect(allocations.map((a) => [a.leafIndex, a.recipient])).toEqual([
      [0, "receiver-alice"],
      [1, "receiver-bob"],
      [2, "receiver-carol"],
    ])
    for (const allocation of allocations) {
      // Encrypted at rest: the stored record shows neither amount nor secret
      const claim = openClaim(CLAIM_DATA_KEY, allocation)
      const stored = JSON.stringify(allocation, jsonReplacer)
      expect(stored).not.toContain(claim.secret.toString())
      expect(stored).not.toContain(claim.amount.toString())
      expect(claim.batchId).toBe(batchId)
      expect(claim.amount).toBe(
        BigInt(ALLOCATIONS[allocation.leafIndex]!.amount)
      )
    }
  })

  test("stores claim data that rebuilds the same batch: the recipients can claim", async () => {
    const { app, store } = makeApp()
    const res = await request(app)
      .post("/v1/batches")
      .send({ allocations: ALLOCATIONS })
    const batchId = BigInt(res.body.batchId)
    const claims = (await store.allocations(batchId)).map((a) =>
      openClaim(CLAIM_DATA_KEY, a)
    )

    // Independent rebuild from the decrypted amounts and secrets
    const rebuilt = buildBatch(batchId, claims)
    expect(rebuilt.root).toBe(BigInt(res.body.root))
    expect(rebuilt.claims).toEqual(claims.map(({ batchId: _, ...c }) => c))
    // Every secret is fresh
    expect(new Set(claims.map((c) => c.secret)).size).toBe(claims.length)
  })

  test("never returns or logs secrets", async () => {
    const lines: string[] = []
    const logger = pino(
      { level: "trace" },
      { write: (l: string) => lines.push(l) }
    )
    const { app, store } = makeApp(new MemoryBatchStore(), logger)
    const res = await request(app)
      .post("/v1/batches")
      .send({ allocations: ALLOCATIONS })

    const claims = (await store.allocations(BigInt(res.body.batchId))).map(
      (a) => openClaim(CLAIM_DATA_KEY, a)
    )
    const output = JSON.stringify(res.body) + lines.join("\n")
    expect(lines.length).toBeGreaterThan(0)
    for (const { secret } of claims) {
      expect(output).not.toContain(secret.toString())
    }
    expect(output).not.toContain("receiver-alice")
  })

  test("gives every batch a different random id", async () => {
    const { app } = makeApp()
    const ids = new Set<string>()
    for (let i = 0; i < 5; i++) {
      const res = await request(app)
        .post("/v1/batches")
        .send({ allocations: ALLOCATIONS })
      ids.add(res.body.batchId)
    }
    expect(ids.size).toBe(5)
  })

  test("retries with a new id if the first one is taken", async () => {
    class TakenOnce extends MemoryBatchStore {
      calls = 0
      override async create(b: BatchRecord, a: AllocationRecord[]) {
        if (this.calls++ === 0) throw new BatchIdTakenError(b.batchId)
        return super.create(b, a)
      }
    }
    const { app, store } = makeApp(new TakenOnce())
    const res = await request(app)
      .post("/v1/batches")
      .send({ allocations: ALLOCATIONS })
    expect(res.status).toBe(201)
    expect((store as TakenOnce).calls).toBe(2)
  })

  test("accepts a full batch of 1024 recipients", async () => {
    const { app } = makeApp()
    const allocations = Array.from({ length: MAX_ALLOCATIONS }, (_, i) => ({
      recipient: `receiver-${i}`,
      amount: "1",
    }))
    const res = await request(app).post("/v1/batches").send({ allocations })
    expect(res.status).toBe(201)
    expect(res.body.recipientCount).toBe(1024)
  })

  const invalid: [string, object, (string | number)[]][] = [
    ["no allocations", { allocations: [] }, ["allocations"]],
    [
      "more allocations than a batch holds",
      {
        allocations: Array.from({ length: MAX_ALLOCATIONS + 1 }, (_, i) => ({
          recipient: `r${i}`,
          amount: "1",
        })),
      },
      ["allocations"],
    ],
    [
      "a zero amount",
      { allocations: [{ recipient: "r", amount: "0" }] },
      ["allocations", 0, "amount"],
    ],
    [
      "a negative amount",
      { allocations: [{ recipient: "r", amount: "-5" }] },
      ["allocations", 0, "amount"],
    ],
    [
      "a fractional amount",
      { allocations: [{ recipient: "r", amount: "1.5" }] },
      ["allocations", 0, "amount"],
    ],
    [
      "an amount sent as a JSON number",
      { allocations: [{ recipient: "r", amount: 5 }] },
      ["allocations", 0, "amount"],
    ],
    [
      "an amount above 64 bits",
      {
        allocations: [{ recipient: "r", amount: (MAX_AMOUNT + 1n).toString() }],
      },
      ["allocations", 0, "amount"],
    ],
    [
      "an empty recipient",
      { allocations: [{ recipient: " ", amount: "1" }] },
      ["allocations", 0, "recipient"],
    ],
    [
      "the same recipient twice",
      {
        allocations: [
          { recipient: "r", amount: "1" },
          { recipient: "r", amount: "2" },
        ],
      },
      ["allocations", 1, "recipient"],
    ],
  ]
  for (const [name, body, path] of invalid) {
    test(`rejects ${name}`, async () => {
      const { app, store } = makeApp()
      const res = await request(app).post("/v1/batches").send(body)
      expect(res.status).toBe(400)
      expect(res.body.error.code).toBe("validation_error")
      expect(
        res.body.error.details.map((d: { path: unknown }) => d.path)
      ).toContainEqual(path)
      expect(store.batches.size).toBe(0)
    })
  }
})

describe("GET /v1/batches", () => {
  test("returns a batch's summary by id", async () => {
    const { app } = makeApp()
    const created = await request(app)
      .post("/v1/batches")
      .send({ allocations: ALLOCATIONS })
    const res = await request(app).get(`/v1/batches/${created.body.batchId}`)
    expect(res.status).toBe(200)
    expect(res.body).toEqual(created.body)
  })

  test("returns 404 for an unknown batch and 400 for a malformed id", async () => {
    const { app } = makeApp()
    const missing = await request(app).get("/v1/batches/12345")
    expect(missing.status).toBe(404)
    expect(missing.body.error.code).toBe("batch_not_found")
    for (const id of ["abc", "-1", "18446744073709551616"]) {
      const res = await request(app).get(`/v1/batches/${id}`)
      expect(res.status).toBe(400)
    }
  })

  test("lists batches newest first, up to the limit", async () => {
    const { app, store } = makeApp()
    const ids: string[] = []
    for (let i = 0; i < 3; i++) {
      const res = await request(app)
        .post("/v1/batches")
        .send({ allocations: ALLOCATIONS })
      ids.push(res.body.batchId)
      // Distinct creation times, oldest first
      store.batches.get(BigInt(res.body.batchId))!.createdAt = new Date(
        Date.UTC(2026, 9, 1 + i)
      )
    }
    const res = await request(app).get("/v1/batches?limit=2")
    expect(res.status).toBe(200)
    expect(res.body.batches.map((b: { batchId: string }) => b.batchId)).toEqual(
      [ids[2], ids[1]]
    )
    expect(res.body.batches[0]).not.toHaveProperty("depth")
  })
})
