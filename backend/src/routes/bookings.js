import { Router } from 'express'
import { requireAuth } from '../middleware/auth.js'
import { validateBody } from '../middleware/validate.js'
import * as svc from '../services/bookings.js'

const router = Router()
router.use(requireAuth)

router.post('/', validateBody({
  hall_id: { required: true, type: 'integer' },
  event_name: { required: true, type: 'string', minLength: 2, maxLength: 160 },
  event_type: { required: true, type: 'string', minLength: 2, maxLength: 64 },
  start_at: { required: true, type: 'string' },
  end_at: { required: true, type: 'string' },
  guest_count: { type: 'integer' },
  customer_notes: { type: 'string', maxLength: 2000 },
}), async (req, res, next) => {
  try {
    const booking = await svc.createBooking(req.user.id, req.body)
    res.status(201).json({ data: booking })
  } catch (err) { next(err) }
})

router.get('/', async (req, res, next) => {
  try {
    res.json(await svc.listBookings(req.user, req.query))
  } catch (err) { next(err) }
})

router.get('/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id)
    if (!Number.isInteger(id) || id < 1) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid booking id', details: [{ field: 'id', message: 'id must be a positive integer' }] } })
    }
    res.json({ data: await svc.getBookingForUser(id, req.user) })
  } catch (err) { next(err) }
})

router.patch('/:id/cancel', validateBody({
  reason: { type: 'string', maxLength: 500 },
}), async (req, res, next) => {
  try {
    const id = Number(req.params.id)
    if (!Number.isInteger(id) || id < 1) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid booking id', details: [{ field: 'id', message: 'id must be a positive integer' }] } })
    }
    res.json({ data: await svc.cancelBooking(id, req.user, req.body.reason) })
  } catch (err) { next(err) }
})

export default router
