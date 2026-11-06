import { Router } from 'express'
import { createHall, updateHall, deactivateHall } from '../services/halls.js'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { notFound } from '../middleware/errorHandler.js'

export const adminHallsRouter = Router()

adminHallsRouter.use(requireAuth, requireRole('admin'))

const idParam = (req, res, next) => {
  const id = Number(req.params.id)
  if (!Number.isInteger(id) || id < 1) return next(notFound('Hall not found'))
  req.hallId = id
  next()
}

adminHallsRouter.post('/', async (req, res, next) => {
  try {
    const hall = await createHall(req.body ?? {})
    res.status(201).json({ data: hall })
  } catch (err) {
    next(err)
  }
})

adminHallsRouter.patch('/:id', idParam, async (req, res, next) => {
  try {
    res.json({ data: await updateHall(req.hallId, req.body ?? {}) })
  } catch (err) {
    next(err)
  }
})

adminHallsRouter.delete('/:id', idParam, async (req, res, next) => {
  try {
    await deactivateHall(req.hallId)
    res.status(204).end()
  } catch (err) {
    next(err)
  }
})
