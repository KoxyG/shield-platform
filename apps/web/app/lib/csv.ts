import { MAX_ALLOCATIONS } from "@workspace/sdk"

import { parseAmount } from "./amount"

/** One recipient and their amount in tokens, as typed or uploaded. */
export type RecipientRow = { recipient: string; amount: string }

/**
 * Reads a recipients CSV: one `recipient,amount` per line, amounts in tokens
 * (e.g. 12.5). A first line with no digits in its amount column is a header
 * (`recipient,amount`); blank lines are skipped; fields may be quoted. Checks what
 * the API checks, so a file that reads cleanly can be submitted: amounts, empty or
 * repeated recipients, and the 1024-recipient limit.
 */
export function parseRecipientsCsv(text: string): {
  rows: RecipientRow[]
  errors: string[]
} {
  const rows: RecipientRow[] = []
  const errors: string[] = []
  const seen = new Set<string>()
  let first = true

  text.split(/\r?\n/).forEach((line, i) => {
    if (line.trim() === "") return
    const fields = line
      .split(",")
      .map((f) => f.trim().replace(/^"(.*)"$/, "$1"))
    const [recipient = "", amount = ""] = fields
    if (first) {
      first = false
      if (!/\d/.test(amount)) return // header
    }
    const valid = fields.length === 2 && parseAmount(amount) !== undefined

    if (fields.length !== 2) {
      errors.push(`Line ${i + 1}: expected "recipient,amount"`)
    } else if (recipient === "" || recipient.length > 256) {
      errors.push(`Line ${i + 1}: the recipient must be 1 to 256 characters`)
    } else if (!valid) {
      errors.push(
        `Line ${i + 1}: the amount must be a positive number of tokens, with at most 7 decimals`
      )
    } else if (seen.has(recipient)) {
      errors.push(`Line ${i + 1}: ${recipient} is already listed`)
    } else {
      seen.add(recipient)
      rows.push({ recipient, amount })
    }
  })

  if (rows.length > MAX_ALLOCATIONS) {
    errors.push(`A batch holds at most ${MAX_ALLOCATIONS} recipients`)
  }
  return { rows, errors }
}
