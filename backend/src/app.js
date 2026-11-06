import express from 'express'
import cookieParser from 'cookie-parser'
import { authRouter } from './routes/auth.js'
import { hallsRouter } from './routes/halls.js'
import { adminHallsRouter } from './routes/adminHalls.js'
import bookingsRouter from './routes/bookings.js'
import adminBookingsRouter from './routes/adminBookings.js'
import adminMaintenanceRouter from './routes/adminMaintenance.js'
import { notFoundHandler, errorHandler } from './middleware/errorHandler.js'

export function createApp() {
  const app = express()
  app.disable('x-powered-by')
  app.use(express.json({ limit: '100kb' }))
  app.use(cookieParser())

  app.get('/api/health', (req, res) => res.json({ data: { status: 'ok' } }))
  app.use('/api/auth', authRouter)
  app.use('/api/halls', hallsRouter)
  app.use('/api/admin/halls', adminHallsRouter)
  app.use('/api/bookings', bookingsRouter)
  app.use('/api/admin/bookings', adminBookingsRouter)
  app.use('/api/admin/maintenance', adminMaintenanceRouter)

  app.use(notFoundHandler)
  app.use(errorHandler)
  return app
}
