import { Router } from 'express'
import { requireAuth, requireRole } from '../middleware/auth.js'
import * as svc from '../services/reports.js'

const router = Router()
router.use(requireAuth, requireRole('admin'))

router.get('/dashboard', async (req, res, next) => {
  try {
    res.json({ data: await svc.getDashboard() })
  } catch (err) { next(err) }
})

router.get('/reports', async (req, res, next) => {
  try {
    res.json({ data: await svc.getReports(req.query) })
  } catch (err) { next(err) }
})

export default router
