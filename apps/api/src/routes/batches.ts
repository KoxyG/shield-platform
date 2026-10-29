import {
  MAX_ALLOCATIONS,
  MAX_AMOUNT,
  MAX_BATCH_ID,
  buildBatch,
  generateSecret,
} from "@workspace/sdk"
import { Router } from "express"
import { z } from "zod"

import {
  BatchIdTakenError,
  sealClaim,
  type BatchRecord,
  type BatchStore,
} from "../db/batches"
import { HttpError } from "../lib/http-error"
import { validated } from "../lib/validated"

/** What the API shows of a batch: never its allocations, which hold the secrets. */
export type BatchSummary = Omit<BatchRecord, "depth">

const BatchId = z
  .string()
  .regex(/^\d{1,20}$/, "must be a decimal batch id")
  .transform(BigInt)
  .refine((id) => id <= MAX_BATCH_ID, "must fit in a u64")

const AllocationInput = z.object({
  /** The disburser's reference for the recipient, e.g. an SDP receiver id. */
  recipient: z.string().trim().min(1).max(256),
  // A string, not a JSON number: amounts go past 2^53.
  amount: z
    .string()
    .regex(/^[1-9]\d{0,19}$/, "must be a positive whole number of base units")
    .transform(BigInt)
    .refine((amount) => amount <= MAX_AMOUNT, "must fit in 64 bits"),
})

const CreateBatchBody = z
  .object({
    name: z.string().trim().min(1).max(100).optional(),
    allocations: z.array(AllocationInput).min(1).max(MAX_ALLOCATIONS),
  })
  .superRefine(({ allocations }, ctx) => {
    const seen = new Set<string>()
    allocations.forEach(({ recipient }, i) => {
      if (seen.has(recipient)) {
        ctx.addIssue({
          code: "custom",
          path: ["allocations", i, "recipient"],
          message: "Recipient appears more than once: combine their amounts",
        })
      }
      seen.add(recipient)
    })
  })

const ListQuery = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
})

// Batch ids are random, so they don't reveal how many batches an organisation has
// made. Picking one that's in use is astronomically unlikely, and costs a retry.
const ID_ATTEMPTS = 3

export function batchesRouter({
  store,
  claimDataKey,
}: {
  store: BatchStore
  claimDataKey: Uint8Array
}): Router {
  const router = Router()

  // Builds a batch from recipients and amounts: a secret per recipient, the
  // commitments and the Merkle tree. Each recipient's claim data (amount, secret,
  // Merkle path) is stored encrypted for delivery, never returned here.
  router.post(
    "/batches",
    validated({ body: CreateBatchBody }, async ({ body }, _req, res) => {
      const allocations = body.allocations.map(({ amount }) => ({
        amount,
        secret: generateSecret(),
      }))
      for (let attempt = 1; ; attempt++) {
        const batchId = randomBatchId()
        const batch = buildBatch(batchId, allocations)
        const record: BatchRecord = {
          batchId,
          name: body.name ?? null,
          status: "created",
          root: batch.root,
          total: batch.total,
          depth: batch.depth,
          recipientCount: batch.claims.length,
          createdAt: new Date(),
        }
        try {
          await store.create(
            record,
            batch.claims.map((claim) => ({
              batchId,
              leafIndex: claim.leafIndex,
              recipient: body.allocations[claim.leafIndex]!.recipient,
              claim: sealClaim(claimDataKey, batchId, claim),
            }))
          )
          res.status(201).json(summary(record))
          return
        } catch (err) {
          if (!(err instanceof BatchIdTakenError) || attempt >= ID_ATTEMPTS) {
            throw err
          }
        }
      }
    })
  )

  router.get(
    "/batches",
    validated({ query: ListQuery }, async ({ query }, _req, res) => {
      const batches = await store.list(query.limit)
      res.json({ batches: batches.map(summary) })
    })
  )

  router.get(
    "/batches/:batchId",
    validated(
      { params: z.object({ batchId: BatchId }) },
      async ({ params }, _req, res) => {
        const batch = await store.get(params.batchId)
        if (!batch) {
          throw new HttpError(404, "batch_not_found", "No batch with this id")
        }
        res.json(summary(batch))
      }
    )
  )

  return router
}

function randomBatchId(): bigint {
  return crypto.getRandomValues(new BigUint64Array(1))[0]!
}

function summary({ depth: _, ...batch }: BatchRecord): BatchSummary {
  return batch
}
