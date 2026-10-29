import { spawn } from "node:child_process"
import path from "node:path"
import { fileURLToPath } from "node:url"

import type { ConservationInput, SnarkjsProof } from "@workspace/sdk"

/** A conservation proof and its public signals, as snarkjs returns them. */
export type ConservationProof = {
  proof: SnarkjsProof
  publicSignals: string[]
}

/** Proves a batch with the conservation circuit. */
export type ConservationProver = (
  input: ConservationInput
) => Promise<ConservationProof>

/** The production circuit, shield-contracts' conservation_main.circom (depth 10). */
export const CONSERVATION_CIRCUIT = "conservation_main"

/**
 * The files a proof needs from shield-contracts' circuits directory: the prover in
 * lib/, and the keys scripts/groth16-setup.sh writes to build/ under its naming.
 */
export function conservationArtifacts(circuitsDir: string, circuit: string) {
  const build = path.resolve(circuitsDir, "build")
  return {
    lib: path.resolve(circuitsDir, "lib/conservation.js"),
    wasm: path.join(build, `${circuit}_js/${circuit}.wasm`),
    zkey: path.join(build, `${circuit}_final.zkey`),
    vkey: path.join(build, `${circuit}_vkey.json`),
  }
}

const SCRIPT = fileURLToPath(
  new URL("../../scripts/prove-conservation.cjs", import.meta.url)
)

/**
 * Proves with shield-contracts' own circuits/lib/conservation.js, in a Node child
 * process (scripts/prove-conservation.cjs). snarkjs hangs under Bun, and a depth-10
 * proof needs gigabytes of memory that the API process shouldn't hold. The input,
 * which holds every secret of the batch, goes over stdin.
 */
export function nodeConservationProver(
  circuitsDir: string,
  circuit: string = CONSERVATION_CIRCUIT
): ConservationProver {
  const { lib, wasm, zkey, vkey } = conservationArtifacts(circuitsDir, circuit)
  return (input) =>
    new Promise((resolve, reject) => {
      const child = spawn("node", [SCRIPT, lib, wasm, zkey, vkey])
      let stdout = ""
      let stderr = ""
      child.stdout.setEncoding("utf8").on("data", (chunk) => (stdout += chunk))
      child.stderr.setEncoding("utf8").on("data", (chunk) => (stderr += chunk))
      child.on("error", reject)
      child.on("close", (code) => {
        if (code !== 0) {
          reject(new Error(stderr.trim() || `Prover exited with code ${code}`))
          return
        }
        try {
          resolve(JSON.parse(stdout))
        } catch {
          reject(new Error("Prover printed something other than a proof"))
        }
      })
      child.stdin.end(JSON.stringify(input))
    })
}
