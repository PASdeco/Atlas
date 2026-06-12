import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = dirname(fileURLToPath(import.meta.url))
const storeFilePath = process.env.VERCEL
  ? '/tmp/atlas-store.json'
  : resolve(currentDir, '..', 'data', 'atlas-store.json')
let persistenceAvailable = true

function normalizeAddress(value = '') {
  return String(value).toLowerCase()
}

function loadPersistedState() {
  try {
    const raw = JSON.parse(readFileSync(storeFilePath, 'utf8'))
    return {
      deposits: Array.isArray(raw?.deposits) ? raw.deposits : [],
      claims: Array.isArray(raw?.claims) ? raw.claims : [],
      nextDepositId: Number(raw?.nextDepositId) || 1,
      nextClaimId: Number(raw?.nextClaimId) || 1,
    }
  } catch {
    return {
      deposits: [],
      claims: [],
      nextDepositId: 1,
      nextClaimId: 1,
    }
  }
}

function persistState() {
  if (!persistenceAvailable) {
    return
  }

  mkdirSync(dirname(storeFilePath), { recursive: true })
  try {
    writeFileSync(
      storeFilePath,
      JSON.stringify(
        {
          nextDepositId,
          nextClaimId,
          deposits: Array.from(deposits.values()),
          claims: Array.from(claims.values()),
        },
        null,
        2,
      ),
      'utf8',
    )
  } catch {
    persistenceAvailable = false
  }
}

const persistedState = loadPersistedState()
const deposits = new Map(
  persistedState.deposits.map((deposit) => [Number(deposit.id), deposit]),
)
const claims = new Map(
  persistedState.claims.map((claim) => [Number(claim.id), claim]),
)

let nextDepositId = Math.max(
  persistedState.nextDepositId,
  ...Array.from(deposits.keys(), (id) => Number(id) + 1),
  1,
)
let nextClaimId = Math.max(
  persistedState.nextClaimId,
  ...Array.from(claims.keys(), (id) => Number(id) + 1),
  1,
)

export function createDeposit(record) {
  const id = nextDepositId++
  const deposit = {
    id,
    createdAt: new Date().toISOString(),
    status: 'queued',
    ...record,
  }

  deposits.set(id, deposit)
  persistState()
  return deposit
}

export function updateDeposit(id, patch) {
  const current = deposits.get(id)
  if (!current) {
    return null
  }

  const next = { ...current, ...patch, updatedAt: new Date().toISOString() }
  deposits.set(id, next)
  persistState()
  return next
}

export function getDepositRecord(id) {
  return deposits.get(Number(id)) || null
}

export function restoreDepositRecord(record) {
  const id = Number(record?.id)
  if (!Number.isInteger(id) || id <= 0) {
    return null
  }

  const deposit = {
    createdAt: new Date().toISOString(),
    status: 'queued',
    ...record,
    id,
  }

  deposits.set(id, deposit)
  nextDepositId = Math.max(nextDepositId, id + 1)
  persistState()
  return deposit
}

export function getDepositByArcHash(hash) {
  if (!hash) {
    return null
  }

  return (
    Array.from(deposits.values()).find(
      (deposit) =>
        String(deposit.arcDepositHash || '').toLowerCase() === String(hash).toLowerCase(),
    ) || null
  )
}

export function getDepositByStripeSessionId(sessionId) {
  if (!sessionId) {
    return null
  }

  return (
    Array.from(deposits.values()).find(
      (deposit) => String(deposit.stripeSessionId || '') === String(sessionId),
    ) || null
  )
}

export function listDepositsByWallet(walletAddress) {
  const normalizedWallet = normalizeAddress(walletAddress)
  return Array.from(deposits.values()).filter(
    (deposit) => normalizeAddress(deposit.walletAddress) === normalizedWallet,
  )
}

export function getLatestCompletedDepositByWallet(walletAddress) {
  const normalizedWallet = normalizeAddress(walletAddress)
  return Array.from(deposits.values())
    .filter(
      (deposit) =>
        normalizeAddress(deposit.walletAddress) === normalizedWallet &&
        deposit.status === 'completed',
    )
    .sort((left, right) => {
      const leftDate = new Date(left.confirmedAt || left.updatedAt || left.createdAt).getTime()
      const rightDate = new Date(right.confirmedAt || right.updatedAt || right.createdAt).getTime()
      return rightDate - leftDate
    })[0] || null
}

export function createClaimRecord(record) {
  const id = nextClaimId++
  const claim = {
    id,
    createdAt: new Date().toISOString(),
    status: 'submitted',
    approved: false,
    ...record,
  }

  claims.set(id, claim)
  persistState()
  return claim
}

export function updateClaimRecord(id, patch) {
  const current = claims.get(id)
  if (!current) {
    return null
  }

  const next = { ...current, ...patch, updatedAt: new Date().toISOString() }
  claims.set(id, next)
  persistState()
  return next
}

export function getClaimRecord(id) {
  return claims.get(Number(id)) || null
}

export function listClaimsByWallet(walletAddress) {
  const normalizedWallet = normalizeAddress(walletAddress)
  return Array.from(claims.values())
    .filter((claim) => normalizeAddress(claim.walletAddress) === normalizedWallet)
    .sort((left, right) => new Date(right.createdAt) - new Date(left.createdAt))
}
