# web

Disburser and recipient demo UI: React Router (SSR) with shadcn/ui components from
`@workspace/ui`.

```bash
bun run dev   # http://localhost:5173 (the API on :4000 must be running)
bun test      # helpers in app/lib
```

Add shadcn components with the CLI, from this directory: they land in
`packages/ui/src/components` (`components.json` points there), e.g.
`bunx --bun shadcn@4.22.1 add dialog`. The theme in
`packages/ui/src/styles/globals.css` follows the Coinbase Design System's tokens
(colors, Inter, radius, type scale such as `text-display-1` and `text-title-1`,
and `shadow-elevation-1`/`-2`).

## Pages

| Route | |
|---|---|
| `/` | Landing page: what ShieldZK keeps private, what it proves, how it works |
| `/batches` | Batches, newest first, filtered by status |
| `/batches/new` | Create a batch: recipients and amounts (in tokens, up to 7 decimals) typed in or uploaded as a `recipient,amount` CSV |
| `/batches/:batchId` | A batch's status and next step: generate the conservation proof, fund the batch from a wallet, then follow its claims |

Funding builds `fund_batch` with Person 3's `ShieldVaultClient` (`@workspace/sdk/chain`)
for the vault the API names at `GET /v1/config`, and sends it with stellar-sdk's
`signAndSend`. The wallet is a Freighter-only stand-in (`app/lib/wallet.ts`) until
Person 3's shared wallet component lands.

## Settings

Optional, in `.env` (see `.env.example`):

| Variable | |
|---|---|
| `VITE_API_URL` | The API, default `http://localhost:4000` |
| `VITE_TOKEN_CONTRACT_ID` | Token contract to prefill on the funding form |
