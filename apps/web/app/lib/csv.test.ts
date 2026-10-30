import { describe, expect, test } from "bun:test"

import { parseRecipientsCsv } from "./csv"

describe("parseRecipientsCsv", () => {
  test("reads recipient,amount lines, skipping a header and blank lines", () => {
    const csv =
      "recipient,amount\r\nreceiver-alice,50\n\n receiver-bob , 12.5 \n"
    expect(parseRecipientsCsv(csv)).toEqual({
      rows: [
        { recipient: "receiver-alice", amount: "50" },
        { recipient: "receiver-bob", amount: "12.5" },
      ],
      errors: [],
    })
  })

  test("reads quoted fields", () => {
    expect(parseRecipientsCsv('"receiver-alice","50"').rows).toEqual([
      { recipient: "receiver-alice", amount: "50" },
    ])
  })

  test("reports bad lines by number", () => {
    const csv = [
      "receiver-alice,50",
      "receiver-bob,0",
      "receiver-carol,1.123456789",
      "receiver-dan",
      ",5",
      "receiver-alice,10",
    ].join("\n")
    const { rows, errors } = parseRecipientsCsv(csv)
    expect(rows).toEqual([{ recipient: "receiver-alice", amount: "50" }])
    expect(errors).toEqual([
      "Line 2: the amount must be a positive number of tokens, with at most 7 decimals",
      "Line 3: the amount must be a positive number of tokens, with at most 7 decimals",
      'Line 4: expected "recipient,amount"',
      "Line 5: the recipient must be 1 to 256 characters",
      "Line 6: receiver-alice is already listed",
    ])
  })

  test("reports a bad first row instead of taking it for a header", () => {
    const { rows, errors } = parseRecipientsCsv(
      "receiver-bob,0\nreceiver-alice,5"
    )
    expect(rows).toEqual([{ recipient: "receiver-alice", amount: "5" }])
    expect(errors).toHaveLength(1)
    expect(errors[0]).toStartWith("Line 1:")
  })

  test("refuses more recipients than a batch holds", () => {
    const csv = Array.from({ length: 1025 }, (_, i) => `r${i},1`).join("\n")
    expect(parseRecipientsCsv(csv).errors).toEqual([
      "A batch holds at most 1024 recipients",
    ])
  })
})
