import cors from 'cors'
import express from 'express'
import Stripe from 'stripe'
import { getAddress } from 'viem'
import { z } from 'zod'
import { getAuthenticatedUser } from './auth.js'
import { formatUsdc, serverConfig } from './config.js'
import {
  assertArcContractsHealthy,
  queueClaimOnArc,
  readRecentArcClaims,
  readLatestPremiumDepositByMember,
  readArcOverview,
  resolveClaimOnArc,
  sponsorCardDeposit,
  submitClaimOnArc,
  verifyWalletDeposit,
} from './arc.js'
import { evaluateClaimOnGenlayer } from './genlayer.js'
import {
  createClaimRecord,
  createDeposit,
  getDepositByArcHash,
  getDepositByStripeSessionId,
  getDepositRecord,
  getClaimRecord,
  getLatestCompletedDepositByWallet,
  listClaimsByWallet,
  restoreDepositRecord,
  updateClaimRecord,
  updateDeposit,
} from './store.js'

const app = express()
const stripe = serverConfig.stripe.secretKey ? new Stripe(serverConfig.stripe.secretKey) : null
const COVERAGE_WINDOW_DAYS = 30
const DAY_MS = 24 * 60 * 60 * 1000
const MAX_CLAIM_AMOUNT_USDC = 10
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'

function normalizeWalletAddress(value, { optional = false } = {}) {
  const raw = String(value || '').trim()
  if (!raw && optional) {
    return ''
  }

  try {
    return getAddress(raw.toLowerCase())
  } catch {
    const error = new Error('Invalid wallet address.')
    error.status = 400
    throw error
  }
}

const walletAddressSchema = z
  .string()
  .trim()
  .transform((value, context) => {
    try {
      return normalizeWalletAddress(value)
    } catch {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Invalid wallet address.',
      })
      return z.NEVER
    }
  })

const evidenceUrlSchema = z
  .string()
  .trim()
  .url()
  .refine((url) => /^https?:\/\//i.test(url), {
    message: 'Evidence must be an HTTP(S) URL that GenLayer can render.',
  })

const claimSchema = z.object({
  walletAddress: walletAddressSchema,
  category: z.string().min(2),
  description: z.string().min(10),
  files: z.array(z.string()).default([]),
  evidenceUrls: z.array(evidenceUrlSchema).min(1).max(2),
  requestedAmount: z
    .number()
    .positive()
    .max(
      MAX_CLAIM_AMOUNT_USDC,
      `Requested claim amount cannot exceed $${MAX_CLAIM_AMOUNT_USDC.toFixed(2)} right now.`,
    ),
})

const depositSchema = z.object({
  walletAddress: walletAddressSchema,
  planTitle: z.string().min(2),
  amountUsdc: z.number().positive(),
})

const walletDepositSchema = z.object({
  walletAddress: walletAddressSchema,
  planTitle: z.string().min(2),
  amountUsdc: z.number().positive(),
  depositHash: z.string().regex(/^0x[a-fA-F0-9]{64}$/),
  approvalHash: z.string().regex(/^0x[a-fA-F0-9]{64}$/).nullable().optional(),
})

const confirmDepositSchema = z.object({
  sessionId: z.string().min(1).optional(),
})

function resolveAppUrl(request) {
  const origin = String(request.headers.origin || '').trim()
  if (/^https?:\/\//i.test(origin)) {
    return origin.replace(/\/$/, '')
  }

  return serverConfig.appUrl.replace(/\/$/, '')
}

function isStripePaymentComplete(session) {
  return session?.payment_status === 'paid' || session?.status === 'complete'
}

function getCoverageTiming(record) {
  if (!record) {
    return null
  }

  const activatedAt = new Date(
    record.confirmedAt || record.lastPremiumPaidAt || record.updatedAt || record.createdAt,
  ).getTime()
  if (!Number.isFinite(activatedAt)) {
    return null
  }

  const expiresAt = activatedAt + COVERAGE_WINDOW_DAYS * DAY_MS
  const remainingMs = expiresAt - Date.now()
  const isActive = remainingMs > 0

  return {
    activatedAt: new Date(activatedAt).toISOString(),
    expiresAt: new Date(expiresAt).toISOString(),
    isActive,
    renewsInDays: isActive ? Math.max(1, Math.ceil(remainingMs / DAY_MS)) : 0,
  }
}

function buildCoverageState({ latestDeposit, fallbackPremiumUsdc = 0 }) {
  const timing = getCoverageTiming(latestDeposit)

  if (latestDeposit && timing) {
    return {
      isCoverageActive: timing.isActive,
      canFileClaim: timing.isActive,
      coverageActivatedAt: timing.activatedAt,
      coverageExpiresAt: timing.expiresAt,
      lastPremiumPaidAt: timing.activatedAt,
      monthlyPremiumUsdc: timing.isActive ? Number(latestDeposit.amountUsdc || 0) : 0,
      renewsInDays: timing.renewsInDays,
    }
  }

  const normalizedFallbackPremium = Number(fallbackPremiumUsdc || 0)
  return {
    isCoverageActive: false,
    canFileClaim: false,
    coverageActivatedAt: '',
    coverageExpiresAt: '',
    lastPremiumPaidAt: '',
    monthlyPremiumUsdc: normalizedFallbackPremium > 0 ? normalizedFallbackPremium : 0,
    renewsInDays: 0,
  }
}

function buildRecentActivity(claims) {
  if (!Array.isArray(claims) || claims.length === 0) {
    return []
  }

  const now = Date.now()
  const recentWindowMs = 7 * DAY_MS
  const bucketOrder = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const buckets = bucketOrder.map((day) => ({
    day,
    approved: 0,
    pending: 0,
    rejected: 0,
  }))

  for (const claim of claims) {
    const createdAt = new Date(claim.createdAt || '').getTime()
    if (!Number.isFinite(createdAt) || now - createdAt > recentWindowMs) {
      continue
    }

    const bucket = buckets[new Date(createdAt).getDay()]
    if (!bucket) {
      continue
    }

    if (claim.approved || claim.status === 'paid' || claim.status === 'approved') {
      bucket.approved += 1
      continue
    }

    if (claim.status === 'rejected') {
      bucket.rejected += 1
      continue
    }

    bucket.pending += 1
  }

  return buckets
}

function buildPoolComposition(arcOverview) {
  const poolSizeUsdc = formatUsdc(arcOverview.poolSnapshot?.[3] || 0n)
  const treasuryBalanceUsdc = formatUsdc(arcOverview.poolSnapshot?.[4] || 0n)
  const totalTracked = poolSizeUsdc + treasuryBalanceUsdc

  if (totalTracked <= 0) {
    return []
  }

  const toPercent = (value) => Number(((value / totalTracked) * 100).toFixed(1))

  return [
    {
      name: 'Community pool',
      value: toPercent(poolSizeUsdc),
      amountUsdc: poolSizeUsdc,
      color: '#c3ea8d',
    },
    {
      name: 'Treasury collected',
      value: toPercent(treasuryBalanceUsdc),
      amountUsdc: treasuryBalanceUsdc,
      color: '#163c3d',
    },
  ].filter((entry) => entry.amountUsdc > 0)
}

function buildEmptyArcOverview() {
  return {
    poolSnapshot: [
      serverConfig.arc.usdcAddress,
      ZERO_ADDRESS,
      0,
      0n,
      0n,
      ZERO_ADDRESS,
    ],
    memberPremium: 0n,
  }
}

function isArcRpcLimitError(error) {
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

function getPublicErrorMessage(error) {
  if (isArcRpcLimitError(error)) {
    return 'Arc Testnet RPC providers are rate-limiting requests right now. Wait a minute and retry, or configure a dedicated ARC_RPC_URL.'
  }

  return error?.message || 'Atlas request failed.'
}

function buildOverviewPayload({
  walletAddress,
  arcOverview = buildEmptyArcOverview(),
  claims = [],
  globalRecentClaims = [],
  latestPremiumDeposit = null,
  latestCompletedDeposit = null,
  rpcDegraded = false,
}) {
  const historicalPremiumUsdc = formatUsdc(arcOverview.memberPremium || 0n)
  const latestCoverageDeposit = latestPremiumDeposit || latestCompletedDeposit
  const coverage = buildCoverageState({
    latestDeposit: latestCoverageDeposit,
    fallbackPremiumUsdc: historicalPremiumUsdc,
  })

  return {
    member: {
      walletAddress,
      walletDisplay: walletAddress ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}` : '',
      monthlyPremiumUsdc: coverage.monthlyPremiumUsdc,
      renewsInDays: coverage.renewsInDays,
      isCoverageActive: coverage.isCoverageActive,
      canFileClaim: coverage.canFileClaim,
      coverageActivatedAt: coverage.coverageActivatedAt,
      coverageExpiresAt: coverage.coverageExpiresAt,
      lastPremiumPaidAt: coverage.lastPremiumPaidAt,
      totalPaidToYouUsdc: claims
        .filter((claim) => claim.approved)
        .reduce((sum, claim) => sum + Number(claim.payoutAmountUsdc || 0), 0),
      activeClaims: claims.filter((claim) => claim.status !== 'rejected' && claim.status !== 'paid').length,
      approvedClaims: claims.filter((claim) => claim.approved).length,
      pendingClaims: claims.filter((claim) => !claim.approved && claim.status !== 'rejected').length,
      payoutWallet: walletAddress || 'Embedded wallet pending',
    },
    pool: {
      poolSizeUsdc: formatUsdc(arcOverview.poolSnapshot?.[3] || 0n),
      claimsPaid: globalRecentClaims.filter((claim) => claim.approved).length,
      activeMembers: 0,
      protocolFeeCollectedUsdc: formatUsdc(arcOverview.poolSnapshot?.[4] || 0n),
      reserveBufferUsdc: formatUsdc(arcOverview.poolSnapshot?.[3] || 0n),
      reserveCoverageRatio:
        globalRecentClaims.filter((claim) => claim.status !== 'rejected').length > 0
          ? Number(
              (
                (formatUsdc(arcOverview.poolSnapshot?.[3] || 0n) /
                  Math.max(
                    1,
                    globalRecentClaims
                      .filter((claim) => claim.status !== 'rejected')
                      .reduce((sum, claim) => sum + Number(claim.requestedAmountUsdc || 0), 0),
                  )) *
                100
              ).toFixed(0),
            )
          : 0,
      treasuryBalanceUsdc: formatUsdc(arcOverview.poolSnapshot?.[4] || 0n),
    },
    recentClaims: claims.slice(0, 6).map((claim) => ({
      id: claim.id,
      type: `${claim.category} claim`,
      amount: `$${Number(claim.payoutAmountUsdc || claim.requestedAmount || 0).toFixed(0)}`,
      date: new Date(claim.createdAt).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      }),
      status: humanizeClaimStatus(claim),
      reason: claim.reason,
    })),
    recentActivity: buildRecentActivity(globalRecentClaims),
    poolComposition: buildPoolComposition(arcOverview),
    signal: rpcDegraded
      ? {
          arcRpcDegraded: true,
          message: 'Arc RPC request limit reached; Atlas is showing local or cached data.',
        }
      : {},
  }
}

function assertCoverageActive(coverage) {
  if (coverage?.isCoverageActive) {
    return
  }

  const error = new Error('Atlas coverage is inactive. Pay your premium before filing a claim.')
  error.status = 403
  throw error
}

function restoreDepositFromStripeSession(session, requestedDepositId) {
  const walletAddress = normalizeWalletAddress(session?.metadata?.walletAddress)
  const planTitle = String(session?.metadata?.planTitle || '').trim()
  const amountUsdc = Number(session?.metadata?.amountUsdc || 0)
  const metadataDepositId = Number(session?.metadata?.depositId || 0)
  const fallbackDepositId = Number(requestedDepositId || 0)
  const depositId = metadataDepositId || fallbackDepositId

  if (!walletAddress || !planTitle || !Number.isFinite(amountUsdc) || amountUsdc <= 0) {
    return null
  }

  if (!Number.isInteger(depositId) || depositId <= 0) {
    return null
  }

  return restoreDepositRecord({
    id: depositId,
    walletAddress,
    planTitle,
    amountUsdc,
    source: 'card',
    status: 'awaiting_payment',
    stripeSessionId: session.id,
  })
}

app.use(cors({ origin: true, credentials: false }))
app.use(express.json({ limit: '8mb' }))

app.get('/api/health', (_request, response) => {
  response.json({
    ok: true,
    arcRpcUrl: serverConfig.arc.rpcUrl,
    arcRpcFallbackUrls: serverConfig.arc.rpcUrls.slice(1),
    genlayerRpcUrl: serverConfig.genlayer.rpcUrl,
  })
})

app.get('/api/config', async (request, response) => {
  const user = await getAuthenticatedUser(request)
  response.json({
    auth: {
      authenticated: Boolean(user),
    },
    arc: {
      chainId: serverConfig.arc.chain.id,
      rpcUrl: serverConfig.arc.rpcUrl,
      rpcFallbackUrls: serverConfig.arc.rpcUrls.slice(1),
      explorerUrl: serverConfig.arc.explorerUrl,
      usdcAddress: serverConfig.arc.usdcAddress,
      poolAddress: serverConfig.arc.poolAddress || '',
      claimsAddress: serverConfig.arc.claimsAddress || '',
      treasuryWallet: serverConfig.arc.treasuryWallet || '',
      feeBps: serverConfig.arc.feeBps,
    },
    genlayer: {
      rpcUrl: serverConfig.genlayer.rpcUrl,
      explorerUrl: serverConfig.genlayer.explorerUrl,
      contractAddress: serverConfig.genlayer.contractAddress || '',
      mode: 'studionet',
    },
  })
})

app.get('/api/overview', async (request, response, next) => {
  const walletAddress = normalizeWalletAddress(request.query.wallet, { optional: true })

  try {
    const arcOverview = await readArcOverview(walletAddress)
    const historicalPremiumUsdc = formatUsdc(arcOverview.memberPremium || 0n)
    let globalRecentClaims = []
    let latestPremiumDeposit = null
    let rpcDegraded = false

    try {
      globalRecentClaims = await readRecentArcClaims()
    } catch (error) {
      if (!isArcRpcLimitError(error)) {
        throw error
      }
      rpcDegraded = true
    }

    if (walletAddress && historicalPremiumUsdc > 0) {
      try {
        latestPremiumDeposit = await readLatestPremiumDepositByMember(walletAddress)
      } catch (error) {
        if (!isArcRpcLimitError(error)) {
          throw error
        }
        rpcDegraded = true
      }
    }

    const chainClaims = walletAddress
      ? globalRecentClaims.filter(
          (claim) =>
            String(claim.walletAddress || '').toLowerCase() === walletAddress.toLowerCase(),
        )
      : []
    const localClaims = walletAddress ? listClaimsByWallet(walletAddress) : []
    const claims = chainClaims.length > 0 ? chainClaims : localClaims

    response.json(
      buildOverviewPayload({
        walletAddress,
        arcOverview,
        claims,
        globalRecentClaims,
        latestPremiumDeposit,
        latestCompletedDeposit: walletAddress
          ? getLatestCompletedDepositByWallet(walletAddress)
          : null,
        rpcDegraded,
      }),
    )
  } catch (error) {
    if (isArcRpcLimitError(error)) {
      const localClaims = walletAddress ? listClaimsByWallet(walletAddress) : []
      response.json(
        buildOverviewPayload({
          walletAddress,
          arcOverview: buildEmptyArcOverview(),
          claims: localClaims,
          globalRecentClaims: localClaims,
          latestCompletedDeposit: walletAddress
            ? getLatestCompletedDepositByWallet(walletAddress)
            : null,
          rpcDegraded: true,
        }),
      )
      return
    }

    next(error)
  }
})

app.post('/api/deposits/wallet', async (request, response, next) => {
  try {
    const payload = walletDepositSchema.parse(request.body)
    const existingDeposit = getDepositByArcHash(payload.depositHash)

    if (existingDeposit) {
      response.json({
        ok: true,
        deposit: existingDeposit,
        message: 'This wallet premium was already registered on Atlas.',
      })
      return
    }

    const verification = await verifyWalletDeposit(payload)

    const record = createDeposit({
      walletAddress: payload.walletAddress,
      planTitle: payload.planTitle,
      amountUsdc: payload.amountUsdc,
      source: 'wallet',
    })

    const completed = updateDeposit(record.id, {
      status: 'completed',
      arcDepositHash: payload.depositHash,
      arcApprovalHash: payload.approvalHash || null,
      confirmedAt: new Date(Number(verification.block.timestamp) * 1000).toISOString(),
    })

    response.json({
      ok: true,
      deposit: completed,
      message: 'Wallet premium confirmed on Arc. Coverage is active for the next 30 days.',
    })
  } catch (error) {
    next(error)
  }
})

app.post('/api/deposits/card', async (request, response) => {
  const payload = depositSchema.parse(request.body)
  await assertArcContractsHealthy()

  const record = createDeposit(payload)
  const appUrl = resolveAppUrl(request)

  if (!stripe || !serverConfig.stripe.priceId) {
    const checkoutUrl = `${appUrl}/plans?mockStripe=true&deposit=${record.id}`

    try {
      const depositResult = await sponsorCardDeposit(payload)
      updateDeposit(record.id, {
        status: 'completed',
        arcDepositHash: depositResult.depositHash,
        arcApprovalHash: depositResult.approvalHash,
        confirmedAt: new Date().toISOString(),
      })
    } catch (error) {
      updateDeposit(record.id, {
        status: 'queued',
        relayMessage: error.message,
      })
    }

    response.json({
      ok: true,
      depositId: record.id,
      checkoutUrl,
      message:
        'Stripe is not fully configured here yet. Atlas queued a local test-mode card deposit instead.',
    })
    return
  }

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    line_items: [{ price: serverConfig.stripe.priceId, quantity: 1 }],
    success_url: `${appUrl}/plans?checkout=success&deposit=${record.id}&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${appUrl}/plans?checkout=cancelled&deposit=${record.id}`,
    metadata: {
      depositId: String(record.id),
      walletAddress: payload.walletAddress,
      planTitle: payload.planTitle,
      amountUsdc: String(payload.amountUsdc),
    },
  })

  updateDeposit(record.id, {
    status: 'awaiting_payment',
    stripeSessionId: session.id,
  })

  response.json({
    ok: true,
    depositId: record.id,
    checkoutUrl: session.url,
    message: 'Stripe checkout is ready. Atlas will sponsor the Arc premium deposit after payment is confirmed.',
  })
})

app.post('/api/deposits/card/:depositId/confirm', async (request, response) => {
  const { sessionId } = confirmDepositSchema.parse(request.body || {})
  let record = getDepositRecord(request.params.depositId)

  if (!stripe) {
    response.status(400).json({ error: 'Stripe checkout is not configured for this deposit.' })
    return
  }

  const stripeSessionId = sessionId || record?.stripeSessionId || ''
  if (!stripeSessionId) {
    response.status(400).json({ error: 'Stripe session is required for this deposit.' })
    return
  }

  const session = await stripe.checkout.sessions.retrieve(stripeSessionId)
  record =
    record ||
    getDepositByStripeSessionId(session.id) ||
    restoreDepositFromStripeSession(session, request.params.depositId)

  if (!record) {
    response.status(404).json({ error: 'Deposit not found.' })
    return
  }

  if (record.status === 'completed') {
    response.json({
      ok: true,
      deposit: record,
      message: 'Card payment already confirmed and deposited on Arc.',
    })
    return
  }

  if (sessionId && record.stripeSessionId && sessionId !== record.stripeSessionId) {
    response.status(400).json({ error: 'Stripe session mismatch for this deposit.' })
    return
  }

  if (!isStripePaymentComplete(session)) {
    response.status(409).json({ error: 'Stripe checkout has not completed yet.' })
    return
  }

  try {
    const depositResult = await sponsorCardDeposit(record)
    const completed = updateDeposit(record.id, {
      status: 'completed',
      stripeSessionId: session.id,
      arcDepositHash: depositResult.depositHash,
      arcApprovalHash: depositResult.approvalHash,
      confirmedAt: new Date().toISOString(),
    })

    response.json({
      ok: true,
      deposit: completed,
      message: 'Card payment confirmed. Atlas sponsored the Arc premium deposit successfully.',
    })
  } catch (error) {
    const paymentReceived = updateDeposit(record.id, {
      status: 'payment_received',
      stripeSessionId: session.id,
      relayMessage: error.message,
    })

    response.status(409).json({
      error: error.message,
      deposit: paymentReceived,
    })
  }
})

app.post('/api/claims', async (request, response) => {
  const payload = claimSchema.parse(request.body)
  const latestLocalDeposit = getLatestCompletedDepositByWallet(payload.walletAddress)
  let historicalPremiumUsdc = Number(latestLocalDeposit?.amountUsdc || 0)
  let latestPremiumDeposit = latestLocalDeposit

  if (!latestLocalDeposit) {
    try {
      const arcOverview = await readArcOverview(payload.walletAddress)
      historicalPremiumUsdc = formatUsdc(arcOverview.memberPremium || 0n)
      latestPremiumDeposit =
        historicalPremiumUsdc > 0
          ? await readLatestPremiumDepositByMember(payload.walletAddress)
          : null
    } catch (error) {
      if (isArcRpcLimitError(error)) {
        response.status(503).json({
          error: getPublicErrorMessage(error),
        })
        return
      }

      throw error
    }
  }

  const coverage = buildCoverageState({
    latestDeposit: latestPremiumDeposit,
    fallbackPremiumUsdc: historicalPremiumUsdc,
  })
  assertCoverageActive(coverage)

  const externalReference = `atlas-claim-${Date.now()}`
  const evidenceUrls = payload.evidenceUrls.slice(0, 2)
  const evidenceUri = evidenceUrls[0]
  const evidenceManifest = JSON.stringify({
    urls: evidenceUrls,
    files: payload.files,
    renderPattern: 'gl.nondet.web.render',
  })

  const claimRecord = createClaimRecord({
    walletAddress: payload.walletAddress,
    category: payload.category,
    description: payload.description,
    files: payload.files,
    evidenceUrls,
    requestedAmount: payload.requestedAmount,
    requestedAmountUsdc: payload.requestedAmount,
    payoutAmountUsdc: 0,
    externalReference,
    evidenceUri,
    reason: 'Claim received. Waiting for StudioNet jury.',
  })

  try {
    const arcClaim = await submitClaimOnArc({
      walletAddress: payload.walletAddress,
      category: payload.category,
      evidenceUri,
      description: payload.description,
      requestedAmountUsdc: payload.requestedAmount,
      externalReference,
    })

    updateClaimRecord(claimRecord.id, {
      arcClaimId: arcClaim.claimId,
      arcClaimHash: arcClaim.claimHash,
      status: 'queued',
      reason: 'Claim registered on Arc. Queueing the StudioNet jury.',
    })

    const juryReference = `studionet:claim-${arcClaim.claimId}`
    await queueClaimOnArc({
      claimId: arcClaim.claimId,
      juryReference,
    })

    updateClaimRecord(claimRecord.id, {
      status: 'deliberating',
      juryReference,
      reason: 'StudioNet jury is reviewing the evidence package.',
    })

    const verdictResult = await evaluateClaimOnGenlayer({
      claimKey: String(arcClaim.claimId),
      category: payload.category,
      description: payload.description,
      evidenceUri,
      evidenceManifest,
      requestedAmountMicroUsdc: Number(arcClaim.requestedAmount),
    })

    const approved = Boolean(verdictResult.verdict.approved)
    const payoutAmountUsdc = Number(verdictResult.verdict.payout_amount || 0) / 1_000_000
    const verdictUri = `studionet://${verdictResult.contractAddress}/${arcClaim.claimId}`

    await resolveClaimOnArc({
      claimId: arcClaim.claimId,
      approved,
      payoutAmountUsdc,
      verdictUri,
      juryReference: verdictResult.verdict.jury_reference,
    })

    const finalClaim = updateClaimRecord(claimRecord.id, {
      status: approved ? 'paid' : 'rejected',
      approved,
      payoutAmountUsdc,
      verdictUri,
      juryReference: verdictResult.verdict.jury_reference,
      genlayerHash: verdictResult.hash,
      reason: verdictResult.verdict.summary,
    })

    response.json({
      ok: true,
      claim: finalClaim,
    })
  } catch (error) {
    const failed = updateClaimRecord(claimRecord.id, {
      status: 'submitted',
      reason: getPublicErrorMessage(error),
    })

    response.json({
      ok: true,
      claim: failed,
    })
  }
})

app.get('/api/claims/:claimId', async (request, response) => {
  const claim = getClaimRecord(request.params.claimId)

  if (!claim) {
    response.status(404).json({ error: 'Claim not found.' })
    return
  }

  response.json({
    ok: true,
    claim,
  })
})

function humanizeClaimStatus(claim) {
  if (claim.status === 'paid' || claim.approved) {
    return 'Approved'
  }
  if (claim.status === 'rejected') {
    return 'Rejected'
  }
  if (claim.status === 'deliberating' || claim.status === 'queued') {
    return 'Pending'
  }
  return 'Pending'
}

app.use((error, _request, response, next) => {
  void next
  const status =
    error?.name === 'ZodError'
      ? 400
      : isArcRpcLimitError(error)
        ? 503
      : Number(error?.statusCode || error?.status || 500)

  response.status(Number.isFinite(status) ? status : 500).json({
    error: getPublicErrorMessage(error),
  })
})

export default app
