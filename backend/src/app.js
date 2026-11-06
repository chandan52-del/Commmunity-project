import express from 'express'
import cookieParser from 'cookie-parser'
import { authRouter } from './routes/auth.js'
import { notFoundHandler, errorHandler } from './middleware/errorHandler.js'

export function createApp() {
  const app = express()
  app.disable('x-powered-by')
  app.use(express.json({ limit: '100kb' }))
  app.use(cookieParser())

  app.get('/api/health', (req, res) => res.json({ data: { status: 'ok' } }))
  app.use('/api/auth', authRouter)

  app.use(notFoundHandler)
  app.use(errorHandler)
  return app
}
