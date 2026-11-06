const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5000/api'

// Access token lives in memory only — never localStorage/sessionStorage.
// The refresh token is an HttpOnly cookie handled entirely by the backend.
let accessToken = null
const tokenListeners = new Set()

export function getAccessToken() {
  return accessToken
}

export function setAccessToken(token) {
  accessToken = token
  tokenListeners.forEach((fn) => fn(token))
}

export function clearAccessToken() {
  accessToken = null
  tokenListeners.forEach((fn) => fn(null))
}

export function subscribeAccessToken(fn) {
  tokenListeners.add(fn)
  return () => tokenListeners.delete(fn)
}

export class ApiError extends Error {
  constructor(status, code, message, details) {
    super(message)
    this.status = status
    this.code = code
    this.details = details
  }
}

// Single shared refresh — simultaneous 401s wait on the same promise.
let refreshPromise = null

function refreshAccessToken() {
  if (!refreshPromise) {
    refreshPromise = fetch(`${API_BASE_URL}/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
    })
      .then(async (res) => {
        if (!res.ok) throw new ApiError(res.status, 'UNAUTHORIZED', 'Session expired')
        const payload = await res.json().catch(() => null)
        const token = payload?.data?.access_token
        if (!token) throw new ApiError(res.status, 'UNAUTHORIZED', 'Session expired')
        setAccessToken(token)
        return token
      })
      .catch((err) => {
        clearAccessToken()
        throw err
      })
      .finally(() => {
        refreshPromise = null
      })
  }
  return refreshPromise
}

async function parseResponse(res) {
  if (res.status === 204) return null
  const text = await res.text()
  if (!text) return null
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

export async function apiRequest(path, { method = 'GET', body, auth = true, headers, ...rest } = {}) {
  const doFetch = () =>
    fetch(`${API_BASE_URL}${path}`, {
      method,
      credentials: 'include',
      headers: {
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(auth && accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        ...(headers ?? {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      ...rest,
    })

  let res = await doFetch()

  // One silent refresh + retry for expired access tokens. Auth endpoints
  // (login/register/refresh/logout) never trigger this path.
  if (res.status === 401 && auth && !path.startsWith('/auth/')) {
    try {
      await refreshAccessToken()
      res = await doFetch()
    } catch {
      clearAccessToken()
    }
  }

  const payload = await parseResponse(res)
  if (!res.ok) {
    const err = payload?.error
    throw new ApiError(
      res.status,
      err?.code ?? 'REQUEST_FAILED',
      err?.message ?? 'Request failed',
      err?.details,
    )
  }
  return payload
}
