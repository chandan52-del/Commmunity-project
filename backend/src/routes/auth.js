import { Router } from 'express'
import { register, login, refresh, logout, getMe } from '../services/authService.js'
import { validateBody } from '../middleware/validate.js'
import { requireAuth } from '../middleware/auth.js'
import { refreshCookieOptions } from '../services/authService.js'

export const authRouter = Router()

const registerRules = {
  full_name: { required: true, minLength: 2, maxLength: 120 },
  email: { required: true, type: 'email', maxLength: 255 },
  phone: { maxLength: 32 },
  password: { required: true, minLength: 8, maxLength: 128 },
}

const loginRules = {
  email: { required: true, type: 'email' },
  password: { required: true },
}

authRouter.post('/register', validateBody(registerRules), async (req, res, next) => {
  try {
    const { payload, refreshToken } = await register(req.body)
    res.cookie('refresh_token', refreshToken, refreshCookieOptions)
    res.status(201).json({ data: payload })
  } catch (err) {
    next(err)
  }
})

authRouter.post('/login', validateBody(loginRules), async (req, res, next) => {
  try {
    const { payload, refreshToken } = await login(req.body)
    res.cookie('refresh_token', refreshToken, refreshCookieOptions)
    res.json({ data: payload })
  } catch (err) {
    next(err)
  }
})

authRouter.post('/refresh', async (req, res, next) => {
  try {
    const { payload, refreshToken } = await refresh(req.cookies?.refresh_token)
    res.cookie('refresh_token', refreshToken, refreshCookieOptions)
    res.json({
      data: {
        access_token: payload.access_token,
        token_type: payload.token_type,
        expires_in: payload.expires_in,
      },
    })
  } catch (err) {
    next(err)
  }
})

authRouter.post('/logout', async (req, res, next) => {
  try {
    await logout(req.cookies?.refresh_token)
    res.clearCookie('refresh_token', { ...refreshCookieOptions, maxAge: 0 })
    res.status(204).end()
  } catch (err) {
    next(err)
  }
})

authRouter.get('/me', requireAuth, async (req, res, next) => {
  try {
    res.json({ data: await getMe(req.user.id) })
  } catch (err) {
    next(err)
  }
})
