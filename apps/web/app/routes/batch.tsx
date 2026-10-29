import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@workspace/ui/components/alert"
import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import { Progress } from "@workspace/ui/components/progress"
import { useEffect, useState } from "react"
import { Link, useFetcher, useRevalidator } from "react-router"

import { RouteError } from "@/components/route-error"
import { StatusBadge } from "@/components/status-badge"
import { formatAmount } from "@/lib/amount"
import { ApiError, api, type Batch, type VaultConnection } from "@/lib/api"
import { fundBatch } from "@/lib/funding"
import { connectWallet } from "@/lib/wallet"

import type { Route } from "./+types/batch"

export function meta() {
  return [{ title: "Batch · ShieldZK" }]
}

export async function clientLoader({ params }: Route.ClientLoaderArgs) {
  const [batch, config] = await Promise.all([
    api.getBatch(params.batchId),
    api.config(),
  ])
  return { batch, vault: config.vault }
}

type Funding = { funder: string; token: string; txHash: string }
type ActionBody = { intent: "prove" } | ({ intent: "funding" } & Funding)

export async function clientAction({
  params,
  request,
}: Route.ClientActionArgs) {
  const body = (await request.json()) as ActionBody
  try {
    if (body.intent === "prove") {
      await api.prove(params.batchId)
    } else {
      const { funder, token, txHash } = body
      await api.reportFunding(params.batchId, { funder, token, txHash })
    }
    return { error: null }
  } catch (err) {
    if (err instanceof ApiError) return { error: err.message }
    throw err
  }
}

export function HydrateFallback() {
  return <p className="p-6 text-sm text-muted-foreground">Loading batch…</p>
}

export default function BatchPage({ loaderData }: Route.ComponentProps) {
  const { batch, vault } = loaderData
  const { revalidate } = useRevalidator()

  // Proving runs in the background on the API: look again every few seconds
  useEffect(() => {
    if (batch.status !== "proving") return
    const timer = setInterval(revalidate, 3000)
    return () => clearInterval(timer)
  }, [batch.status, revalidate])

  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-6 p-6">
      <div>
        <Link
          to="/batches"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Batches
        </Link>
        <div className="mt-2 flex items-center gap-3">
          <h1 className="text-xl font-semibold">
            {batch.name ?? `Batch ${batch.batchId}`}
          </h1>
          <StatusBadge status={batch.status} />
        </div>
      </div>

      <Details batch={batch} />
      {(batch.status === "created" || batch.status === "failed") && (
        <ProveStep batch={batch} />
      )}
      {batch.status === "proving" && (
        <Card>
          <CardHeader>
            <CardTitle>Generating the conservation proof…</CardTitle>
            <CardDescription>
              A full batch takes a few minutes. This page updates by itself.
            </CardDescription>
          </CardHeader>
        </Card>
      )}
      {batch.status === "proved" && <FundStep batch={batch} vault={vault} />}
      {batch.status === "funded" && <FundedStep batch={batch} />}
    </main>
  )
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  return <RouteError error={error} />
}

function Details({ batch }: { batch: Batch }) {
  return (
    <Card>
      <CardContent>
        <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
          <dt className="text-muted-foreground">Batch id</dt>
          <dd className="font-mono">{batch.batchId}</dd>
          <dt className="text-muted-foreground">Recipients</dt>
          <dd>{batch.recipientCount}</dd>
          <dt className="text-muted-foreground">Total</dt>
          <dd className="tabular-nums">
            {formatAmount(BigInt(batch.total))} tokens
          </dd>
          <dt className="text-muted-foreground">Merkle root</dt>
          <dd className="font-mono break-all">{batch.root}</dd>
          <dt className="text-muted-foreground">Created</dt>
          <dd>{new Date(batch.createdAt).toLocaleString()}</dd>
        </dl>
      </CardContent>
    </Card>
  )
}

/** Step 2 of the end-to-end flow: prove the batch, or prove it again after a failure. */
function ProveStep({ batch }: { batch: Batch }) {
  const fetcher = useFetcher<typeof clientAction>()
  return (
    <Card>
      <CardHeader>
        <CardTitle>Conservation proof</CardTitle>
        <CardDescription>
          Proves that the hidden amounts add up to the total, each within range.
          The vault only accepts a batch that comes with this proof.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {batch.status === "failed" && (
          <Alert variant="destructive">
            <AlertTitle>The last attempt failed</AlertTitle>
            <AlertDescription>{batch.error}</AlertDescription>
          </Alert>
        )}
        {fetcher.data?.error && (
          <Alert variant="destructive">
            <AlertDescription>{fetcher.data.error}</AlertDescription>
          </Alert>
        )}
        <Button
          className="self-start"
          disabled={fetcher.state !== "idle"}
          onClick={() =>
            fetcher.submit(
              { intent: "prove" },
              { method: "post", encType: "application/json" }
            )
          }
        >
          {batch.status === "failed" ? "Try again" : "Generate proof"}
        </Button>
      </CardContent>
    </Card>
  )
}

// A funding the wallet sent but the API hasn't confirmed yet, kept across reloads
// so the page offers to confirm it rather than to pay again.
const fundingKey = (batchId: string) => `shieldzk:funding:${batchId}`

function savedFunding(batchId: string): Funding | undefined {
  try {
    const saved = localStorage.getItem(fundingKey(batchId))
    return saved ? JSON.parse(saved) : undefined
  } catch {
    return undefined
  }
}

function saveFunding(batchId: string, funding: Funding | undefined) {
  try {
    if (funding)
      localStorage.setItem(fundingKey(batchId), JSON.stringify(funding))
    else localStorage.removeItem(fundingKey(batchId))
  } catch {
    // Storage unavailable: the confirmation just won't survive a reload
  }
}

/** Step 3 of the end-to-end flow: the disburser's wallet funds the batch. */
function FundStep({
  batch,
  vault,
}: {
  batch: Batch
  vault: VaultConnection | null
}) {
  const fetcher = useFetcher<typeof clientAction>()
  const [token, setToken] = useState<string>(
    import.meta.env.VITE_TOKEN_CONTRACT_ID ?? ""
  )
  const [funder, setFunder] = useState<string>()
  const [sent, setSent] = useState<Funding>()
  const [stage, setStage] = useState<"idle" | "connecting" | "funding">("idle")
  const [error, setError] = useState<string>()
  const total = formatAmount(BigInt(batch.total))

  useEffect(() => setSent(savedFunding(batch.batchId)), [batch.batchId])

  if (!vault) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Funding isn't set up</AlertTitle>
        <AlertDescription>
          The API has no vault configured (STELLAR_RPC_URL,
          STELLAR_NETWORK_PASSPHRASE, VAULT_CONTRACT_ID).
        </AlertDescription>
      </Alert>
    )
  }

  async function connect() {
    setStage("connecting")
    setError(undefined)
    try {
      setFunder(await connectWallet())
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setStage("idle")
    }
  }

  async function fund() {
    if (!funder || !vault) return
    setStage("funding")
    setError(undefined)
    try {
      const txHash = await fundBatch({
        vault,
        batch,
        funder,
        token: token.trim(),
      })
      const funding = { funder, token: token.trim(), txHash }
      saveFunding(batch.batchId, funding)
      setSent(funding)
      confirm(funding)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setStage("idle")
    }
  }

  function confirm(funding: Funding) {
    fetcher.submit(
      { intent: "funding", ...funding },
      { method: "post", encType: "application/json" }
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Fund the batch</CardTitle>
        <CardDescription>
          Your wallet pays {total} tokens into the vault, which checks the
          conservation proof first. Recipients can claim once it's funded.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {sent ? (
          // Paid already: only the confirmation is left, never a second payment
          <>
            <p className="text-sm">
              Sent in transaction{" "}
              <code className="break-all">{sent.txHash}</code>.
            </p>
            {fetcher.data?.error && (
              <Alert variant="destructive">
                <AlertDescription>{fetcher.data.error}</AlertDescription>
              </Alert>
            )}
            <Button
              className="self-start"
              disabled={fetcher.state !== "idle"}
              onClick={() => confirm(sent)}
            >
              {fetcher.state !== "idle" ? "Confirming…" : "Confirm funding"}
            </Button>
          </>
        ) : (
          <>
            <div className="flex flex-col gap-2">
              <Label htmlFor="token">Token contract</Label>
              <Input
                id="token"
                placeholder="C… (the asset's Stellar Asset Contract)"
                value={token}
                onChange={(e) => setToken(e.target.value)}
              />
            </div>
            {funder ? (
              <p className="text-sm">
                Wallet: <code className="break-all">{funder}</code>
              </p>
            ) : (
              <Button
                variant="outline"
                className="self-start"
                disabled={stage !== "idle"}
                onClick={connect}
              >
                {stage === "connecting" ? "Connecting…" : "Connect Freighter"}
              </Button>
            )}
            {error && (
              <Alert variant="destructive">
                <AlertTitle>Not funded</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <Button
              className="self-start"
              disabled={!funder || !token.trim() || stage !== "idle"}
              onClick={fund}
            >
              {stage === "funding"
                ? "Waiting for your wallet…"
                : `Fund ${total} tokens`}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  )
}

/** A funded batch: how much has been claimed, and how it was funded. */
function FundedStep({ batch }: { batch: Batch }) {
  const { revalidate, state } = useRevalidator()
  const total = BigInt(batch.total)
  const withdrawn = batch.claims ? BigInt(batch.claims.withdrawn) : undefined

  useEffect(() => saveFunding(batch.batchId, undefined), [batch.batchId])

  return (
    <Card>
      <CardHeader>
        <CardTitle>Funded</CardTitle>
        <CardDescription>
          The vault holds the batch. Recipients can claim their allocations.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {withdrawn === undefined ? (
          <p className="text-sm text-muted-foreground">
            Claim progress isn't available right now.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            <div className="flex justify-between text-sm">
              <span>Claimed</span>
              <span className="tabular-nums">
                {formatAmount(withdrawn)} of {formatAmount(total)} tokens
              </span>
            </div>
            <Progress
              value={total > 0n ? Number((withdrawn * 100n) / total) : 0}
            />
          </div>
        )}
        <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
          <dt className="text-muted-foreground">Token</dt>
          <dd className="font-mono break-all">{batch.token}</dd>
          <dt className="text-muted-foreground">Funder</dt>
          <dd className="font-mono break-all">{batch.funder}</dd>
          <dt className="text-muted-foreground">Transaction</dt>
          <dd className="font-mono break-all">{batch.fundingTx}</dd>
          <dt className="text-muted-foreground">Funded</dt>
          <dd>{batch.fundedAt && new Date(batch.fundedAt).toLocaleString()}</dd>
        </dl>
        <Button
          variant="outline"
          className="self-start"
          disabled={state !== "idle"}
          onClick={() => void revalidate()}
        >
          Refresh
        </Button>
      </CardContent>
    </Card>
  )
}
