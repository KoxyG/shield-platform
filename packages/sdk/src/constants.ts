/**
 * Deployed ShieldZK contract addresses and default network parameters for Stellar Testnet.
 */
export const TESTNET_CONFIG = {
  networkPassphrase: "Test SDF Network ; September 2015",
  rpcUrl: "https://soroban-testnet.stellar.org",
  contracts: {
    vault: "CBAL4VIZI6MUKVAMYMWQW3VHB3Y7X7A6LAYZTWSKJCHYNFCXF2VC4MVP",
    claimVerifier: "CBXOBFOER2IEX4J6F4Q74MSOQYCADTTUJHD223R7FLWTBFPQAFHQQDQY",
    conservationVerifier: "CD25OGD5XKK757D5QAEDHLXU6LB3XB2FVI4VVSCTRJBW44MILKI2BKXC",
    nativeAsset: "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC",
  },
} as const
