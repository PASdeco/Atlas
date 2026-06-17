// Atlas runs behind the same origin both on Vercel and through the local Vite proxy.
export const atlasApiBaseUrl = ''

function wait(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms))
}

async function atlasRequest(path, { method = 'GET', accessToken, headers, body } = {}) {
  const requestHeaders = {
    ...(body ? { 'Content-Type': 'application/json' } : {}),
    ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    ...headers,
  }

  let response
  let fetchError

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      response = await fetch(`${atlasApiBaseUrl}${path}`, {
        method,
        headers: requestHeaders,
        body: body ? JSON.stringify(body) : undefined,
      })
      fetchError = null
      break
    } catch (error) {
      fetchError = error

      if (attempt < 2) {
        await wait(350 * (attempt + 1))
      }
    }
  }

  if (!response) {
    throw fetchError || new Error('Failed to fetch')
  }

  const contentType = response.headers.get('content-type') || ''
  const payload = contentType.includes('application/json')
    ? await response.json()
    : await response.text()

  if (!response.ok) {
    let message =
      typeof payload === 'string'
        ? payload
        : payload?.error || payload?.message || 'Atlas request failed.'

    if (typeof message === 'string' && /<!doctype html>|<html|<body|<pre>/i.test(message)) {
      message = 'Atlas could not refresh live chain data right now. Please retry in a moment.'
    }

    throw new Error(message)
  }

  return payload
}

export function getAtlasConfig(accessToken) {
  return atlasRequest('/api/config', { accessToken })
}

export function getAtlasOverview({ walletAddress, accessToken }) {
  const query = walletAddress ? `?wallet=${encodeURIComponent(walletAddress)}` : ''
  return atlasRequest(`/api/overview${query}`, { accessToken })
}

export function createCardDepositSession({ accessToken, walletAddress, planTitle, amountUsdc }) {
  return atlasRequest('/api/deposits/card', {
    method: 'POST',
    accessToken,
    body: {
      walletAddress,
      planTitle,
      amountUsdc,
    },
  })
}

export function registerWalletDeposit({
  accessToken,
  walletAddress,
  planTitle,
  amountUsdc,
  depositHash,
  approvalHash,
}) {
  return atlasRequest('/api/deposits/wallet', {
    method: 'POST',
    accessToken,
    body: {
      walletAddress,
      planTitle,
      amountUsdc,
      depositHash,
      approvalHash,
    },
  })
}

export function confirmCardDepositSession({ accessToken, depositId, sessionId }) {
  return atlasRequest(`/api/deposits/card/${depositId}/confirm`, {
    method: 'POST',
    accessToken,
    body: { sessionId },
  })
}

export function submitClaimToAtlas({ accessToken, claim }) {
  return atlasRequest('/api/claims', {
    method: 'POST',
    accessToken,
    body: claim,
  })
}

export function getClaimStatus({ accessToken, claimId }) {
  return atlasRequest(`/api/claims/${claimId}`, { accessToken })
}
