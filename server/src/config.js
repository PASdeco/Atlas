import { config as dotenvConfig } from 'dotenv'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createPublicClient, createWalletClient, formatUnits, http, parseUnits } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { createAccount as createGenlayerAccount, createClient as createGenlayerClient } from 'genlayer-js'
import { studionet } from 'genlayer-js/chains'
import { PrivyClient } from '@privy-io/node'
import { atlasClaimsAbi, atlasPoolAbi, erc20Abi } from '../../shared/atlasAbis.js'
import {
  ARC_TESTNET_CHAIN,
  ARC_TESTNET_EXPLORER_URL,
  ARC_TESTNET_RPC_URL,
  ARC_TESTNET_USDC_ADDRESS,
  ATLAS_DEFAULT_FEE_BPS,
  GENLAYER_STUDIONET_EXPLORER_URL,
  GENLAYER_STUDIONET_RPC_URL,
} from '../../shared/atlasNetworks.js'

const currentFilePath = fileURLToPath(import.meta.url)
const currentDir = dirname(currentFilePath)
const atlasRoot = resolve(currentDir, '..', '..')

dotenvConfig({ path: resolve(atlasRoot, '.env') })
dotenvConfig()

function getEnv(name, fallback = '') {
  return process.env[name] || fallback
}

function maybeAccount(privateKey) {
  return privateKey ? privateKeyToAccount(privateKey) : null
}

function maybeGenlayerAccount(privateKey) {
  return privateKey ? createGenlayerAccount(privateKey) : null
}

export const serverConfig = {
  port: Number(getEnv('ATLAS_API_PORT', '8787')),
  appUrl: getEnv('ATLAS_APP_URL', 'http://localhost:5173'),
  atlasProtocolName: getEnv('ATLAS_PROTOCOL_NAME', 'Atlas'),
  arc: {
    chain: ARC_TESTNET_CHAIN,
    rpcUrl: getEnv('ARC_RPC_URL', ARC_TESTNET_RPC_URL),
    explorerUrl: getEnv('ARC_EXPLORER_URL', ARC_TESTNET_EXPLORER_URL),
    usdcAddress: getEnv('ARC_USDC_ADDRESS', ARC_TESTNET_USDC_ADDRESS),
    poolAddress: getEnv('VITE_ATLAS_POOL_ADDRESS', getEnv('ATLAS_POOL_ADDRESS')),
    claimsAddress: getEnv('VITE_ATLAS_CLAIMS_ADDRESS', getEnv('ATLAS_CLAIMS_ADDRESS')),
    treasuryWallet: getEnv('ATLAS_TREASURY_WALLET'),
    feeBps: Number(getEnv('ATLAS_PLATFORM_FEE_BPS', String(ATLAS_DEFAULT_FEE_BPS))),
    deployerPrivateKey: getEnv('ARC_DEPLOYER_PRIVATE_KEY'),
    sponsorPrivateKey: getEnv('ARC_SPONSOR_PRIVATE_KEY') || getEnv('ARC_DEPLOYER_PRIVATE_KEY'),
  },
  genlayer: {
    rpcUrl: getEnv('GENLAYER_RPC_URL', GENLAYER_STUDIONET_RPC_URL),
    explorerUrl: getEnv('GENLAYER_EXPLORER_URL', GENLAYER_STUDIONET_EXPLORER_URL),
    contractAddress: getEnv('GENLAYER_ATLAS_JURY_ADDRESS'),
    privateKey: getEnv('GENLAYER_PRIVATE_KEY'),
  },
  privy: {
    appId: getEnv('VITE_PRIVY_APP_ID'),
    appSecret: getEnv('PRIVY_APP_SECRET'),
    verificationKey: getEnv('PRIVY_VERIFICATION_KEY'),
  },
  stripe: {
    secretKey: getEnv('STRIPE_SECRET_KEY'),
    webhookSecret: getEnv('STRIPE_WEBHOOK_SECRET'),
    priceId: getEnv('STRIPE_PREMIUM_PRICE_ID'),
  },
}

export const arcPublicClient = createPublicClient({
  chain: serverConfig.arc.chain,
  transport: http(serverConfig.arc.rpcUrl),
})

export const arcSponsorAccount = maybeAccount(serverConfig.arc.sponsorPrivateKey)

export const arcWalletClient = arcSponsorAccount
  ? createWalletClient({
      account: arcSponsorAccount,
      chain: serverConfig.arc.chain,
      transport: http(serverConfig.arc.rpcUrl),
    })
  : null

export const genlayerAccount = maybeGenlayerAccount(serverConfig.genlayer.privateKey)

export const genlayerClient = createGenlayerClient({
  chain: studionet,
  endpoint: serverConfig.genlayer.rpcUrl,
  account: genlayerAccount || undefined,
})

export const privyClient =
  serverConfig.privy.appId && serverConfig.privy.appSecret
    ? new PrivyClient({
        appId: serverConfig.privy.appId,
        appSecret: serverConfig.privy.appSecret,
        jwtVerificationKey: serverConfig.privy.verificationKey || undefined,
      })
    : null

export const atlasContracts = {
  pool: {
    address: serverConfig.arc.poolAddress,
    abi: atlasPoolAbi,
  },
  claims: {
    address: serverConfig.arc.claimsAddress,
    abi: atlasClaimsAbi,
  },
  usdc: {
    address: serverConfig.arc.usdcAddress,
    abi: erc20Abi,
  },
}

export function parseUsdc(value) {
  const normalized = Number(value)
  if (!Number.isFinite(normalized) || normalized <= 0) {
    throw new Error('USDC amount must be positive.')
  }

  return parseUnits(normalized.toFixed(6), 6)
}

export function formatUsdc(value) {
  return Number(formatUnits(BigInt(value), 6))
}
