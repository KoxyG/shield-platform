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
import { MAX_ALLOCATIONS, MAX_AMOUNT } from "@workspace/sdk"
import { useState } from "react"
import { Link, redirect, useFetcher } from "react-router"

import { formatAmount, parseAmount } from "@/lib/amount"
import { ApiError, api } from "@/lib/api"
import { parseRecipientsCsv, type RecipientRow } from "@/lib/csv"

import type { Route } from "./+types/batch-new"

export function meta() {
  return [{ title: "New batch · ShieldZK" }]
}

export async function clientAction({ request }: Route.ClientActionArgs) {
  try {
    const batch = await api.createBatch(await request.json())
    return redirect(`/batches/${batch.batchId}`)
  } catch (err) {
    if (err instanceof ApiError) return { error: err.message }
    throw err
  }
}

const EMPTY: RecipientRow = { recipient: "", amount: "" }

/** Problems with the filled-in rows, as the API would see them. */
function check(rows: RecipientRow[]): string[] {
  const problems: string[] = []
  const seen = new Set<string>()
  rows.forEach(({ recipient, amount }, i) => {
    const r = recipient.trim()
    const value = parseAmount(amount)
    if (r === "" || r.length > 256) {
      problems.push(`Row ${i + 1}: the recipient must be 1 to 256 characters`)
    } else if (seen.has(r)) {
      problems.push(`Row ${i + 1}: ${r} is already listed`)
    }
    seen.add(r)
    if (value === undefined || value > MAX_AMOUNT) {
      problems.push(
        `Row ${i + 1}: the amount must be a positive number of tokens, with at most 7 decimals`
      )
    }
  })
  if (rows.length > MAX_ALLOCATIONS) {
    problems.push(`A batch holds at most ${MAX_ALLOCATIONS} recipients`)
  }
  return problems
}

export default function NewBatch() {
  const fetcher = useFetcher<typeof clientAction>()
  const [name, setName] = useState("")
  const [rows, setRows] = useState<RecipientRow[]>([EMPTY])
  const [csvErrors, setCsvErrors] = useState<string[]>([])

  const filled = rows.filter((r) => r.recipient.trim() || r.amount.trim())
  const problems = check(filled)
  const total = filled.reduce(
    (sum, r) => sum + (parseAmount(r.amount) ?? 0n),
    0n
  )
  const submitting = fetcher.state !== "idle"

  function update(i: number, change: Partial<RecipientRow>) {
    setRows(rows.map((row, j) => (j === i ? { ...row, ...change } : row)))
  }

  async function upload(file: File) {
    const { rows: parsed, errors } = parseRecipientsCsv(await file.text())
    setCsvErrors(errors)
    // A file with errors replaces nothing, so no recipient is silently dropped
    if (errors.length === 0 && parsed.length > 0) setRows(parsed)
  }

  function submit() {
    fetcher.submit(
      {
        ...(name.trim() && { name: name.trim() }),
        allocations: filled.map((r) => ({
          recipient: r.recipient.trim(),
          amount: parseAmount(r.amount)!.toString(),
        })),
      },
      { method: "post", encType: "application/json" }
    )
  }

  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-6 p-6">
      <div>
        <Link
          to="/batches"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Batches
        </Link>
        <h1 className="mt-2 text-xl font-semibold">New confidential batch</h1>
        <p className="text-sm text-muted-foreground">
          Each recipient gets a secret and a private commitment to their amount.
          Only the total becomes public.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Batch</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          <Label htmlFor="name">Name (optional)</Label>
          <Input
            id="name"
            value={name}
            maxLength={100}
            placeholder="October stipends"
            onChange={(e) => setName(e.target.value)}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recipients</CardTitle>
          <CardDescription>
            Amounts are in tokens, up to 7 decimals. Or upload a CSV of{" "}
            <code>recipient,amount</code> lines.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Input
            type="file"
            accept=".csv,text/csv"
            aria-label="Upload a recipients CSV"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) void upload(file)
              e.target.value = ""
            }}
          />
          {csvErrors.length > 0 && (
            <Alert variant="destructive">
              <AlertTitle>The CSV wasn't loaded</AlertTitle>
              <AlertDescription>
                <ul className="list-disc pl-4">
                  {csvErrors.slice(0, 10).map((e) => (
                    <li key={e}>{e}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}

          <div className="flex flex-col gap-2">
            {rows.map((row, i) => (
              <div key={i} className="flex gap-2">
                <Input
                  aria-label={`Recipient ${i + 1}`}
                  placeholder="Recipient (e.g. SDP receiver id)"
                  value={row.recipient}
                  onChange={(e) => update(i, { recipient: e.target.value })}
                />
                <Input
                  aria-label={`Amount ${i + 1}`}
                  placeholder="Amount"
                  inputMode="decimal"
                  className="w-40"
                  value={row.amount}
                  onChange={(e) => update(i, { amount: e.target.value })}
                />
                <Button
                  variant="ghost"
                  aria-label={`Remove recipient ${i + 1}`}
                  disabled={rows.length === 1}
                  onClick={() => setRows(rows.filter((_, j) => j !== i))}
                >
                  ×
                </Button>
              </div>
            ))}
          </div>
          <Button
            variant="outline"
            className="self-start"
            disabled={rows.length >= MAX_ALLOCATIONS}
            onClick={() => setRows([...rows, EMPTY])}
          >
            Add recipient
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Summary</CardTitle>
          <CardDescription>
            {filled.length} recipient{filled.length === 1 ? "" : "s"}, total{" "}
            <span className="font-medium text-foreground tabular-nums">
              {formatAmount(total)}
            </span>{" "}
            tokens
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {filled.length > 0 && problems.length > 0 && (
            <Alert variant="destructive">
              <AlertDescription>
                <ul className="list-disc pl-4">
                  {problems.slice(0, 10).map((p) => (
                    <li key={p}>{p}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}
          {fetcher.data?.error && (
            <Alert variant="destructive">
              <AlertTitle>The batch wasn't created</AlertTitle>
              <AlertDescription>{fetcher.data.error}</AlertDescription>
            </Alert>
          )}
          <Button
            className="self-start"
            disabled={filled.length === 0 || problems.length > 0 || submitting}
            onClick={submit}
          >
            {submitting ? "Creating…" : "Create batch"}
          </Button>
        </CardContent>
      </Card>
    </main>
  )
}
