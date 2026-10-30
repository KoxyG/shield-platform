// Proves a batch with the conservation circuit, using shield-contracts' own
// circuits/lib/conservation.js: proveConservation, then verifyConservation, as
// circuits/scripts/export-conservation-fixture.js does.
//
// Usage: node scripts/prove-conservation.cjs <conservation.js> <wasm> <zkey> <vkey> < input.json
//   input.json is the circuit's input (the SDK's conservationInput). It holds every
//   secret of the batch, so it comes over stdin, never as an argument.
//   Prints {"proof": ..., "publicSignals": [...]} as snarkjs returns them.
//
// Runs under Node, not Bun: snarkjs's worker threads hang under Bun.
const fs = require("fs")

const [lib, wasm, zkey, vkey] = process.argv.slice(2)
const { proveConservation, verifyConservation } = require(lib)

async function main() {
  const input = JSON.parse(fs.readFileSync(0, "utf8"))
  const verificationKey = JSON.parse(fs.readFileSync(vkey, "utf8"))
  const { proof, publicSignals } = await proveConservation(input, wasm, zkey)
  if (!(await verifyConservation(verificationKey, publicSignals, proof))) {
    throw new Error(
      "snarkjs rejected the proof it just made: is the build out of date?"
    )
  }
  process.stdout.write(JSON.stringify({ proof, publicSignals }))
  // snarkjs leaves worker threads running
  process.exit(0)
}

main().catch((err) => {
  // Only the message: never the input
  process.stderr.write(`${err.message}\n`)
  process.exit(1)
})
