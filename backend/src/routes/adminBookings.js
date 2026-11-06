import { Router } from 'express'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { validateBody } from '../middleware/validate.js'
import * as svc from '../services/bookings.js'

const router = Router()
router.use(requireAuth, requireRole('admin'))

router.get('/', async (req, res, next) => {
  try {
    res.json(await svc.adminListBookings(req.query))
  } catch (err) { next(err) }
})

router.patch('/:id/approve', validateBody({
  admin_notes: { type: 'string', maxLength: 2000 },
}), async (req, res, next) => {
  try {
    const id = Number(req.params.id)
    if (!Number.isInteger(id) || id < 1) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid booking id', details: [{ field: 'id', message: 'id must be a positive integer' }] } })
    }
    res.json({ data: await svc.transitionBooking(id, req.user.id, 'approve', req.body.admin_notes) })
  } catch (err) { next(err) }
})

router.patch('/:id/reject', validateBody({
  admin_notes: { required: true, type: 'string', minLength: 1, maxLength: 2000 },
}), async (req, res, next) => {
  try {
    const id = Number(req.params.id)
    if (!Number.isInteger(id) || id < 1) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid booking id', details: [{ field: 'id', message: 'id must be a positive integer' }] } })
    }
    res.json({ data: await svc.transitionBooking(id, req.user.id, 'reject', req.body.admin_notes) })
  } catch (err) { next(err) }
})

export default router
