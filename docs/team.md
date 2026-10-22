# ShieldZK — Team & Ownership

Each person owns one security property end to end: the Circom constraints, the
Groth16 proving, the matching Soroban logic, and the adversarial tests for it.
All three take part in threat modelling and final verification.

> Phase 1 (below) covers ZK circuits and Soroban contracts. Phase 2 (SDP
> integration, backend and minimal frontend) is further down.

## Phase 1 — ZK circuits & contracts

| Member | Property owned | Guarantees |
|---|---|---|
| Person 1 — [@IbrahimIjai](https://github.com/IbrahimIjai) | Private allocation & balance conservation | An organisation can't create invalid allocations or allocate more than it deposited |
| Person 2 — [@0xVidavida](https://github.com/0xVidavida) | Private ownership & Merkle membership | Only legitimate recipients can claim, without revealing which allocation is theirs |
| Person 3 — [@koxyG](https://github.com/koxyG) | Nullifiers, double-spend prevention & private withdrawals | Each allocation is claimed at most once, and a valid proof authorises the correct withdrawal |

## Person 1 — Private Allocation & Balance Conservation (@IbrahimIjai)

**Tasks**
- Design the allocation commitment scheme using Poseidon.
- Implement the balance-conservation circuit in Circom (design: architecture D5).
- Prove that the sum of all committed allocations equals the deposited total.
- Implement Groth16 proof generation for allocation validity.
- Implement the Soroban functions for batch registration and verification.
- Test invalid allocations, incorrect totals and manipulated commitments.

**Deliverable:** a disburser can register a confidential batch and prove that all
hidden allocations add up to the deposited amount.

## Person 2 — Private Ownership & Merkle Membership (@0xVidavida)

**Tasks**
- Implement the Merkle membership circuit.
- Prove knowledge of an allocation commitment's secret opening.
- Implement recipient authorisation inside the proof.
- Generate and verify Groth16 membership proofs.
- Implement the Soroban claim-validation logic.
- Test forged witnesses, invalid Merkle paths and unauthorised claims.

**Deliverable:** a recipient can prove entitlement to an allocation without
revealing which commitment they own.

## Person 3 — Nullifiers, Double-Spend Prevention & Private Withdrawals (@koxyG)

**Tasks**
- Design and implement nullifier derivation in Circom.
- Prove that the nullifier corresponds to the committed secret.
- Bind the nullifier proof to the membership proof so attackers can't substitute
  arbitrary nullifiers.
- Implement Soroban nullifier tracking and replay protection.
- Implement the withdrawal authorisation and fund-release logic.
- Test duplicate claims, replay attacks and attempts to withdraw without valid
  authorisation.

**Deliverable:** recipients can claim valid allocations once, and the contract
rejects double claims and forged withdrawals.

## Critical binding: Person 2 ↔ Person 3

Person 2 and Person 3 must combine their constraints into the **same withdrawal
proof**, or otherwise cryptographically bind separate proofs. Person 3's nullifier
must refer to the exact allocation Person 2 proves membership for. Otherwise an
attacker could pair a valid membership proof with a fresh nullifier and claim
repeatedly.

Agree on the interface early: which commitment/secret signals the nullifier
template consumes from the membership template, and who owns the top-level
`withdraw.circom`.

## Shared surfaces

- **Shared protocol spec:** everyone signs off on
  [architecture.md](architecture.md#shared-protocol-specification) before
  implementation starts.
- **Vault contract:** all three write functions in the same contract
  (registration, claim validation, nullifiers / fund release). Agree on the
  storage layout and function signatures up front.
- **Test vectors:** one shared set, used by every circuit and contract test.

## Next steps

| # | Action | Owner | Needed before |
|---|---|---|---|
| 1 | Agree on the withdraw-circuit interface: which commitment/secret signals the nullifier template takes from the membership template, and who owns the top-level `withdraw.circom` | @0xVidavida, @koxyG | Writing the withdraw circuit |
| 2 | Decide architecture **D1** (withdrawal amount leakage: fixed denominations vs. public payout amount vs. confidential balance layer) | Whole team | Phase 1 circuit and fund-release work goes far |
| 3 | Sign off on the shared protocol spec in [architecture.md](architecture.md#shared-protocol-specification) | Whole team | Any implementation |
| 4 | ~~Split backend, SDP integration and UI ownership~~ ✅ Done (Phase 2 below) | Whole team | — |
| 5 | Write decision 0002 (Node/TS + MongoDB, Next.js, stellar-sdk) | Whole team | Phase 2 code |
| 6 | Decide D6, the SDP integration boundary (spike first) | @IbrahimIjai | Batch creation work |
| 7 | Scaffold `apps/web` (Next.js app, layout/navigation, shared UI components) and `apps/api` (Node/TS + MongoDB skeleton) before feature work | Whole team (pick one owner) | Phase 2 frontend/backend work |

## Phase 2 — SDP integration, backend & minimal frontend

Stack: Node + TypeScript API with MongoDB (`apps/api`), Next.js (`apps/web`),
`@stellar/stellar-sdk` with generated contract bindings (see decision 0002).

| Member | Area | Deliverable |
|---|---|---|
| Person 1 — [@IbrahimIjai](https://github.com/IbrahimIjai) | Disbursement creation & management | An organisation can create, fund and monitor a confidential disbursement from a simple interface |
| Person 2 — [@0xVidavida](https://github.com/0xVidavida) | Recipient claims & proof generation | A recipient can access their allocation, generate a valid ZK proof and submit a claim |
| Person 3 — [@koxyG](https://github.com/koxyG) | Blockchain transactions & monitoring | Funding and claiming transactions execute correctly and users can see their status |

### Person 1 — Disbursement Creation & Management (@IbrahimIjai)

**Backend**
- Set up and integrate an SDP instance (boundary: architecture D6).
- Confidential disbursement batch creation.
- Process recipient allocations and generate commitments.
- Construct Merkle trees and store batch metadata.
- Integrate batch funding with the Soroban contract (via Person 3's contract client).
- Track disbursement status.

**Minimal frontend**
- Confidential disbursement creation form.
- Recipient and amount entry (or CSV upload).
- Batch summary: total amount and number of recipients.
- Fund/submit disbursement button.
- Basic batch status display.

### Person 2 — Recipient Claims & Proof Generation (@0xVidavida)

**Backend**
- Integrate SDP's existing recipient onboarding flow.
- Secure delivery of claim credentials.
- Retrieve allocation data and construct Merkle witnesses.
- Integrate Groth16 proof generation.
- Check claim eligibility and status.
- Claim preparation API.

**Minimal frontend**
- Recipient claim page.
- Connect wallet or use an existing supported wallet flow (via Person 3's wallet component).
- View private allocation amount.
- Generate proof button, with progress/error feedback.
- Claim funds button.
- Claim status display.

### Person 3 — Blockchain Transactions & Monitoring (@koxyG)

**Backend**
- Soroban contract client and transaction builders.
- Wallet signing and transaction submission.
- Contract calls for batch registration and claims.
- Monitor transaction confirmation.
- Index contract events and sync database records.
- Handle retries, duplicate submissions and failures.
- Transaction status APIs.

**Minimal frontend**
- Transaction confirmation/review component.
- Wallet signing interface integration.
- Transaction progress and status indicators.
- Transaction details with Stellar Explorer links.
- Simple activity/history page showing batches and claims.

### Boundaries between Phase 2 roles

| Overlap | Boundary |
|---|---|
| Batch funding (P1) vs contract calls (P3) | P3 owns the contract client, transaction building, submission and monitoring; P1 calls `registerBatch()` / `fundBatch()` |
| Proof generation (P2) vs claim submission (P3) | P2 produces `{proof, publicInputs}`; P3 submits via `withdraw` and tracks it |
| Wallet connect (P2) vs wallet signing (P3) | P3 builds one shared wallet component; P1 and P2 reuse it |
| `packages/sdk` | Shared; P3 owns the `chain/` module (client, transactions, events) |

### Privacy note for Phase 2

Indexers, status APIs and history pages must not add linkage beyond what's already
on-chain. For example, don't store or display which leaf or allocation a claim
corresponds to.
