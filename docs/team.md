# ShieldZK — Team & Ownership

Each person owns one security property end to end: the Circom constraints, the
Groth16 proving, the matching Soroban logic, and the adversarial tests for it.
All three take part in threat modelling and final verification.

> Scope of this split: ZK circuits and Soroban contracts. Backend, SDP
> integration and UI ownership are still to be split (see "Not yet split").

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
| 4 | Split backend, SDP integration and UI ownership | Whole team | Phase 3 |

## Not yet split

The split above covers the ZK and on-chain work only. The following will be
divided across the team separately:

- SDP integration: adapter, backend APIs, database changes, delivery of claim
  data to recipients, SEP-24 / wallet claim flow.
- Demo UI (deposit, proof generation, withdrawal).
- Testnet deployment and the end-to-end demo.
