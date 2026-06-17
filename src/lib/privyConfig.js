import { addRpcUrlOverrideToChain } from '@privy-io/chains'
import { ARC_TESTNET_CHAIN, ARC_TESTNET_RPC_URL } from '../../shared/atlasNetworks'

const arcRpcUrl = import.meta.env.VITE_ARC_RPC_URL || ARC_TESTNET_RPC_URL

export const privyArcChain = addRpcUrlOverrideToChain(ARC_TESTNET_CHAIN, arcRpcUrl)

export const privyConfig = {
  appearance: {
    theme: 'light',
    accentColor: '#1f5f60',
    landingHeader: 'Protect your life in minutes',
    loginMessage: 'Atlas uses Arc for money movement and GenLayer StudioNet for claim intelligence.',
    showWalletLoginFirst: false,
    walletChainType: 'ethereum-only',
  },
  loginMethods: ['google', 'wallet'],
  walletConnectCloudProjectId:
    import.meta.env.VITE_WALLETCONNECT_PROJECT_ID?.trim() || undefined,
  supportedChains: [privyArcChain],
  defaultChain: privyArcChain,
  embeddedWallets: {
    ethereum: {
      createOnLogin: 'users-without-wallets',
    },
    showWalletUIs: true,
  },
  legal: {
    termsAndConditionsUrl: import.meta.env.VITE_TERMS_URL || 'https://atlas.example/terms',
    privacyPolicyUrl: import.meta.env.VITE_PRIVACY_URL || 'https://atlas.example/privacy',
  },
}
