import { buttonVariants } from "@workspace/ui/components/button"
import { Card, CardContent } from "@workspace/ui/components/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"
import { Link } from "react-router"

import { RouteError } from "@/components/route-error"
import { StatusBadge } from "@/components/status-badge"
import { formatAmount } from "@/lib/amount"
import { api, type BatchStatus } from "@/lib/api"

import type { Route } from "./+types/batches"

const FILTERS: { label: string; status?: BatchStatus }[] = [
  { label: "All" },
  { label: "Created", status: "created" },
  { label: "Proving", status: "proving" },
  { label: "Ready to fund", status: "proved" },
  { label: "Proof failed", status: "failed" },
  { label: "Funded", status: "funded" },
]

export function meta() {
  return [{ title: "Batches · ShieldZK" }]
}

export async function clientLoader({ request }: Route.ClientLoaderArgs) {
  const param = new URL(request.url).searchParams.get("status")
  const status = FILTERS.find((f) => f.status && f.status === param)?.status
  const { batches } = await api.listBatches(status)
  return { batches, status }
}

export function HydrateFallback() {
  return <p className="p-6 text-sm text-muted-foreground">Loading batches…</p>
}

export default function Batches({ loaderData }: Route.ComponentProps) {
  const { batches, status } = loaderData
  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-6 p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">Confidential batches</h1>
          <p className="text-sm text-muted-foreground">
            Each recipient's amount stays private; only a batch's total is
            public.
          </p>
        </div>
        <Link to="/batches/new" className={buttonVariants()}>
          New batch
        </Link>
      </div>

      <nav className="flex flex-wrap gap-1">
        {FILTERS.map((filter) => (
          <Link
            key={filter.label}
            to={filter.status ? `?status=${filter.status}` : "."}
            className={buttonVariants({
              variant: filter.status === status ? "secondary" : "ghost",
              size: "sm",
            })}
          >
            {filter.label}
          </Link>
        ))}
      </nav>

      <Card>
        <CardContent>
          {batches.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No batches here yet.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Recipients</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {batches.map((batch) => (
                  <TableRow key={batch.batchId}>
                    <TableCell>
                      <Link
                        to={`/batches/${batch.batchId}`}
                        className="font-medium hover:underline"
                      >
                        {batch.name ?? `Batch ${batch.batchId}`}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={batch.status} />
                    </TableCell>
                    <TableCell className="text-right">
                      {batch.recipientCount}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatAmount(BigInt(batch.total))}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(batch.createdAt).toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </main>
  )
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  return <RouteError error={error} />
}
