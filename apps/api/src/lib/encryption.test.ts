import { describe, expect, test } from "bun:test"

import { decrypt, encrypt } from "./encryption"

const key = Buffer.alloc(32, 1)

describe("encrypt / decrypt", () => {
  test("round-trips with the same key and context", () => {
    const sealed = encrypt(key, "secret claim data", "batch/1/0")
    expect(decrypt(key, sealed, "batch/1/0")).toBe("secret claim data")
  })

  test("uses a fresh IV, so equal plaintexts encrypt differently", () => {
    const a = encrypt(key, "same", "ctx")
    const b = encrypt(key, "same", "ctx")
    expect(a.iv).not.toBe(b.iv)
    expect(a.data).not.toBe(b.data)
  })

  test("fails with another context: ciphertext can't be moved to another record", () => {
    const sealed = encrypt(key, "secret", "batch/1/0")
    expect(() => decrypt(key, sealed, "batch/1/1")).toThrow()
  })

  test("fails with another key", () => {
    const sealed = encrypt(key, "secret", "ctx")
    expect(() => decrypt(Buffer.alloc(32, 2), sealed, "ctx")).toThrow()
  })

  test("fails if the ciphertext or tag was changed", () => {
    const sealed = encrypt(key, "secret", "ctx")
    const flip = (base64: string) => {
      const bytes = Buffer.from(base64, "base64")
      bytes[0]! ^= 1
      return bytes.toString("base64")
    }
    expect(() =>
      decrypt(key, { ...sealed, data: flip(sealed.data) }, "ctx")
    ).toThrow()
    expect(() =>
      decrypt(key, { ...sealed, tag: flip(sealed.tag) }, "ctx")
    ).toThrow()
  })
})
