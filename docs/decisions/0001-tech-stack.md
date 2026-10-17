# 0001 — Tech stack

- **Status:** Accepted
- **Date:** 2026-10-17

## Context

ShieldZK needs zero-knowledge proofs that recipients can generate off-chain and a
Soroban contract can verify on-chain cheaply, within a prototype timeline.

## Decision

| Layer | Choice |
|---|---|
| Circuits | Circom |
| Proof system | Groth16 over BN254 |
| Proof generation | snarkjs, off-chain (recipient wallet / browser / API) |
| Hash | Poseidon (circomlib parameters) |
| On-chain | Soroban contracts (Rust), using Stellar's native BN254 and Poseidon host functions for verification |
| Frontend | Demo UI for deposit, proof generation and withdrawal |
| Integration target | Stellar Disbursement Platform (SDP) |
| Network | Stellar testnet |

## Rationale

- Groth16 proofs are small and verify in constant time. BN254 pairings are
  available natively on Soroban, which keeps verification cost reasonable.
- Poseidon is SNARK-friendly and natively available on Soroban, so the same hash
  can be computed in-circuit and on-chain.
- Circom and snarkjs are mature, well documented, and run proofs in the browser,
  which suits recipient-side proving.

## Consequences

- Groth16 needs a trusted setup for each circuit. For the prototype we use an
  existing Powers of Tau file (see architecture D3). Not production-grade.
- Changing a circuit means regenerating its proving and verifying keys and
  redeploying the verifier keys.
- Circomlib's and Soroban's Poseidon parameters must match exactly. This is
  checked with shared test vectors.
