export const ARC_TESTNET_CHAIN_ID = 5042002
export const ARC_TESTNET_RPC_URL = 'https://rpc.testnet.arc.network'
export const ARC_TESTNET_EXPLORER_URL = 'https://testnet.arcscan.app'
export const ARC_TESTNET_USDC_ADDRESS = '0x3600000000000000000000000000000000000000'

export const GENLAYER_STUDIONET_CHAIN_ID = 61999
export const GENLAYER_STUDIONET_RPC_URL = 'https://studio.genlayer.com/api'
export const GENLAYER_STUDIONET_EXPLORER_URL = 'https://explorer-studio.genlayer.com'

export const ARC_TESTNET_CHAIN = {
  id: ARC_TESTNET_CHAIN_ID,
  name: 'Arc Testnet',
  network: 'arc-testnet',
  nativeCurrency: {
    name: 'USDC',
    symbol: 'USDC',
    decimals: 6,
  },
  rpcUrls: {
    default: {
      http: [ARC_TESTNET_RPC_URL],
    },
  },
  blockExplorers: {
    default: {
      name: 'ArcScan',
      url: ARC_TESTNET_EXPLORER_URL,
    },
  },
  testnet: true,
}

export const GENLAYER_STUDIONET_CHAIN = {
  id: GENLAYER_STUDIONET_CHAIN_ID,
  name: 'GenLayer StudioNet',
  rpcUrls: {
    default: {
      http: [GENLAYER_STUDIONET_RPC_URL],
    },
  },
  nativeCurrency: {
    name: 'GEN',
    symbol: 'GEN',
    decimals: 18,
  },
  blockExplorers: {
    default: {
      name: 'GenLayer Explorer',
      url: GENLAYER_STUDIONET_EXPLORER_URL,
    },
  },
  testnet: true,
}

export const ATLAS_DEFAULT_FEE_BPS = 1000
