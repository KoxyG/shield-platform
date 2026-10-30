/**
 * Deployed ShieldZK contract addresses and default network parameters for Stellar Testnet.
 */
export const TESTNET_CONFIG = {
  networkPassphrase: "Test SDF Network ; September 2015",
  rpcUrl: "https://soroban-testnet.stellar.org",
  contracts: {
    vault: "CABER2IAOZFCSJ6BZOAEAWBQEQGZ4BVD3EBXIPVBI6KJHY4DSRB3BJRT",
    claimVerifier: "CBXOBFOER2IEX4J6F4Q74MSOQYCADTTUJHD223R7FLWTBFPQAFHQQDQY",
    conservationVerifier: "CAYXGCJDVIJORDQRODLECM2ITY76QH4JAHCFLA3WOGXEZBGGAHFXH2Z4",
    nativeAsset: "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC",
  },
} as const
