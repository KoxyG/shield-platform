import { afterAll, beforeAll, describe, expect, test } from "bun:test"
import { MongoClient, type Db } from "mongodb"

import { encrypt } from "../lib/encryption"
import {
  BatchIdTakenError,
  MongoBatchStore,
  type AllocationRecord,
  type BatchRecord,
} from "./batches"

/*
 * MongoBatchStore against a real MongoDB. Skipped unless MONGODB_TEST_URI points
 * at one, e.g. the compose service:
 *   MONGODB_TEST_URI=mongodb://localhost:27017/shieldzk_test bun test
 * The test database is dropped afterwards.
 */
const uri = process.env.MONGODB_TEST_URI

const key = Buffer.alloc(32, 3)

function batch(batchId: bigint, createdAt = new Date()): BatchRecord {
  return {
    batchId,
    name: null,
    status: "created",
    root: 123n << 200n,
    total: 1_000_000_000n,
    depth: 10,
    recipientCount: 2,
    createdAt,
  }
}

function allocations(batchId: bigint): AllocationRecord[] {
  return [0, 1].map((leafIndex) => ({
    batchId,
    leafIndex,
    recipient: `receiver-${batchId}-${leafIndex}`,
    claim: encrypt(key, `claim ${leafIndex}`, "ctx"),
  }))
}

describe.skipIf(!uri)("MongoBatchStore", () => {
  let client: MongoClient
  let db: Db
  let store: MongoBatchStore

  beforeAll(async () => {
    client = await MongoClient.connect(uri!)
    db = client.db()
    await db.dropDatabase()
    store = new MongoBatchStore(db)
    await store.ensureIndexes()
  })

  afterAll(async () => {
    await db.dropDatabase()
    await client.close()
  })

  test("stores a batch and its allocations, keeping u64 ids and field elements exact", async () => {
    const id = (1n << 64n) - 1n
    const created = batch(id)
    const stored = allocations(id)
    await store.create(created, stored)

    expect(await store.get(id)).toEqual(created)
    expect(await store.allocations(id)).toEqual(stored)
    expect(await store.get(42n)).toBeUndefined()
  })

  test("refuses a batch id that's already in use, and leaves the first batch intact", async () => {
    const id = 7n
    await store.create(batch(id), allocations(id))
    const before = await store.allocations(id)

    await expect(
      store.create(batch(id), allocations(id))
    ).rejects.toBeInstanceOf(BatchIdTakenError)
    expect(await store.allocations(id)).toEqual(before)
  })

  test("treats leftover allocations from an interrupted create as a taken id", async () => {
    // Allocations without a batch: what a crash between the two inserts leaves
    const id = 8n
    await db.collection("confidential_allocations").insertOne({
      ...allocations(id)[0]!,
      batchId: id.toString(),
    })
    await expect(
      store.create(batch(id), allocations(id))
    ).rejects.toBeInstanceOf(BatchIdTakenError)
    expect(await store.get(id)).toBeUndefined()
  })

  test("lists batches newest first", async () => {
    await store.create(
      batch(100n, new Date(Date.UTC(2026, 0, 1))),
      allocations(100n)
    )
    await store.create(
      batch(101n, new Date(Date.UTC(2026, 0, 2))),
      allocations(101n)
    )
    const listed = (await store.list(50)).map((b) => b.batchId)
    expect(listed.indexOf(101n)).toBeLessThan(listed.indexOf(100n))
    expect(await store.list(1)).toHaveLength(1)
  })

  test("moves a batch to a new status only from the expected one", async () => {
    const id = 200n
    await store.create(batch(id), allocations(id))

    expect(await store.setStatus(id, "proved", "failed")).toBe(false)
    expect(await store.setStatus(id, "created", "proving")).toBe(true)
    expect(
      await store.setStatus(id, "proving", "failed", { error: "boom" })
    ).toBe(true)
    expect((await store.get(id))?.error).toBe("boom")

    // Leaving "failed" clears the error
    expect(await store.setStatus(id, "failed", "proving")).toBe(true)
    expect(await store.get(id)).not.toHaveProperty("error")

    expect(
      await store.setStatus(id, "proving", "proved", { proof: "0xab" })
    ).toBe(true)
    expect(await store.get(id)).toMatchObject({
      status: "proved",
      proof: "0xab",
    })
    const proved = (await store.withStatus("proved")).map((b) => b.batchId)
    expect(proved).toContain(id)

    // Funding keeps the proof and adds who paid, in what, and when
    const fundedAt = new Date(Date.UTC(2026, 9, 29))
    const funding = {
      funder: "GCFIRY65OQE7DFP5KLNS2PF2LVZMUZYJX4OZIEQ36N2IQANUB5XVYOJR",
      token: "CABAEAQCAIBAEAQCAIBAEAQCAIBAEAQCAIBAEAQCAIBAEAQCAIBAFNSZ",
      fundingTx: "ab".repeat(32),
      fundedAt,
    }
    expect(await store.setStatus(id, "proved", "funded", funding)).toBe(true)
    expect(await store.get(id)).toMatchObject({
      status: "funded",
      proof: "0xab",
      ...funding,
    })
  })
})
