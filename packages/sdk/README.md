# @workspace/sdk

Protocol code shared by the API and the web app: the shared-spec constants, field
helpers, allocation commitments, batch building (Merkle tree, total, each
recipient's claim data and the conservation circuit's input), proof encoding for
the contracts, and the chain client (`chain/`, owned by @koxyG). Next: nullifiers
and claim proofs.

```ts
import { buildBatch, conservationInput, generateSecret } from "@workspace/sdk"

const batch = buildBatch(batchId, [{ amount: 500_000_000n, secret: generateSecret() }])
// batch.root and batch.total go to fund_batch, with a conservation proof of
// conservationInput(batch). batch.claims[i] is recipient i's private claim data.
```

- **Source-only.** There is no build step; Bun and Vite import the TypeScript directly.
- **Runs in Bun and in the browser.** Use Web APIs only (`crypto.getRandomValues`,
  `TextEncoder`), never `node:` or `bun:` modules outside tests.
- **Mirrors the circuits.** Constants and hashing match `shield-contracts/circuits/lib`;
  change both sides together.
- **Shared test vectors.** `test-vectors/` holds copies of
  `shield-contracts/circuits/test-vectors`, and the tests check this package against
  them. When the circuits' vectors change, copy them here again.

```bash
bun test
```
