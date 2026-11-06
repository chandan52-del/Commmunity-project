import { Router } from 'express'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { validateBody } from '../middleware/validate.js'
import * as svc from '../services/maintenance.js'

const router = Router()
router.use(requireAuth, requireRole('admin'))

const idParam = (req, res) => {
  const id = Number(req.params.id)
  if (!Number.isInteger(id) || id < 1) {
    res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid maintenance id', details: [{ field: 'id', message: 'id must be a positive integer' }] } })
    return null
  }
  return id
}

router.get('/', async (req, res, next) => {
  try {
    res.json(await svc.listMaintenance(req.query))
  } catch (err) { next(err) }
})

router.post('/', validateBody({
  hall_id: { required: true, type: 'integer' },
  title: { required: true, type: 'string', minLength: 2, maxLength: 160 },
  reason: { type: 'string', maxLength: 2000 },
  start_at: { required: true, type: 'string' },
  end_at: { required: true, type: 'string' },
  status: { type: 'string' },
}), async (req, res, next) => {
  try {
    res.status(201).json({ data: await svc.createMaintenance(req.user.id, req.body) })
  } catch (err) { next(err) }
})

router.patch('/:id', validateBody({
  hall_id: { type: 'integer' },
  title: { type: 'string', minLength: 2, maxLength: 160 },
  reason: { type: 'string', maxLength: 2000 },
  start_at: { type: 'string' },
  end_at: { type: 'string' },
  status: { type: 'string' },
}), async (req, res, next) => {
  try {
    const id = idParam(req, res)
    if (id === null) return
    res.json({ data: await svc.updateMaintenance(id, req.body) })
  } catch (err) { next(err) }
})

router.delete('/:id', async (req, res, next) => {
  try {
    const id = idParam(req, res)
    if (id === null) return
    await svc.cancelMaintenance(id)
    res.status(204).end()
  } catch (err) { next(err) }
})

export default router
