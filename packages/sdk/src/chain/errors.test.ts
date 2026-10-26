import { describe, expect, test } from "bun:test"

import {
  VAULT_ERROR_MESSAGES,
  VaultContractError,
  toVaultError,
} from "./errors"
import { VaultError } from "./vault-bindings"

// Recorded from a local network: the simulation error for withdraw() on an unknown batch.
const SIMULATION_ERROR =
  "HostError: Error(Contract, #1)\n\nEvent log (newest first):\n" +
  "   0: [Diagnostic Event] contract:CBBA6C4YMS4RDTRS3TO4YNMTWVPEIGJZ53DLDKNUFFN7RRIS4P76SIDT, " +
  'topics:[error, Error(Contract, #1)], data:"escalating Ok(ScErrorType::Contract) frame-exit to Err"\n' +
  "   1: [Diagnostic Event] topics:[fn_call, CBBA6C4YMS4RDTRS3TO4YNMTWVPEIGJZ53DLDKNUFFN7RRIS4P76SIDT, withdraw], " +
  "data:[999, Bytes(00000000), Bytes(0000000000000000000000000000000000000000000000000000000000000000), " +
  "GCJ3PIN3NIKEMD3JFHLEOLNFDRGMSZME3QZ64AIDIBK3SGGGMC5QTQOQ, 1]\n"

describe("VAULT_ERROR_MESSAGES", () => {
  test("has a message for every contract error, and no others", () => {
    const contractErrors = Object.values(VaultError).map((e) => e.message)
    expect(Object.keys(VAULT_ERROR_MESSAGES).sort()).toEqual(
      contractErrors.sort()
    )
  })
})

describe("toVaultError", () => {
  test("reads the code from a real simulation error", () => {
    const error = toVaultError(SIMULATION_ERROR)
    expect(error?.code).toBe("BatchNotFound")
    expect(error?.message).toBe("This batch doesn't exist on the vault.")
  })

  test("reads the code from a thrown submission error", () => {
    const thrown = new Error(
      "Transaction failed: HostError: Error(Contract, #2)"
    )
    expect(toVaultError(thrown)?.code).toBe("NullifierUsed")
  })

  test("maps every contract error code to its name", () => {
    for (const [code, { message: name }] of Object.entries(VaultError)) {
      expect(toVaultError(`Error(Contract, #${code})`)?.code).toBe(
        name as keyof typeof VAULT_ERROR_MESSAGES
      )
    }
  })

  test("ignores errors that aren't from the vault", () => {
    expect(toVaultError("Error(Contract, #42)")).toBeUndefined()
    expect(
      toVaultError("HostError: Error(Context, InternalError)")
    ).toBeUndefined()
    expect(toVaultError(new Error("fetch failed"))).toBeUndefined()
    expect(toVaultError(undefined)).toBeUndefined()
  })

  test("passes a VaultContractError through", () => {
    const error = new VaultContractError("BatchExists")
    expect(toVaultError(error)).toBe(error)
  })
})

describe("VaultContractError", () => {
  test("is an Error carrying the vault's error name", () => {
    const error = new VaultContractError("NullifierUsed")
    expect(error).toBeInstanceOf(Error)
    expect(error.name).toBe("VaultContractError")
    expect(error.code).toBe("NullifierUsed")
    expect(error.message).toBe("This allocation has already been claimed.")
  })
})
