import {
  startTransition,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { usePrivy, useToken, useWallets } from '@privy-io/react-auth'
import { useExportWallet } from '@privy-io/react-auth'
import {
  confirmCardDepositSession,
  createCardDepositSession,
  getAtlasConfig,
  getAtlasOverview,
  getClaimStatus,
  registerWalletDeposit,
  submitClaimToAtlas,
} from './atlasApi'
import { ensureArcWalletNetwork } from './atlasNetwork'
import { depositPremiumWithWallet } from './atlasWallet'
import { ARC_TESTNET_USDC_ADDRESS } from '../../shared/atlasNetworks'
import { AtlasAppContext } from './atlasAppContextBase.js'

const pendingStatuses = new Set(['submitted', 'queued', 'deliberating', 'pending'])

function wait(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms))
}

function shortenAddress(value) {
  if (!value || value.length < 10) {
    return value || 'Wallet unavailable'
  }

  return `${value.slice(0, 6)}...${value.slice(-4)}`
}

function normalizeClaimStatus(status) {
  if (!status) {
    return 'submitted'
  }

  const normalized = String(status).trim().toLowerCase()

  if (normalized === 'paid' || normalized === 'approved') {
    return 'approved'
  }

  if (normalized === 'rejected') {
    return 'reviewed'
  }

  return normalized
}

function inferDisplayName(user, walletAddress) {
  const linkedAccounts = Array.isArray(user?.linkedAccounts) ? user.linkedAccounts : []
  const emailAccount = linkedAccounts.find((account) => account.type === 'email')
  const googleAccount = linkedAccounts.find((account) => account.type === 'google_oauth')

  if (emailAccount?.address) {
    return emailAccount.address.split('@')[0]
  }

  if (googleAccount?.email) {
    return googleAccount.email.split('@')[0]
  }

  if (walletAddress) {
    return `Member ${walletAddress.slice(2, 6).toUpperCase()}`
  }

  return 'Guest member'
}

function buildEmptyOverview(walletAddress = '') {
  return {
    network: {
      arc: 'Arc Testnet',
      genlayer: 'GenLayer StudioNet',
    },
    member: {
      displayName: inferDisplayName(null, walletAddress),
      walletAddress,
      walletDisplay: shortenAddress(walletAddress),
      monthlyPremiumUsdc: 0,
      renewsInDays: 0,
      isCoverageActive: false,
      canFileClaim: false,
      coverageActivatedAt: '',
      coverageExpiresAt: '',
      lastPremiumPaidAt: '',
      totalPaidToYouUsdc: 0,
      activeClaims: 0,
      approvedClaims: 0,
      pendingClaims: 0,
      payoutWallet: walletAddress || 'Embedded wallet pending',
    },
    pool: {
      poolSizeUsdc: 0,
      claimsPaid: 0,
      activeMembers: 0,
      protocolFeeCollectedUsdc: 0,
      reserveBufferUsdc: 0,
      reserveCoverageRatio: 0,
      treasuryBalanceUsdc: 0,
    },
    recentClaims: [],
    recentActivity: [],
    poolComposition: [],
  }
}

function mergeOverview(base, incoming) {
  if (!incoming || typeof incoming !== 'object') {
    return base
  }

  return {
    ...base,
    ...incoming,
    member: {
      ...base.member,
      ...(incoming.member || {}),
    },
    pool: {
      ...base.pool,
      ...(incoming.pool || {}),
    },
    signal: {
      ...(base.signal || {}),
      ...(incoming.signal || {}),
    },
    recentClaims:
      Array.isArray(incoming.recentClaims)
        ? incoming.recentClaims
        : base.recentClaims,
    recentActivity:
      Array.isArray(incoming.recentActivity) ? incoming.recentActivity : base.recentActivity,
    poolComposition:
      Array.isArray(incoming.poolComposition) ? incoming.poolComposition : base.poolComposition,
  }
}

export function AtlasDemoAppProvider({
  children,
  initialStatusMessage = '',
  initialError = '',
}) {
  const [atlasConfig, setAtlasConfig] = useState(null)
  const [overview, setOverview] = useState(() => buildEmptyOverview(''))
  const [busyAction, setBusyAction] = useState('')
  const [statusMessage, setStatusMessage] = useState(
    initialStatusMessage ||
      'Privy is not configured yet. Atlas is read-only until live credentials are added.',
  )
  const [lastError, setLastError] = useState(initialError)

  const loadOverview = useCallback(async () => {
    const empty = buildEmptyOverview('')

    try {
      const payload = await getAtlasOverview({ walletAddress: '', accessToken: null })
      return mergeOverview(empty, payload)
    } catch {
      return empty
    }
  }, [])

  const refreshOverview = useCallback(async () => {
    const nextOverview = await loadOverview()
    setOverview(nextOverview)
    return nextOverview
  }, [loadOverview])

  useEffect(() => {
    let cancelled = false

    async function loadConfig() {
      try {
        const payload = await getAtlasConfig(null)
        if (!cancelled) {
          setAtlasConfig(payload)
        }
      } catch {
        if (!cancelled) {
          setAtlasConfig(null)
        }
      }
    }

    loadConfig()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    async function syncOverview() {
      const nextOverview = await loadOverview()
      if (!cancelled) {
        setOverview(nextOverview)
      }
    }

    void syncOverview()

    return () => {
      cancelled = true
    }
  }, [loadOverview])

  const login = useCallback(() => {
    setLastError(initialError)
    setStatusMessage(
      'Add your Privy keys to enable sign-in and live Atlas transactions.',
    )
  }, [initialError])

  const loginWithGoogle = useCallback(() => {
    login()
  }, [login])

  const loginWithWallet = useCallback(() => {
    login()
  }, [login])

  const logout = useCallback(async () => {
    setLastError(initialError)
    startTransition(() => {
      setOverview(buildEmptyOverview(''))
      setStatusMessage(
        initialStatusMessage ||
          'Atlas is read-only while live auth is disabled.',
      )
    })
  }, [initialError, initialStatusMessage])

  const startCardDeposit = useCallback(async (plan) => {
    setBusyAction(`card:${plan.title}`)
    setLastError(initialError)

    try {
      await wait(150)
      throw new Error(`Add Privy and Stripe config to enable live ${plan.title} card deposits.`)
    } finally {
      setBusyAction('')
    }
  }, [initialError])

  const confirmCardDeposit = useCallback(async ({ depositId }) => {
    setBusyAction(`card:confirm:${depositId}`)
    setLastError(initialError)

    try {
      await wait(150)
      throw new Error(`Stripe confirmation is unavailable until live Atlas payment config is added for deposit ${depositId}.`)
    } finally {
      setBusyAction('')
    }
  }, [initialError])

  const startWalletDeposit = useCallback(async (plan) => {
    setBusyAction(`wallet:${plan.title}`)
    setLastError(initialError)

    try {
      await wait(150)
      throw new Error(`Add Privy and Arc wallet config to enable live ${plan.title} wallet deposits.`)
    } finally {
      setBusyAction('')
    }
  }, [initialError])

  const submitClaim = useCallback(async () => {
    setBusyAction('claim')
    setLastError(initialError)

    try {
      await wait(150)
      throw new Error('Live claim submission is unavailable until Privy, Arc, and GenLayer are configured.')
    } finally {
      setBusyAction('')
    }
  }, [initialError])

  const value = useMemo(
    () => ({
      activeWallet: null,
      atlasConfig,
      authenticated: false,
      busyAction,
      lastError,
      login,
      loginWithGoogle,
      loginWithWallet,
      logout,
      memberLabel: overview.member.displayName,
      overview,
      privyReady: false,
      refreshOverview,
      confirmCardDeposit,
      startCardDeposit,
      startWalletDeposit,
      statusMessage,
      submitClaim,
      walletAddress: '',
    }),
    [
      atlasConfig,
      busyAction,
      lastError,
      login,
      loginWithGoogle,
      loginWithWallet,
      logout,
      overview,
      refreshOverview,
      confirmCardDeposit,
      startCardDeposit,
      startWalletDeposit,
      statusMessage,
      submitClaim,
    ],
  )

  return <AtlasAppContext.Provider value={value}>{children}</AtlasAppContext.Provider>
}

export function AtlasAppProvider({ children }) {
  const privy = usePrivy()
  const { wallets } = useWallets()
  const { getAccessToken } = useToken()
  const { exportWallet } = useExportWallet()

  const [atlasConfig, setAtlasConfig] = useState(null)
  const [overview, setOverview] = useState(() => buildEmptyOverview(''))
  const [busyAction, setBusyAction] = useState('')
  const [statusMessage, setStatusMessage] = useState('')
  const [lastError, setLastError] = useState('')

  const activeWallet = useMemo(
    () => wallets.find((wallet) => wallet.type === 'ethereum') || null,
    [wallets],
  )
  const walletAddress = activeWallet?.address || ''
  const authenticated = Boolean(privy.ready && privy.authenticated)
  const memberLabel = inferDisplayName(privy.user, walletAddress)
  const canExportEmbeddedWallet = Boolean(
    activeWallet?.walletClientType === 'privy' || activeWallet?.connectorType === 'embedded',
  )

  const readAccessToken = useCallback(async () => {
    try {
      return await getAccessToken()
    } catch {
      return null
    }
  }, [getAccessToken])

  const loadOverview = useCallback(async () => {
    const empty = buildEmptyOverview(walletAddress)

    try {
      const accessToken = await readAccessToken()
      const payload = await getAtlasOverview({ walletAddress, accessToken })
      return {
        nextOverview: mergeOverview(empty, payload),
        errorMessage: '',
      }
    } catch (error) {
      return {
        nextOverview: empty,
        errorMessage: error.message,
      }
    }
  }, [readAccessToken, walletAddress])

  const refreshOverview = useCallback(async () => {
    const { nextOverview, errorMessage } = await loadOverview()
    setOverview(nextOverview)
    setLastError(errorMessage)
    return nextOverview
  }, [loadOverview])

  useEffect(() => {
    let cancelled = false

    async function loadConfig() {
      try {
        const accessToken = await readAccessToken()
        const payload = await getAtlasConfig(accessToken)
        if (!cancelled) {
          setAtlasConfig(payload)
        }
      } catch {
        if (!cancelled) {
          setAtlasConfig(null)
        }
      }
    }

    loadConfig()
    return () => {
      cancelled = true
    }
  }, [privy.ready, readAccessToken])

  useEffect(() => {
    if (!privy.ready) {
      return
    }

    let cancelled = false

    async function syncOverview() {
      const { nextOverview, errorMessage } = await loadOverview()
      if (cancelled) {
        return
      }

      setOverview(nextOverview)
      setLastError(errorMessage)
    }

    void syncOverview()

    return () => {
      cancelled = true
    }
  }, [loadOverview, privy.authenticated, privy.ready, walletAddress])

  useEffect(() => {
    if (!authenticated || !activeWallet) {
      return
    }

    if (activeWallet.walletClientType === 'privy' || activeWallet.connectorType === 'embedded') {
      return
    }

    ensureArcWalletNetwork(activeWallet).catch((error) => {
      setLastError(error.message)
    })
  }, [
    activeWallet,
    authenticated,
    activeWallet?.address,
    activeWallet?.walletClientType,
    activeWallet?.connectorType,
  ])

  const login = useCallback(async () => {
    setLastError('')
    privy.login({ loginMethods: ['google', 'wallet'] })
  }, [privy])

  const loginWithGoogle = useCallback(async () => {
    setLastError('')
    privy.login({ loginMethods: ['google'] })
  }, [privy])

  const loginWithWallet = useCallback(async () => {
    setLastError('')
    privy.login({ loginMethods: ['wallet'] })
  }, [privy])

  const logout = useCallback(async () => {
    setLastError('')
    setStatusMessage('')
    await privy.logout()
    startTransition(() => {
      setOverview(buildEmptyOverview(''))
    })
  }, [privy])

  const exportEmbeddedWallet = useCallback(async () => {
    if (!activeWallet?.address) {
      throw new Error('No Atlas wallet is available to export yet.')
    }

    await exportWallet({ address: activeWallet.address })
  }, [activeWallet, exportWallet])

  const startCardDeposit = useCallback(async (plan) => {
    setBusyAction(`card:${plan.title}`)
    setLastError('')

    try {
      if (!authenticated || !walletAddress) {
        login()
        return null
      }

      const accessToken = await readAccessToken()
      const payload = await createCardDepositSession({
        accessToken,
        walletAddress,
        planTitle: plan.title,
        amountUsdc: plan.monthly,
      })

      setStatusMessage(payload.message || 'Test-mode card deposit queued for Arc.')
      await refreshOverview()
      return payload
    } catch (error) {
      setLastError(error.message)
      throw error
    } finally {
      setBusyAction('')
    }
  }, [authenticated, login, readAccessToken, refreshOverview, walletAddress])

  const confirmCardDeposit = useCallback(async ({ depositId, sessionId }) => {
    setBusyAction(`card:confirm:${depositId}`)
    setLastError('')

    try {
      const accessToken = await readAccessToken()
      const payload = await confirmCardDepositSession({
        accessToken,
        depositId,
        sessionId,
      })

      setStatusMessage(payload.message || 'Card payment confirmed and queued on Arc.')
      await refreshOverview()
      return payload
    } catch (error) {
      setLastError(error.message)
      throw error
    } finally {
      setBusyAction('')
    }
  }, [readAccessToken, refreshOverview])

  const startWalletDeposit = useCallback(async (plan) => {
    setBusyAction(`wallet:${plan.title}`)
    setLastError('')

    try {
      if (!activeWallet) {
        login()
        return null
      }

      await ensureArcWalletNetwork(activeWallet)

      const accessToken = await readAccessToken()
      let latestAtlasConfig = atlasConfig

      try {
        latestAtlasConfig = await getAtlasConfig(accessToken)
        setAtlasConfig(latestAtlasConfig)
      } catch {
        // Keep the latest in-memory config if the refresh request fails.
      }

      const poolAddress =
        latestAtlasConfig?.arc?.poolAddress ||
        atlasConfig?.arc?.poolAddress ||
        import.meta.env.VITE_ATLAS_POOL_ADDRESS ||
        ''
      const usdcAddress =
        latestAtlasConfig?.arc?.usdcAddress ||
        atlasConfig?.arc?.usdcAddress ||
        import.meta.env.VITE_ARC_USDC_ADDRESS ||
        ARC_TESTNET_USDC_ADDRESS

      const payload = await depositPremiumWithWallet({
        wallet: activeWallet,
        poolAddress,
        usdcAddress,
        amountUsdc: plan.monthly,
      })

      let registrationMessage = ''

      try {
        const registration = await registerWalletDeposit({
          accessToken,
          walletAddress,
          planTitle: plan.title,
          amountUsdc: plan.monthly,
          depositHash: payload.depositHash,
          approvalHash: payload.approvalHash,
        })
        registrationMessage = registration?.message || ''
      } catch (error) {
        const refreshedOverview = await getAtlasOverview({
          walletAddress,
          accessToken,
        })
        setOverview(refreshedOverview)

        if (!refreshedOverview?.member?.isCoverageActive) {
          throw error
        }

        registrationMessage =
          'Premium reached Arc and coverage is now active. Atlas is still syncing the deposit record.'
      }

      setStatusMessage(
        registrationMessage ||
          `Premium submitted on Arc Testnet for ${plan.title}. Transaction ${payload.depositHash.slice(
            0,
            10,
          )}...`,
      )
      await refreshOverview()
      return payload
    } catch (error) {
      setLastError(error.message)
      throw error
    } finally {
      setBusyAction('')
    }
  }, [activeWallet, atlasConfig, login, readAccessToken, refreshOverview, walletAddress])

  const submitClaim = useCallback(async (claim) => {
    setBusyAction('claim')
    setLastError('')

    try {
      if (!authenticated) {
        login()
        throw new Error('Sign in before you submit a claim.')
      }

      const accessToken = await readAccessToken()
      const created = await submitClaimToAtlas({
        accessToken,
        claim: {
          walletAddress,
          ...claim,
        },
      })

      let currentClaim = created.claim
      let attempt = 0

      while (
        currentClaim &&
        pendingStatuses.has(normalizeClaimStatus(currentClaim.status)) &&
        attempt < 12
      ) {
        await wait(2500)
        const latest = await getClaimStatus({
          accessToken,
          claimId: currentClaim.id,
        })
        currentClaim = latest.claim
        attempt += 1
      }

      setStatusMessage(
        currentClaim?.approved
          ? 'Claim approved and payout queued on Arc.'
          : 'Claim review complete. Check the verdict panel for details.',
      )
      await refreshOverview()
      return currentClaim
    } catch (error) {
      setLastError(error.message)
      throw error
    } finally {
      setBusyAction('')
    }
  }, [authenticated, login, readAccessToken, refreshOverview, walletAddress])

  const value = useMemo(
    () => ({
      activeWallet,
      atlasConfig,
      authenticated,
      busyAction,
      lastError: lastError || privy.error?.message || '',
      login,
      loginWithGoogle,
      loginWithWallet,
      logout,
      memberLabel,
      overview: mergeOverview(buildEmptyOverview(walletAddress), {
        ...overview,
        member: {
          ...overview.member,
          displayName: memberLabel,
          walletAddress,
          walletDisplay: shortenAddress(walletAddress),
          payoutWallet: walletAddress || overview.member?.payoutWallet,
        },
      }),
      privyReady: privy.ready,
      refreshOverview,
      confirmCardDeposit,
      startCardDeposit,
      startWalletDeposit,
      statusMessage,
      submitClaim,
      exportEmbeddedWallet: canExportEmbeddedWallet ? exportEmbeddedWallet : null,
      walletAddress,
    }),
    [
      activeWallet,
      atlasConfig,
      authenticated,
      busyAction,
      lastError,
      privy.error?.message,
      memberLabel,
      overview,
      login,
      loginWithGoogle,
      loginWithWallet,
      logout,
      privy.ready,
      refreshOverview,
      confirmCardDeposit,
      startCardDeposit,
      startWalletDeposit,
      statusMessage,
      submitClaim,
      canExportEmbeddedWallet,
      exportEmbeddedWallet,
      walletAddress,
    ],
  )

  return <AtlasAppContext.Provider value={value}>{children}</AtlasAppContext.Provider>
}
