# 0002 — Balance conservation (D5)

- **Status:** Proposed
- **Date:** 2026-10-22
- **Proposed by:** Person 1 ([@IbrahimIjai](https://github.com/IbrahimIjai))
- **Resolves:** architecture D5

## Context

Publishing commitments doesn't prove that they add up to the deposit. FR4 asks for a
proof that the committed amounts sum to the funded total, with a range constraint on
each amount. FR7 asks that a batch never pays out more than it was funded with.

D5 lists two approaches:

1. One batch proof over the root and the sum, checked when the batch is funded.
2. Per-claim accounting enforced by the contract.

Approach 2 on its own doesn't stop over-allocation. The vault already refuses any
withdrawal that would take `withdrawn` above `total`, which gives FR7. But a
disburser could still commit allocations worth 150 against a deposit of 100. Claims
would then succeed first come, first served until the batch runs dry, and the last
recipients would get `InsufficientBatchFunds`. Nobody, recipients included, could
tell beforehand that the batch was underfunded.

## Decision

Use approach 1. The disburser proves conservation for the whole batch when funding
it, and the vault only stores a root that comes with a valid proof.

**Commitment** (as already proposed in the spec):
`commitment = Poseidon(amount, secret, batch_id)`, circomlib Poseidon over BN254.

- `amount`: token base units, must fit in 64 bits.
- `batch_id`: the vault's `u64` batch id.
- `secret`: a fresh random field element per allocation (see Consequences).

**Conservation circuit:** `Conservation(10)` in
`shield-contracts/circuits/conservation.circom`.

- Public inputs, in order: `[root, total, batch_id]`.
- Private inputs for each of the 1024 slots: `amount[i]`, `secret[i]`, `active[i]`.
- Each slot: `active[i]` is 0 or 1, `amount[i]` fits in 64 bits, an empty slot has
  `amount[i] = 0`, and `leaf[i] = active[i] · Poseidon(amount[i], secret[i], batch_id)`.
- The circuit rebuilds the tree from all 1024 leaves, requires its root to equal
  `root`, and requires `Σ amount[i] = total`. At most 1024 amounts below 2^64 sum to
  less than 2^74, far below the field modulus, so the sum can't wrap around.

So every leaf under the root is either 0 or a commitment to a 64-bit amount that is
counted in `total`. No allocation can be left out of the sum, inflated by modular
wrap-around, or committed for a different batch.

**Vault:** `fund_batch(funder, batch_id, token, root, total, proof)`.

1. `funder.require_auth()`.
2. Reject `total ≤ 0`, a root that isn't a canonical field element, and a `batch_id`
   that is already registered.
3. Verify the conservation proof against `[root, total, batch_id]`.
4. Store `{root, token, total, withdrawn: 0}`.
5. Transfer `total` from the funder to the vault, and emit `BatchFunded`.

The vault is deployed with two verifier contracts, one per circuit: `verifier` for
withdraw and `conservation_verifier` for conservation. Each holds exactly one
verifying key, so the `verify(proof, public_inputs)` interface doesn't change. The
proof is 256 bytes, `A ‖ B ‖ C` in Soroban's BN254 encoding (each G2 coordinate as
`c1 ‖ c0`); `circuits/lib/soroban.js` converts snarkjs output to it.

**Claims must open the same commitment.** The withdraw circuit computes its leaf with
the shared `AllocationCommitment` template (`circuits/commitment.circom`), as
`claim.circom` now does. `batch_id` can stay a private input there, as the spec has it:
the vault looks up the batch's root by `batch_id`, and the conservation proof makes
every leaf under that root commit to that same `batch_id`. So a claim can only open an
allocation of the batch it's paid from.

## Rationale

- Every allocation is backed before the vault accepts the batch. With one nullifier
  per leaf and the vault's `withdrawn ≤ total` check, a batch can never pay out more
  than its deposit, and no recipient is left unpaid by over-allocation (FR4, FR7).
- The contract never hashes. The root arrives with a proof, so we don't need
  Soroban's Poseidon host function. soroban-sdk 25 only exposes a raw
  `poseidon_permutation` that takes the MDS matrix and round constants from the
  caller, so matching circomlib on-chain would be extra work and extra risk.
- One proof per batch, verified once, at a cost that doesn't depend on batch size.
- The proof doesn't reveal how many recipients a batch has: it always covers all
  1024 slots. Recipients can still roughly tell from their own Merkle path, because
  slots are filled in order and empty subtrees hash to known values.

## Consequences

- **Proving cost is fixed.** The depth-10 circuit has 581,392 constraints whatever the
  batch size, and compiling it alone used about 3 GB of RAM. Proving runs where the
  batch is built (the API), not in a browser.
- **Trusted setup (D3)** needs a Powers of Tau file of at least 2^20, e.g. the Hermez
  `powersOfTau28_hez_final_20.ptau`.
- **The batch id comes first.** Every commitment includes `batch_id`, so the id has to
  be fixed before the tree is built. The disburser picks it and the vault rejects
  reuse. Anyone who sees the disburser's `fund_batch` can take the id first, and
  cheaply: the proof binds `[root, total, batch_id]` but not the funder or the token,
  so they can replay it with a token they minted themselves. The id then holds the
  disburser's root but pays out worthless tokens, and the disburser has to rebuild the
  batch under a new id. No deposited funds are at risk, but the API must confirm a
  batch by its funder and token, not by its id alone, before sending claim data.
  ADR 0003 closes this by scoping ids per funder.
- **Assumes D1 option (b).** Each leaf is one allocation of any 64-bit amount, paid out
  publicly at withdrawal. Fixed denominations (option a) would change the amount
  constraint, so D1 should be settled together with this.
- **Secrets carry the privacy.** A recipient's Merkle path contains a neighbour's
  commitment, so a guessable secret would let them brute-force the neighbour's amount.
  Secrets must come from a CSPRNG (at least 128 bits), one per allocation
  (`generateSecret()` in `circuits/lib/conservation.js`), and never repeat: a recipient
  who shares a secret with their neighbour could claim the neighbour's allocation too.
  `buildConservationInput` refuses repeated secrets. Relevant to D2.
- **Unclaimed funds stay in the vault.** There's no refund or expiry path. Open question.

## Alternatives considered

- **Per-claim accounting only:** the simplest contract, but it can't prevent
  over-allocation (see Context).
- **Building the tree on-chain:** the vault inserts each commitment and computes the
  root. Needs on-chain Poseidon that matches circomlib, costs many transactions or one
  very large one per batch, and still needs a proof that the hidden amounts add up.
- **Homomorphic (Pedersen) commitments:** the sum of the commitments is a commitment
  to the total. Doesn't fit the Poseidon / BN254 Groth16 stack chosen in ADR 0001, and
  each amount would still need a range proof.

## Spec changes if accepted (architecture.md)

| Item | Change |
|---|---|
| Hash | The vault doesn't compute Poseidon under this design, so the Soroban host-function check only matters if a later design hashes on-chain |
| Commitment | Drop "`claim.circom` still has to adopt it" (it has). `batch_id` is the vault's `u64`; secrets are fresh CSPRNG values of at least 128 bits, never repeated |
| Withdraw public inputs | No change; `batch_id` stays a private input of the withdraw circuit (see Decision) |
| Conservation public inputs | `[root, total, batch_id]` (replaces "TBD") |
| Circuits → conservation circuit | Point to this ADR instead of "design open" |
| Contracts → vault | Add `fund_batch(funder, batch_id, token, root, total, proof)`; deployed with two verifiers |
| Contracts → verifier | One verifier instance per circuit; proofs are 256 bytes, `A ‖ B ‖ C` in Soroban's BN254 encoding |
| Test vectors | List `commitment.json`, `batch.json` (roots, totals, empty-tree roots, claim paths and nullifiers), `nullifier.json`, and `conservation-proof.json` (a real proof and verifying key in the contracts' encoding) |
| D5 | Resolved by ADR 0002 |
