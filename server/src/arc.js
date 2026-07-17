import { decodeEventLog, parseAbiItem } from 'viem'
import { arcPublicClient, arcWalletClient, atlasContracts, formatUsdc, parseUsdc } from './config.js'

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'
const CLAIM_SCAN_LIMIT = 6
const ARC_READ_CACHE_TTL_MS = 20 * 1000
const ARC_READ_STALE_TTL_MS = 3 * 60 * 1000
const PREMIUM_CACHE_TTL_MS = 60 * 1000
const PREMIUM_LOG_CHUNK_SIZE = 9_000n
const PREMIUM_LOOKBACK_BLOCKS = 1_500_000n
const premiumDepositedEvent = parseAbiItem(
  'event PremiumDeposited(address indexed member, address indexed payer, uint256 grossAmount, uint256 poolAmount, uint256 treasuryAmount)',
)
const claimSubmittedEvent = parseAbiItem(
  'event ClaimSubmitted(uint256 indexed claimId, address indexed member, string category, uint256 requestedAmount, string externalReference)',
)
const latestPremiumDepositCache = new Map()
const arcHealthCache = new Map()
const arcOverviewCache = new Map()
const recentClaimsCache = new Map()

function normalizeAddress(value = '') {
  return String(value).toLowerCase()
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function readFreshCache(cache, key) {
  const cached = cache.get(key)
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value
  }
  return null
}

function readStaleCache(cache, key) {
  const cached = cache.get(key)
  if (cached && cached.staleUntil > Date.now()) {
    return cached.value
  }
  return null
}

function writeReadCache(cache, key, value) {
  cache.set(key, {
    value,
    expiresAt: Date.now() + ARC_READ_CACHE_TTL_MS,
    staleUntil: Date.now() + ARC_READ_STALE_TTL_MS,
  })
  return value
}

function invalidateArcReadCaches() {
  arcOverviewCache.clear()
  recentClaimsCache.clear()
}

function isRpcLimitError(error) {
  const message = [
    error?.message,
    error?.shortMessage,
    error?.details,
    error?.cause?.message,
    error?.cause?.shortMessage,
    error?.cause?.details,
  ]
    .filter(Boolean)
    .join(' ')

  return /request limit reached|rate limit|too many requests/i.test(message)
}

function getClaimStatusDetails(status) {
  const normalizedStatus = Number(status || 0)

  if (normalizedStatus === 4) {
    return {
      status: 'paid',
      approved: true,
      reason: 'Claim paid from AtlasPool on Arc.',
    }
  }

  if (normalizedStatus === 3) {
    return {
      status: 'rejected',
      approved: false,
      reason: 'Claim rejected after Atlas jury review.',
    }
  }

  if (normalizedStatus === 2) {
    return {
      status: 'approved',
      approved: true,
      reason: 'Claim approved on Arc and preparing payout.',
    }
  }

  if (normalizedStatus === 1) {
    return {
      status: 'queued',
      approved: false,
      reason: 'Claim registered on Arc and queued for verdict.',
    }
  }

  return {
    status: 'submitted',
    approved: false,
    reason: 'Claim submitted on Arc and awaiting processing.',
  }
}

function requireArcWriteReady() {
  if (!arcWalletClient) {
    throw new Error('Set ARC_SPONSOR_PRIVATE_KEY or ARC_DEPLOYER_PRIVATE_KEY to enable Arc writes.')
  }
  if (!atlasContracts.pool.address || !atlasContracts.claims.address) {
    throw new Error('Set ATLAS_POOL_ADDRESS and ATLAS_CLAIMS_ADDRESS before using Arc integrations.')
  }
}

export async function assertArcContractsHealthy() {
  requireArcWriteReady()

  const cacheKey = [
    normalizeAddress(atlasContracts.pool.address),
    normalizeAddress(atlasContracts.claims.address),
    normalizeAddress(atlasContracts.usdc.address),
  ].join(':')
  const fresh = readFreshCache(arcHealthCache, cacheKey)
  if (fresh) {
    return fresh
  }

  let poolUsdcAddress
  let linkedClaimsAddress

  try {
    const poolSnapshot = await arcPublicClient.readContract({
      address: atlasContracts.pool.address,
      abi: atlasContracts.pool.abi,
      functionName: 'getPoolSnapshot',
    })

    poolUsdcAddress = poolSnapshot[0]
    linkedClaimsAddress = poolSnapshot[5]
  } catch (error) {
    const stale = readStaleCache(arcHealthCache, cacheKey)
    if (stale) {
      return stale
    }

    if (isRpcLimitError(error)) {
      return {
        poolUsdcAddress: atlasContracts.usdc.address,
        linkedClaimsAddress: atlasContracts.claims.address,
        rpcDegraded: true,
      }
    }

    throw error
  }

  if (normalizeAddress(poolUsdcAddress) !== normalizeAddress(atlasContracts.usdc.address)) {
    throw new Error(
      `AtlasPool on Arc is configured with ${poolUsdcAddress}, not ${atlasContracts.usdc.address}. Redeploy AtlasPool with the correct ARC_USDC_ADDRESS and relink AtlasClaims.`,
    )
  }

  if (normalizeAddress(linkedClaimsAddress) !== normalizeAddress(atlasContracts.claims.address)) {
    if (normalizeAddress(linkedClaimsAddress) === ZERO_ADDRESS) {
      throw new Error(
        'AtlasPool on Arc is not linked to AtlasClaims yet. Set the claims contract on the pool or redeploy and relink the Arc contracts.',
      )
    }

    throw new Error(
      `AtlasPool on Arc is linked to ${linkedClaimsAddress}, not ${atlasContracts.claims.address}. Relink or redeploy the Arc contracts so both addresses match.`,
    )
  }

  return writeReadCache(arcHealthCache, cacheKey, {
    poolUsdcAddress,
    linkedClaimsAddress,
  })
}

export async function readArcOverview(walletAddress) {
  const cacheKey = `${normalizeAddress(walletAddress)}:${normalizeAddress(atlasContracts.pool.address)}`
  const fresh = readFreshCache(arcOverviewCache, cacheKey)
  if (fresh) {
    return fresh
  }

  try {
    const [poolSnapshot, memberPremium] = await Promise.all([
      atlasContracts.pool.address
        ? arcPublicClient.readContract({
            address: atlasContracts.pool.address,
            abi: atlasContracts.pool.abi,
            functionName: 'getPoolSnapshot',
          })
        : Promise.resolve([
            atlasContracts.usdc.address,
            '0x0000000000000000000000000000000000000000',
            1000,
            0n,
            0n,
            '0x0000000000000000000000000000000000000000',
          ]),
      walletAddress && atlasContracts.pool.address
        ? arcPublicClient.readContract({
            address: atlasContracts.pool.address,
            abi: atlasContracts.pool.abi,
            functionName: 'premiumByMember',
            args: [walletAddress],
          })
        : Promise.resolve(0n),
    ])

    return writeReadCache(arcOverviewCache, cacheKey, {
      poolSnapshot,
      memberPremium,
    })
  } catch (error) {
    const stale = readStaleCache(arcOverviewCache, cacheKey)
    if (stale) {
      return stale
    }
    throw error
  }
}

export async function readArcClaimsByMember(walletAddress) {
  if (!walletAddress) {
    return []
  }

  const claims = await readRecentArcClaims()
  return claims.filter(
    (claim) => normalizeAddress(claim.walletAddress) === normalizeAddress(walletAddress),
  )
}

export async function readRecentArcClaims(limit = CLAIM_SCAN_LIMIT) {
  if (!atlasContracts.claims.address) {
    return []
  }

  const cacheKey = `${normalizeAddress(atlasContracts.claims.address)}:${Number(limit)}`
  const fresh = readFreshCache(recentClaimsCache, cacheKey)
  if (fresh) {
    return fresh
  }

  try {
    const nextClaimId = await arcPublicClient.readContract({
      address: atlasContracts.claims.address,
      abi: atlasContracts.claims.abi,
      functionName: 'nextClaimId',
    })

    const highestClaimId = Number(nextClaimId) - 1
    if (highestClaimId < 1) {
      return writeReadCache(recentClaimsCache, cacheKey, [])
    }

    const firstClaimId = Math.max(1, highestClaimId - Number(limit) + 1)
    const claimIds = []

    for (let claimId = highestClaimId; claimId >= firstClaimId; claimId -= 1) {
      claimIds.push(claimId)
    }

    const claims = await Promise.all(
      claimIds.map(async (claimId) => {
        const claimTuple = await arcPublicClient.readContract({
          address: atlasContracts.claims.address,
          abi: atlasContracts.claims.abi,
          functionName: 'claims',
          args: [BigInt(claimId)],
        })

        const [
          member,
          category,
          evidenceUri,
          description,
          requestedAmount,
          approvedAmount,
          status,
          submittedAt,
          verdictUri,
          externalReference,
          juryReference,
        ] = claimTuple

        const statusDetails = getClaimStatusDetails(status)

        return {
          id: claimId,
          arcClaimId: claimId,
          walletAddress: member,
          category,
          description,
          evidenceUri,
          requestedAmount: formatUsdc(requestedAmount),
          requestedAmountUsdc: formatUsdc(requestedAmount),
          payoutAmountUsdc: formatUsdc(approvedAmount),
          approved: statusDetails.approved,
          status: statusDetails.status,
          verdictUri,
          externalReference,
          juryReference,
          createdAt: new Date(Number(submittedAt) * 1000).toISOString(),
          reason: statusDetails.reason,
        }
      }),
    )

    return writeReadCache(recentClaimsCache, cacheKey, claims.filter(Boolean))
  } catch (error) {
    const stale = readStaleCache(recentClaimsCache, cacheKey)
    if (stale) {
      return stale
    }
    throw error
  }
}

export async function readLatestPremiumDepositByMember(walletAddress) {
  if (!walletAddress || !atlasContracts.pool.address || !premiumDepositedEvent) {
    return null
  }

  const normalizedWallet = normalizeAddress(walletAddress)
  const cached = latestPremiumDepositCache.get(normalizedWallet)
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value
  }

  const latestBlock = await arcPublicClient.getBlockNumber()
  const earliestBlock =
    latestBlock > PREMIUM_LOOKBACK_BLOCKS ? latestBlock - PREMIUM_LOOKBACK_BLOCKS : 0n

  let toBlock = latestBlock

  while (toBlock >= earliestBlock) {
    let fromBlock =
      toBlock > PREMIUM_LOG_CHUNK_SIZE ? toBlock - PREMIUM_LOG_CHUNK_SIZE : 0n

    if (fromBlock < earliestBlock) {
      fromBlock = earliestBlock
    }

    const logs = await arcPublicClient.getLogs({
      address: atlasContracts.pool.address,
      event: premiumDepositedEvent,
      args: {
        member: walletAddress,
      },
      fromBlock,
      toBlock,
    })

    if (logs.length > 0) {
      const latestLog = logs[logs.length - 1]
      const block = await arcPublicClient.getBlock({ blockNumber: latestLog.blockNumber })
      const value = {
        walletAddress,
        amountUsdc: formatUsdc(latestLog.args.grossAmount || 0n),
        confirmedAt: new Date(Number(block.timestamp) * 1000).toISOString(),
        depositHash: latestLog.transactionHash,
        blockNumber: latestLog.blockNumber,
      }

      latestPremiumDepositCache.set(normalizedWallet, {
        expiresAt: Date.now() + PREMIUM_CACHE_TTL_MS,
        value,
      })

      return value
    }

    if (fromBlock === earliestBlock || fromBlock === 0n) {
      break
    }

    toBlock = fromBlock - 1n
  }

  latestPremiumDepositCache.set(normalizedWallet, {
    expiresAt: Date.now() + PREMIUM_CACHE_TTL_MS,
    value: null,
  })

  return null
}

export async function sponsorCardDeposit({ walletAddress, amountUsdc }) {
  await assertArcContractsHealthy()

  const amount = parseUsdc(amountUsdc)

  const approvalHash = await arcWalletClient.writeContract({
    address: atlasContracts.usdc.address,
    abi: atlasContracts.usdc.abi,
    functionName: 'approve',
    args: [atlasContracts.pool.address, amount],
  })
  await arcPublicClient.waitForTransactionReceipt({ hash: approvalHash })

  const depositHash = await arcWalletClient.writeContract({
    address: atlasContracts.pool.address,
    abi: atlasContracts.pool.abi,
    functionName: 'depositPremium',
    args: [walletAddress, amount],
  })
  await arcPublicClient.waitForTransactionReceipt({ hash: depositHash })
  invalidateArcReadCaches()

  return {
    approvalHash,
    depositHash,
    amount,
  }
}

export async function verifyWalletDeposit({
  walletAddress,
  amountUsdc,
  depositHash,
  approvalHash,
}) {
  await assertArcContractsHealthy()

  const receipt = await arcPublicClient.waitForTransactionReceipt({ hash: depositHash })
  if (receipt.status !== 'success') {
    throw new Error('Arc wallet deposit transaction did not succeed.')
  }

  const premiumLog = receipt.logs.find(
    (log) =>
      normalizeAddress(log.address) === normalizeAddress(atlasContracts.pool.address) &&
      log.topics?.[0] === '0xd221f6525c562b6842a38cad0adf62c517409745106d0c610918d1ca792a9707',
  )

  if (!premiumLog || !premiumDepositedEvent) {
    throw new Error('Could not verify the PremiumDeposited event for this wallet deposit.')
  }

  const decodedLog = decodeEventLog({
    abi: [premiumDepositedEvent],
    data: premiumLog.data,
    topics: premiumLog.topics,
  })

  if (normalizeAddress(decodedLog.args.member) !== normalizeAddress(walletAddress)) {
    throw new Error('Arc wallet deposit did not credit the expected Atlas member wallet.')
  }

  const expectedAmount = parseUsdc(amountUsdc)
  if (decodedLog.args.grossAmount !== expectedAmount) {
    throw new Error('Arc wallet deposit amount does not match the Atlas plan amount.')
  }

  if (approvalHash) {
    const approvalReceipt = await arcPublicClient.waitForTransactionReceipt({ hash: approvalHash })
    if (approvalReceipt.status !== 'success') {
      throw new Error('Arc USDC approval transaction did not succeed.')
    }
  }

  const block = await arcPublicClient.getBlock({ blockNumber: receipt.blockNumber })
  latestPremiumDepositCache.set(normalizeAddress(walletAddress), {
    expiresAt: Date.now() + PREMIUM_CACHE_TTL_MS,
    value: {
      walletAddress,
      amountUsdc: Number(amountUsdc),
      confirmedAt: new Date(Number(block.timestamp) * 1000).toISOString(),
      depositHash,
      blockNumber: receipt.blockNumber,
    },
  })
  invalidateArcReadCaches()

  return {
    receipt,
    decodedLog,
    block,
  }
}

export async function submitClaimOnArc({
  walletAddress,
  category,
  evidenceUri,
  description,
  requestedAmountUsdc,
  externalReference,
}) {
  await assertArcContractsHealthy()

  const requestedAmount = parseUsdc(requestedAmountUsdc)

  const claimHash = await arcWalletClient.writeContract({
    address: atlasContracts.claims.address,
    abi: atlasContracts.claims.abi,
    functionName: 'submitClaimFor',
    args: [walletAddress, category, evidenceUri, description, requestedAmount, externalReference],
  })
  const receipt = await arcPublicClient.waitForTransactionReceipt({ hash: claimHash })
  if (receipt.status !== 'success') {
    throw new Error('Arc claim submission transaction did not succeed.')
  }

  const claimLog = receipt.logs.find((log) => {
    if (normalizeAddress(log.address) !== normalizeAddress(atlasContracts.claims.address)) {
      return false
    }

    try {
      const decoded = decodeEventLog({
        abi: [claimSubmittedEvent],
        data: log.data,
        topics: log.topics,
      })

      return (
        Number(decoded.args.claimId || 0n) > 0 &&
        normalizeAddress(decoded.args.member) === normalizeAddress(walletAddress)
      )
    } catch {
      return false
    }
  })

  if (!claimLog) {
    throw new Error('Could not verify the ClaimSubmitted event for this Arc claim.')
  }

  const decodedLog = decodeEventLog({
    abi: [claimSubmittedEvent],
    data: claimLog.data,
    topics: claimLog.topics,
  })

  const claimId = Number(decodedLog.args.claimId)
  if (!Number.isFinite(claimId) || claimId < 1) {
    throw new Error('Arc claim submission did not return a valid claim id.')
  }

  // Give Arc a short moment to expose the new claim to subsequent readContract calls.
  let attempts = 0
  while (attempts < 4) {
    try {
      await arcPublicClient.readContract({
        address: atlasContracts.claims.address,
        abi: atlasContracts.claims.abi,
        functionName: 'claims',
        args: [BigInt(claimId)],
      })
      break
    } catch (error) {
      attempts += 1
      if (attempts >= 4) {
        throw new Error(
          `Arc claim ${claimId} was submitted but is not readable yet. Please retry queueing in a moment.`,
          { cause: error },
        )
      }

      await wait(1200)
    }
  }

  invalidateArcReadCaches()

  return {
    claimHash,
    claimId,
    requestedAmount,
  }
}

export async function queueClaimOnArc({ claimId, juryReference }) {
  requireArcWriteReady()

  const hash = await arcWalletClient.writeContract({
    address: atlasContracts.claims.address,
    abi: atlasContracts.claims.abi,
    functionName: 'queueClaimForVerdict',
    args: [BigInt(claimId), juryReference],
  })
  await arcPublicClient.waitForTransactionReceipt({ hash })
  invalidateArcReadCaches()
  return hash
}

export async function resolveClaimOnArc({
  claimId,
  approved,
  payoutAmountUsdc,
  verdictUri,
  juryReference,
}) {
  requireArcWriteReady()

  const payoutAmount = approved ? parseUsdc(payoutAmountUsdc) : 0n
  const hash = await arcWalletClient.writeContract({
    address: atlasContracts.claims.address,
    abi: atlasContracts.claims.abi,
    functionName: 'resolveAndPayClaim',
    args: [BigInt(claimId), approved, payoutAmount, verdictUri, juryReference],
  })
  await arcPublicClient.waitForTransactionReceipt({ hash })
  invalidateArcReadCaches()
  return { hash, payoutAmount }
}
