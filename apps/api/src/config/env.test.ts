import { describe, expect, test } from "bun:test"

import { loadConfig } from "./env"

const MONGODB_URI = "mongodb://localhost:27017/shieldzk"
const CLAIM_DATA_KEY = Buffer.alloc(32, 7).toString("base64")
const required = { MONGODB_URI, CLAIM_DATA_KEY }

describe("loadConfig", () => {
  test("applies defaults", () => {
    expect(loadConfig(required)).toEqual({
      NODE_ENV: "development",
      PORT: 4000,
      LOG_LEVEL: "info",
      MONGODB_URI,
      CORS_ORIGINS: ["http://localhost:5173"],
      CLAIM_DATA_KEY: Buffer.alloc(32, 7),
    })
  })

  test("parses PORT and a comma-separated CORS_ORIGINS", () => {
    const config = loadConfig({
      ...required,
      PORT: "8080",
      CORS_ORIGINS: "https://a.example, https://b.example",
    })
    expect(config.PORT).toBe(8080)
    expect(config.CORS_ORIGINS).toEqual([
      "https://a.example",
      "https://b.example",
    ])
  })

  test("accepts multi-host replica set URIs", () => {
    const uri = "mongodb://a:27017,b:27017/shieldzk?replicaSet=rs0"
    expect(loadConfig({ ...required, MONGODB_URI: uri }).MONGODB_URI).toBe(uri)
  })

  test("rejects a missing or non-MongoDB URI", () => {
    expect(() => loadConfig({ CLAIM_DATA_KEY })).toThrow(/MONGODB_URI/)
    expect(() =>
      loadConfig({ ...required, MONGODB_URI: "postgres://x" })
    ).toThrow(/MONGODB_URI/)
  })

  test("rejects a missing claim data key, or one that isn't 32 bytes of base64", () => {
    const short = Buffer.alloc(16, 7).toString("base64")
    for (const key of [undefined, short, "x".repeat(43) + "!", ""]) {
      expect(() => loadConfig({ MONGODB_URI, CLAIM_DATA_KEY: key })).toThrow(
        /CLAIM_DATA_KEY/
      )
    }
  })

  test("never echoes the claim data key in its errors", () => {
    const leaked = "c2VjcmV0LWtleS10aGF0LWlzLXRvby1zaG9ydA=="
    let message = ""
    try {
      loadConfig({ MONGODB_URI, CLAIM_DATA_KEY: leaked })
    } catch (err) {
      message = (err as Error).message
    }
    expect(message).toContain("CLAIM_DATA_KEY")
    expect(message).not.toContain(leaked)
  })

  test("rejects invalid values", () => {
    expect(() => loadConfig({ ...required, PORT: "0" })).toThrow(/PORT/)
    expect(() => loadConfig({ ...required, CORS_ORIGINS: "nope" })).toThrow(
      /CORS_ORIGINS/
    )
  })
})
