import { describe, expect, it } from "bun:test"
import { addressToField, addressToFieldSync } from "./recipient"
import { FIELD_SIZE } from "./protocol"

describe("addressToField (architecture D4)", () => {
  it("matches the test vector for an account address (G...)", async () => {
    const address = "GCFIRY65OQE7DFP5KLNS2PF2LVZMUZYJX4OZIEQ36N2IQANUB5XVYOJR"
    const expected = 1805979399592580219905695061913226224433366000405387232522456497279177458284n
    
    const field = await addressToField(address)
    expect(field).toBe(expected)
    expect(addressToFieldSync(address)).toBe(expected)
  })

  it("matches the test vector for a contract address (C...)", async () => {
    const address = "CABAEAQCAIBAEAQCAIBAEAQCAIBAEAQCAIBAEAQCAIBAEAQCAIBAFNSZ"
    const expected = 12806848346982805931837711312015900411635685331064092607526498727414419784390n
    
    const field = await addressToField(address)
    expect(field).toBe(expected)
    expect(addressToFieldSync(address)).toBe(expected)
  })

  it("always produces canonical field elements (< FIELD_SIZE)", async () => {
    const address = "GCFIRY65OQE7DFP5KLNS2PF2LVZMUZYJX4OZIEQ36N2IQANUB5XVYOJR"
    const field = await addressToField(address)
    expect(field >= 0n).toBe(true)
    expect(field < FIELD_SIZE).toBe(true)
  })
})
