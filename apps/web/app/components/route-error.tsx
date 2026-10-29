import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@workspace/ui/components/alert"

import { ApiError } from "@/lib/api"

/** What a page shows when its data can't be loaded. */
export function RouteError({ error }: { error: unknown }) {
  const message =
    error instanceof ApiError
      ? error.message
      : "Couldn't reach the ShieldZK API. Is it running?"
  return (
    <main className="mx-auto max-w-4xl p-6">
      <Alert variant="destructive">
        <AlertTitle>This page couldn't load</AlertTitle>
        <AlertDescription>{message}</AlertDescription>
      </Alert>
    </main>
  )
}
