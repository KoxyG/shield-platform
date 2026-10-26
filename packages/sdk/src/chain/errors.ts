import { VaultError } from "./vault-bindings"

/**
 * User-facing text for each vault error. Keys are the variant names of `VaultError`
 * in shield-contracts/contracts/shield-vault/src/lib.rs; a test checks that they
 * match the generated bindings.
 */
export const VAULT_ERROR_MESSAGES = {
  BatchNotFound: "This batch doesn't exist on the vault.",
  NullifierUsed: "This allocation has already been claimed.",
  InvalidProof: "The proof isn't valid for this claim.",
  InvalidAmount: "The amount must be between 1 and 2^64 - 1 base units.",
  InsufficientBatchFunds:
    "The batch doesn't have enough funds left for this claim.",
  NonCanonicalNullifier: "The nullifier isn't a valid field element.",
  BatchExists: "A batch with this id is already registered.",
  InvalidTotal: "The batch total must be greater than zero.",
  NonCanonicalRoot: "The Merkle root isn't a valid field element.",
} as const

export type VaultErrorName = keyof typeof VAULT_ERROR_MESSAGES

/** A call the vault rejected. `code` says why, e.g. "NullifierUsed" for a double claim. */
export class VaultContractError extends Error {
  override readonly name = "VaultContractError"

  constructor(readonly code: VaultErrorName) {
    super(VAULT_ERROR_MESSAGES[code])
  }
}

/** How Soroban prints a contract error, e.g. "Error(Contract, #2)". */
const CONTRACT_ERROR = /Error\(Contract, #(\d+)\)/

/**
 * Returns the vault error behind `error`, or undefined if it isn't one.
 *
 * Reads the error code from Soroban's error text, e.g. "Error(Contract, #2)". That text
 * appears in a failed simulation (`tx.simulation.error`) and in a failed submission.
 * The SDK's own `Err` result is no use here: it carries the error's doc comment, not
 * its code.
 */
export function toVaultError(error: unknown): VaultContractError | undefined {
  if (error instanceof VaultContractError) return error

  const match = String(error).match(CONTRACT_ERROR)
  if (!match) return undefined
  const code = Number(match[1]) as keyof typeof VaultError
  return fromName(VaultError[code]?.message)
}

function fromName(name: string | undefined): VaultContractError | undefined {
  if (name === undefined || !Object.hasOwn(VAULT_ERROR_MESSAGES, name)) {
    return undefined
  }
  return new VaultContractError(name as VaultErrorName)
}
