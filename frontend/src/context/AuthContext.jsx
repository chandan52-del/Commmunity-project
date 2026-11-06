import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { apiRequest, setAccessToken, clearAccessToken, subscribeAccessToken } from '../services/api'

const AuthContext = createContext(null)

// status: 'loading' | 'authenticated' | 'guest'
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [status, setStatus] = useState('loading')

  // Restore session on mount: the HttpOnly refresh cookie lets apiRequest
  // obtain a fresh access token via /auth/refresh, then /auth/me identifies
  // the user. No token or cookie → guest.
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await apiRequest('/auth/me')
        if (!cancelled && res?.data) {
          setUser(res.data)
          setStatus('authenticated')
        } else if (!cancelled) {
          setStatus('guest')
        }
      } catch {
        if (!cancelled) setStatus('guest')
      }
    })()
    return () => { cancelled = true }
  }, [])

  // Keep user state consistent if the token is cleared elsewhere.
  useEffect(() => subscribeAccessToken((token) => {
    if (token === null) {
      setUser(null)
      setStatus('guest')
    }
  }), [])

  const applyAuthPayload = useCallback((data) => {
    setAccessToken(data.access_token)
    setUser(data.user)
    setStatus('authenticated')
    return data.user
  }, [])

  const login = useCallback(async ({ email, password }) => {
    const res = await apiRequest('/auth/login', { method: 'POST', body: { email, password } })
    return applyAuthPayload(res.data)
  }, [applyAuthPayload])

  const register = useCallback(async ({ full_name, email, phone, password }) => {
    const res = await apiRequest('/auth/register', {
      method: 'POST',
      body: { full_name, email, phone, password },
    })
    return applyAuthPayload(res.data)
  }, [applyAuthPayload])

  const logout = useCallback(async () => {
    try {
      await apiRequest('/auth/logout', { method: 'POST' })
    } finally {
      clearAccessToken()
      setUser(null)
      setStatus('guest')
    }
  }, [])

  const value = useMemo(() => ({
    user,
    status,
    isAuthenticated: status === 'authenticated',
    isAdmin: user?.role === 'admin',
    login,
    register,
    logout,
  }), [user, status, login, register, logout])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
