import type { Batch, VaultConnection } from "./api"

/**
 * Funds a proved batch, step 3 of the end-to-end flow. Person 3's ShieldVaultClient
 * builds fund_batch and simulates it, so a call the vault would refuse never reaches
 * the wallet; stellar-sdk's signAndSend then has the wallet sign it and sends it.
 * Returns the transaction hash, for POST /v1/batches/:id/funding.
 */
export async function fundBatch({
  vault,
  batch,
  funder,
  token,
  signTx,
}: {
  vault: VaultConnection
  batch: Batch
  funder: string
  token: string
  signTx: (xdr: string) => Promise<string>
}): Promise<string> {
  if (!batch.proof) throw new Error("The batch has no conservation proof yet")

  // Loaded in the browser only
  const { ShieldVaultClient } = await import("@workspace/sdk/chain")
  const tx = await new ShieldVaultClient(vault).buildFundBatch({
    funder,
    batchId: BigInt(batch.batchId),
    token,
    root: BigInt(batch.root),
    total: BigInt(batch.total),
    proof: hexToBytes(batch.proof),
  })
  const sent = await tx.signAndSend({
    signTransaction: async (xdr) => ({
      signedTxXdr: await signTx(xdr),
      signerAddress: funder,
    }),
  })
  if (sent.result.isErr()) throw new Error(sent.result.unwrapErr().message)

  const hash = sent.sendTransactionResponse?.hash
  if (!hash) throw new Error("The network didn't return the transaction's hash")
  return hash
}

function hexToBytes(hex: string): Uint8Array {
  const digits = hex.replace(/^0x/, "")
  return Uint8Array.from(digits.match(/../g) ?? [], (byte) =>
    parseInt(byte, 16)
  )
}
