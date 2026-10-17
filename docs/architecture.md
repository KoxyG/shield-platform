# ShieldZK — Architecture

## Components

| Component | Repo / path | Owner |
|---|---|---|
| Conservation circuit | `shield-contracts/circuits` | Person 1 (@IbrahimIjai) |
| Withdraw circuit: membership + ownership | `shield-contracts/circuits` | Person 2 (@0xVidavida) |
| Withdraw circuit: nullifier + binding | `shield-contracts/circuits` | Person 3 (@koxyG) |
| Vault: batch registration & conservation check | `shield-contracts/contracts/shield-vault` | Person 1 (@IbrahimIjai) |
| Vault: claim validation | `shield-contracts/contracts/shield-vault` | Person 2 (@0xVidavida) |
| Vault: nullifier tracking & fund release | `shield-contracts/contracts/shield-vault` | Person 3 (@koxyG) |
| Groth16 verifier contract | `shield-contracts/contracts/shield-verifier` | Shared |
| Proof / commitment SDK | `shield-platform/packages/sdk` | Shared |
| Confidential disbursement service + SDP adapter | `shield-platform/apps/api` | To be split |
| Disburser and recipient demo UI | `shield-platform/apps/web` | To be split |

Ownership is detailed in [team.md](team.md).

## End-to-end flow

1. **Create batch:** operator selects an SDP disbursement and enables confidential
   mode. The API generates a secret per recipient, computes commitments, and builds
   the batch Merkle tree.
2. **Prove conservation:** the disburser shows that the committed allocations sum
   to the total `T`. The mechanism is open (see D5).
3. **Fund:** disburser calls `vault.fund_batch(batch_id, root, T, …)`. The vault
   pulls `T` tokens and stores `{root, T, withdrawn = 0}`, plus whatever
   conservation check D5 settles on.
4. **Distribute claim data:** each recipient privately receives
   `{batch_id, amount, secret, leaf_index, merkle_path}` over the existing SDP
   invitation / wallet channel.
5. **Claim:** the recipient's wallet (or the demo UI) generates a withdraw proof
   using the SDK.
6. **Withdraw:** `vault.withdraw(batch_id, proof, nullifier, recipient, amount_public…)`.
   The vault checks the root, checks the nullifier hasn't been used, verifies the
   proof, records the nullifier, and transfers the funds.
7. **Off-ramp:** funds go out through the existing SDP wallet / SEP-24 rails.

## Shared protocol specification

All three components must match these exactly. Changes go through a decision record.

| Item | Definition |
|---|---|
| Field | BN254 scalar field |
| Hash | Poseidon, **circomlib parameters**. The Soroban Poseidon host function must produce identical outputs; verify with shared test vectors before Phase 2. |
| Commitment | `Poseidon(amount, secret, batch_id)` (proposed) |
| Nullifier | `Poseidon(secret, leaf_index)` (proposed). Scope: unique per leaf, global nullifier set per batch. |
| Merkle tree | Binary Poseidon tree, one tree per batch, depth 10 (= 1024 recipients) (proposed). Empty leaves = 0, leaves in insertion order, root is one field element. |
| Amount | Integer in token base units, range-checked to 64 bits in-circuit |
| Recipient binding | Recipient address encoded as a field element and included as a public input, so a proof can't be front-run or redirected |
| Withdraw public inputs | `root, nullifier, batch_id, recipient` plus the payout amount if public (see open decision D1) |
| Conservation public inputs | TBD (depends on D5) |
| Test vectors | `shield-contracts/circuits/test-vectors/*.json`, produced by Person 1 and used by everyone |

## Circuits

- **`withdraw.circom`**: proves knowledge of `(amount, secret)` such that the
  commitment is a leaf under `root` (Merkle membership with a private path), and
  that `nullifier` is derived correctly.
- **Conservation circuit**: design open (see D5).

## Contracts

- **Vault:** `fund_batch`, `withdraw`, `get_batch`, `is_nullifier_used`.
  Invariant: `withdrawn ≤ total` for every batch.
- **Verifier:** Groth16 verification over BN254 using Soroban's native pairing host
  functions. Verifying keys for both circuits are stored at deploy time.
- Phase 1 uses a mock verifier behind the same interface.

## SDP integration

- SDP's normal path queues direct payments via the Core Service and the Transaction
  Submission Service. Confidential claims need a **separate execution path**; a
  database flag alone isn't enough.
- New tables (proposed): `confidential_batches`, `confidential_allocations`
  (encrypted claim data, leaf index), and `nullifiers_seen` (mirror of on-chain state).
- Reuse SDP's wallet registration and SMS invitation flow to deliver claim data.

## Open decisions

- **D1. Withdrawal amount leakage.** A plain Soroban token transfer reveals the
  amount and destination. Options:
  (a) fixed-denomination notes (an allocation is split into standard denominations);
  (b) a public payout amount, which limits privacy to the allocation phase and to
      linkage among claims of the same amount;
  (c) an additional confidential balance layer.
  This affects the circuit, the contract and the API. It must be decided before
  Phase 1 circuit work goes further.
- **D2. Who holds recipient secrets** before claim (generated server-side and
  delivered encrypted, vs. derived on the recipient's device).
- **D3. Trusted setup source:** which existing Powers of Tau file, and whether we run
  a phase-2 ceremony for each circuit.
- **D4. Recipient address → field encoding.**
- **D5. Balance conservation design (open discussion).** Publishing commitments
  doesn't by itself prove their sum equals the deposit. The proof must tie to the
  actual committed leaves and include amount range constraints. Approaches to
  discuss include a single batch proof over the root and sum at funding time, or
  per-claim accounting enforced by the contract. Person 1 to propose; whole team
  to review.
