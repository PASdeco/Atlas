import { ARC_TESTNET_CHAIN } from '../../shared/atlasNetworks'

const ARC_CHAIN_HEX = `0x${ARC_TESTNET_CHAIN.id.toString(16)}`

export async function ensureArcWalletNetwork(wallet) {
  if (!wallet?.getEthereumProvider) {
    return
  }

  const provider = await wallet.getEthereumProvider()
  if (!provider?.request) {
    return
  }

  const currentChainId = await provider.request({ method: 'eth_chainId' })
  if (String(currentChainId).toLowerCase() === ARC_CHAIN_HEX.toLowerCase()) {
    return
  }

  try {
    await provider.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: ARC_CHAIN_HEX }],
    })
  } catch (error) {
    const switchErrorCode = Number(error?.code)
    if (switchErrorCode !== 4902) {
      throw new Error('Switch your wallet to Arc Testnet before continuing.', { cause: error })
    }

    await provider.request({
      method: 'wallet_addEthereumChain',
      params: [
        {
          chainId: ARC_CHAIN_HEX,
          chainName: ARC_TESTNET_CHAIN.name,
          rpcUrls: ARC_TESTNET_CHAIN.rpcUrls.default.http,
          nativeCurrency: ARC_TESTNET_CHAIN.nativeCurrency,
          blockExplorerUrls: [ARC_TESTNET_CHAIN.blockExplorers.default.url],
        },
      ],
    })
  }
}
