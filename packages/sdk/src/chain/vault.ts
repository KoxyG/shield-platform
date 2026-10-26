import type {
  AssembledTransaction,
  ClientOptions,
  Result,
} from "@stellar/stellar-sdk/contract"

import {
  assertAmount,
  assertBatchId,
  bytes32ToField,
  fieldToBytes32,
} from "./encoding"
import { toVaultError } from "./errors"
import { Client } from "./vault-bindings"

/** Where the vault lives. The contract id comes from config, never from code. */
export type VaultConnection = Pick<
  ClientOptions,
  "contractId" | "networkPassphrase" | "rpcUrl" | "allowHttp"
>

/** A funded batch, as stored by the vault. */
export interface VaultBatch {
  /** Merkle root of the batch's allocation commitments. */
  root: bigint
  /** Token contract the batch was funded in. */
  token: string
  /** Amount deposited, in token base units. */
  total: bigint
  /** Amount paid out so far. Never exceeds `total`. */
  withdrawn: bigint
}

export interface FundBatchParams {
  /** Account that pays `total` and signs the transaction. */
  funder: string
  batchId: bigint
  token: string
  root: bigint
  /** Amount to deposit, in token base units. */
  total: bigint
  /** Conservation proof for the public inputs [root, total, batchId]. */
  proof: Uint8Array
}

export interface WithdrawParams {
  /**
   * Account that submits the transaction and pays its fee: the recipient, or a
   * relayer. The proof binds the payout to `recipient` either way. Defaults to
   * `recipient`.
   */
  source?: string
  batchId: bigint
  /** Withdraw proof for the public inputs [root, nullifier, recipient, amount]. */
  proof: Uint8Array
  nullifier: bigint
  recipient: string
  /** Payout, in token base units. */
  amount: bigint
}

/** A simulated vault call, ready to be signed and sent. */
export type VaultTransaction = AssembledTransaction<Result<void>>

/**
 * Typed access to the ShieldVault contract.
 *
 * Reads (`getBatch`, `isNullifierUsed`) are answered by simulation and cost nothing.
 * Writes (`buildFundBatch`, `buildWithdraw`) check their inputs, simulate the call,
 * and throw a VaultContractError if the vault would reject it, so a transaction
 * that is bound to fail never reaches the wallet for signing.
 */
export class ShieldVaultClient {
  constructor(private readonly connection: VaultConnection) {}

  /** Returns the batch, or undefined if no batch has this id. */
  async getBatch(batchId: bigint): Promise<VaultBatch | undefined> {
    assertBatchId(batchId)
    const tx = await this.client().get_batch({ batch_id: batchId })
    const batch = tx.result
    if (!batch) return undefined
    return {
      root: bytes32ToField(batch.root),
      token: batch.token,
      total: batch.total,
      withdrawn: batch.withdrawn,
    }
  }

  /** True if `nullifier` has already been used to claim from this batch. */
  async isNullifierUsed(batchId: bigint, nullifier: bigint): Promise<boolean> {
    assertBatchId(batchId)
    const tx = await this.client().is_nullifier_used({
      batch_id: batchId,
      nullifier: fieldToBytes32(nullifier),
    })
    return tx.result
  }

  /** Builds and simulates `fund_batch`, signed by `funder`. */
  async buildFundBatch(params: FundBatchParams): Promise<VaultTransaction> {
    assertBatchId(params.batchId)
    if (params.total < 1n) {
      throw new RangeError(`Batch total must be positive: ${params.total}`)
    }
    const tx = await this.client(params.funder).fund_batch({
      funder: params.funder,
      batch_id: params.batchId,
      token: params.token,
      root: fieldToBytes32(params.root),
      total: params.total,
      proof: params.proof,
    })
    return checked(tx)
  }

  /** Builds and simulates `withdraw`, submitted by `source` (default: the recipient). */
  async buildWithdraw(params: WithdrawParams): Promise<VaultTransaction> {
    assertBatchId(params.batchId)
    assertAmount(params.amount)
    const tx = await this.client(params.source ?? params.recipient).withdraw({
      batch_id: params.batchId,
      proof: params.proof,
      nullifier: fieldToBytes32(params.nullifier),
      recipient: params.recipient,
      amount: params.amount,
    })
    return checked(tx)
  }

  /** Bindings client whose transactions use `publicKey` as the source account. */
  private client(publicKey?: string): Client {
    return new Client({ ...this.connection, publicKey })
  }
}

/** Returns `tx`, or throws if its simulation shows the vault would reject it. */
function checked(tx: VaultTransaction): VaultTransaction {
  const result = tx.result
  if (result.isErr()) {
    const simulation = tx.simulation
    const detail =
      simulation && "error" in simulation ? simulation.error : undefined
    throw toVaultError(detail) ?? new Error(result.unwrapErr().message)
  }
  return tx
}
