import type { BatchStatus } from "../lib/api"

const STATUSES: Record<BatchStatus, { label: string; className: string }> = {
  created: {
    label: "Created",
    className: "bg-neutral-900 border-neutral-700 text-neutral-300",
  },
  proving: {
    label: "Proving",
    className: "bg-amber-950/40 border-amber-800/60 text-amber-300",
  },
  proved: {
    label: "Ready to fund",
    className: "bg-emerald-950/40 border-emerald-800/60 text-emerald-300",
  },
  failed: {
    label: "Proof failed",
    className: "bg-red-950/40 border-red-800/60 text-red-300",
  },
  funded: {
    label: "Funded",
    className: "bg-emerald-500/10 border-emerald-500/40 text-emerald-400",
  },
}

/** A batch's status, in the words the disburser sees. */
export function BatchStatusPill({ status }: { status: BatchStatus }) {
  const { label, className } = STATUSES[status]
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-[11px] px-2 py-0.5 rounded-full border font-medium ${className}`}
    >
      {status === "proving" && (
        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
      )}
      {label}
    </span>
  )
}

export const STATUS_FILTERS: { label: string; status?: BatchStatus }[] = [
  { label: "All" },
  ...(Object.keys(STATUSES) as BatchStatus[]).map((status) => ({
    label: STATUSES[status].label,
    status,
  })),
]
