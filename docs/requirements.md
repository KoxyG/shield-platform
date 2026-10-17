# ShieldZK — Requirements

Confidential Disbursements for the Stellar Disbursement Platform (SDP).
A drop-in privacy module for SDP that hides individual recipient amounts and the
sender-to-recipient link, while keeping totals publicly provable.

## Problem

SDP is an open-source, production tool used for bulk payments: humanitarian aid,
global payroll, government transfers, supplier payouts. Every disbursement lands on
a public ledger, so individual amounts, recipient addresses and payment patterns
are all visible. For an NGO paying vulnerable aid recipients, or a fintech running
payroll, this is a privacy, safety and competitive problem.

## Goal

A privacy add-on that integrates with an existing SDP deployment, not a standalone
wallet or pool. An operator switches the module on and keeps their existing wallet
providers, SMS invitations, SEP-24 deposit flows, and cash-in / cash-out rails.

With the module on:
1. A disburser deposits the batch total and publishes one commitment per recipient
   allocation (amount + secret) through the SDP flow.
2. Commitments are stored in a Merkle tree on a Soroban contract.
3. A recipient generates a ZK proof that they know the opening of some commitment
   in the tree, without revealing which one.
4. The contract verifies the proof, checks the nullifier against double claims,
   and releases funds.

## Privacy guarantees

| Property | Status |
|---|---|
| Individual allocation amounts | Private |
| Link between disburser and each recipient | Private |
| Sum of allocations equals amount deposited | Public, verifiable |
| Each allocation claimed at most once (nullifiers) | Public, verifiable |

> **Caveat:** see "Withdrawal amount leakage" under Open Decisions in
> `architecture.md`. A plain token transfer at withdrawal shows the amount and
> destination, so the guarantee above has to be scoped to match whatever
> withdrawal design we choose.

## Functional requirements

- **FR1** Operator can create a confidential batch from an SDP disbursement.
- **FR2** Disburser can fund a batch with a single deposit of the total.
- **FR3** The batch's commitments are anchored on-chain as a Merkle root.
- **FR4** Balance conservation: a proof that committed amounts sum to the funded
  total, with range constraints on each amount.
- **FR5** Recipient can claim through an SDP-supported wallet / SEP-24 flow.
- **FR6** Contract rejects invalid proofs, unknown batches/roots, and reused nullifiers.
- **FR7** Total withdrawn from a batch can never exceed the funded total.

## Phase scope

- Hide amounts and linkage.
- Demonstrate end-to-end on Stellar testnet, integrated with a running SDP instance.
- Demo UI: deposit, proof generation, withdrawal.

## Out of scope

- Regulatory reporting, audit, KYC integration. Selective disclosure to a
  regulator is a natural follow-up and should be flagged to any fintech partner.
- Production-grade security; we rely on an existing trusted setup.

## Prior work and our differentiation

- Standalone Stellar shielded pools (e.g. the "zstellar" family): generic
  deposit / private transfer / withdraw, not tied to SDP.
- Nethermind confidential-payments architecture: verifier, nullifiers, Merkle
  roots, ASP policy contracts.
- Tally: donor-facing confidential disbursement with private amounts and a
  donor-provable total.

**Our wedge:** integrating directly with SDP's production one-to-many disbursement
flow, so existing operators can adopt it without leaving their tooling.

## Known limitations

- Integrating with a live production platform is messier than building a clean
  standalone pool. We accept that trade for real-world relevance.
- Not production-grade; relies on an existing trusted setup.
