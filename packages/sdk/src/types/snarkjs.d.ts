declare module "snarkjs" {
  export const groth16: {
    fullProve(
      input: Record<string, any>,
      wasmFile: any,
      zkeyFile: any,
      logger?: any
    ): Promise<{ proof: any; publicSignals: string[] }>
    verify(
      vKey: any,
      publicSignals: string[],
      proof: any,
      logger?: any
    ): Promise<boolean>
    exportSolidityVerifier(zkey: any, templates: any): Promise<string>
  }
}
