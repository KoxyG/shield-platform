/*
 * Stand-in for the shared wallet component Person 3 is building (team.md: "P3
 * builds one shared wallet component; P1 and P2 reuse it"). Freighter only. When
 * that component lands, replace these two functions with it.
 *
 * Freighter is loaded on first use, in the browser, so the server never imports it.
 */
import type { VaultTransaction } from "@workspace/sdk/chain"

/** The signer stellar-sdk's signAndSend takes, for Person 3's vault transactions. */
export type SignTransaction = NonNullable<
  NonNullable<Parameters<VaultTransaction["signAndSend"]>[0]>["signTransaction"]
>

/** Asks Freighter for access, and returns the connected account's address. */
export async function connectWallet(): Promise<string> {
  const freighter = await import("@stellar/freighter-api")
  if (!(await freighter.isConnected()).isConnected) {
    throw new Error("Freighter isn't installed in this browser")
  }
  const { address, error } = await freighter.requestAccess()
  if (error) throw new Error(error.message)
  return address
}

/** Signs a transaction with Freighter. */
export const signTransaction: SignTransaction = async (xdr, opts) => {
  const freighter = await import("@stellar/freighter-api")
  const { signedTxXdr, signerAddress, error } = await freighter.signTransaction(
    xdr,
    { networkPassphrase: opts?.networkPassphrase, address: opts?.address }
  )
  if (error) throw new Error(error.message)
  return { signedTxXdr, signerAddress }
}
