import { Badge } from "@workspace/ui/components/badge"

import type { BatchStatus } from "@/lib/api"

const LABELS: Record<
  BatchStatus,
  {
    label: string
    variant: "default" | "secondary" | "outline" | "destructive"
  }
> = {
  created: { label: "Created", variant: "outline" },
  proving: { label: "Proving", variant: "secondary" },
  proved: { label: "Ready to fund", variant: "secondary" },
  failed: { label: "Proof failed", variant: "destructive" },
  funded: { label: "Funded", variant: "default" },
}

/** A batch's status, in the words the disburser sees. */
export function StatusBadge({ status }: { status: BatchStatus }) {
  const { label, variant } = LABELS[status]
  return <Badge variant={variant}>{label}</Badge>
}
