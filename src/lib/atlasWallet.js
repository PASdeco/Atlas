import {
  createPublicClient,
  createWalletClient,
  custom,
  fallback,
  formatUnits,
  http,
  parseUnits,
} from 'viem'
import { atlasPoolAbi, erc20Abi } from '../../shared/atlasAbis'
import {
  ARC_TESTNET_CHAIN,
  ARC_TESTNET_RPC_URL,
  ARC_TESTNET_RPC_URLS,
  ARC_TESTNET_USDC_ADDRESS,
} from '../../shared/atlasNetworks'

const usdcDecimals = 6
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'

function normalizeAddress(value = '') {
  return String(value).toLowerCase()
}

function parseUsdcAmount(amountUsdc) {
  const normalized = Number(amountUsdc)
  if (!Number.isFinite(normalized) || normalized <= 0) {
    throw new Error('Enter a valid USDC amount before sending a transaction.')
  }

  return parseUnits(normalized.toFixed(usdcDecimals), usdcDecimals)
}

function parseUrlList(value) {
  return String(value || '')
    .split(/[,\s]+/)
    .map((url) => url.trim())
    .filter(Boolean)
}

function getArcRpcUrls() {
  return [
    ...new Set([
      import.meta.env.VITE_ARC_RPC_URL || ARC_TESTNET_RPC_URL,
      ...parseUrlList(import.meta.env.VITE_ARC_RPC_FALLBACK_URLS),
      ...ARC_TESTNET_RPC_URLS,
    ]),
  ]
}

function createArcPublicTransport() {
  const transports = getArcRpcUrls().map((url) =>
    http(url, {
      retryCount: 1,
      timeout: 12_000,
    }),
  )

  if (transports.length === 1) {
    return transports[0]
  }

  return fallback(transports, {
    rank: false,
    retryCount: 0,
  })
}

export async function depositPremiumWithWallet({
  wallet,
  poolAddress,
  usdcAddress = ARC_TESTNET_USDC_ADDRESS,
  amountUsdc,
}) {
  if (!wallet) {
    throw new Error('Connect a wallet before depositing into Atlas.')
  }

  if (!poolAddress || /^0x0{40}$/i.test(poolAddress)) {
    throw new Error('AtlasPool address is missing. Add `VITE_ATLAS_POOL_ADDRESS` first.')
  }

  const provider = await wallet.getEthereumProvider()
  const walletClient = createWalletClient({
    account: wallet.address,
    chain: ARC_TESTNET_CHAIN,
    transport: custom(provider),
  })
  const publicClient = createPublicClient({
    chain: ARC_TESTNET_CHAIN,
    transport: createArcPublicTransport(),
  })

  const [poolUsdcAddress, , , , , linkedClaimsAddress] = await publicClient.readContract({
    address: poolAddress,
    abi: atlasPoolAbi,
    functionName: 'getPoolSnapshot',
  })

  if (normalizeAddress(poolUsdcAddress) !== normalizeAddress(usdcAddress)) {
    throw new Error(
      `AtlasPool is pointing to ${poolUsdcAddress}, not ${usdcAddress}. Refresh Atlas and try the wallet deposit again.`,
    )
  }

  if (normalizeAddress(linkedClaimsAddress) === normalizeAddress(ZERO_ADDRESS)) {
    throw new Error('AtlasPool is not linked to AtlasClaims yet. Finish the Arc contract setup and try again.')
  }

  const depositAmount = parseUsdcAmount(amountUsdc)
  const allowance = await publicClient.readContract({
    address: usdcAddress,
    abi: erc20Abi,
    functionName: 'allowance',
    args: [wallet.address, poolAddress],
  })

  let approvalHash = null

  if (allowance < depositAmount) {
    approvalHash = await walletClient.writeContract({
      address: usdcAddress,
      abi: erc20Abi,
      functionName: 'approve',
      args: [poolAddress, depositAmount],
      chain: ARC_TESTNET_CHAIN,
      account: wallet.address,
    })

    await publicClient.waitForTransactionReceipt({ hash: approvalHash })
  }

  const depositHash = await walletClient.writeContract({
    address: poolAddress,
    abi: atlasPoolAbi,
    functionName: 'depositPremium',
    args: [wallet.address, depositAmount],
    chain: ARC_TESTNET_CHAIN,
    account: wallet.address,
  })

  const receipt = await publicClient.waitForTransactionReceipt({ hash: depositHash })

  return {
    approvalHash,
    depositHash,
    receipt,
    amount: formatUnits(depositAmount, usdcDecimals),
  }
}
