import { privyClient } from './config.js'

export async function getAuthenticatedUser(request) {
  const authorization = request.headers.authorization || ''
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : ''

  if (!token || !privyClient) {
    return null
  }

  try {
    return await privyClient.utils().auth().verifyAccessToken(token)
  } catch {
    return null
  }
}
