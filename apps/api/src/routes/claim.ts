import { Router } from "express"
import { z } from "zod"
import { ShieldVaultClient } from "@workspace/sdk/chain"
import { addressToField, TESTNET_CONFIG } from "@workspace/sdk"
import { validated } from "../lib/validated"
import { HttpError } from "../lib/http-error"

const CheckClaimSchema = z.object({
  batchId: z.coerce.bigint(),
  nullifier: z
    .string()
    .regex(/^(0x)?[0-9a-fA-F]{64}$/, "Must be a 32-byte hex string"),
  recipient: z.string().min(50).max(60).optional(),
})

export function claimRouter(vaultClient?: ShieldVaultClient): Router {
  const router = Router()
  const client =
    vaultClient ??
    new ShieldVaultClient({
      contractId: TESTNET_CONFIG.contracts.vault,
      networkPassphrase: TESTNET_CONFIG.networkPassphrase,
      rpcUrl: TESTNET_CONFIG.rpcUrl,
    })

  /**
   * Checks whether a batch exists and whether a nullifier is unspent.
   */
  router.post(
    "/v1/claims/check",
    validated({ body: CheckClaimSchema }, async ({ body }, _req, res) => {
      const { batchId, nullifier, recipient } = body

      // 1. Check if the batch exists in the vault
      const batch = await client.getBatch(batchId)
      if (!batch) {
        throw new HttpError(404, "BATCH_NOT_FOUND", `Batch ${batchId} was not found on-chain`)
      }

      // 2. Format nullifier as bigint
      const cleanNullifier = nullifier.startsWith("0x")
        ? nullifier.slice(2)
        : nullifier
      const nullifierBigInt = BigInt("0x" + cleanNullifier)

      // 3. Check if nullifier has already been used
      const isSpent = await client.isNullifierUsed(batchId, nullifierBigInt)

      let recipientField: string | undefined
      if (recipient) {
        try {
          const field = await addressToField(recipient)
          recipientField = field.toString()
        } catch {
          throw new HttpError(400, "INVALID_RECIPIENT", "Invalid Stellar recipient address")
        }
      }

      res.json({
        batchId: batchId.toString(),
        batch: {
          root: "0x" + batch.root.toString(16).padStart(64, "0"),
          total: batch.total.toString(),
          withdrawn: batch.withdrawn.toString(),
          token: batch.token,
        },
        nullifier: "0x" + cleanNullifier,
        isSpent,
        isEligible: !isSpent && batch.withdrawn < batch.total,
        recipientField,
      })
    })
  )

  return router
}
