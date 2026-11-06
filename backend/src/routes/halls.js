import { Router } from 'express'
import { listHalls, getHallDetail, getAvailability } from '../services/halls.js'
import { badRequest } from '../middleware/errorHandler.js'

export const hallsRouter = Router()

function intQuery(value, { min, max, field }) {
  if (value === undefined || value === '') return undefined
  const n = Number(value)
  if (!Number.isInteger(n) || n < min || (max !== undefined && n > max)) {
    throw badRequest('Request validation failed', [
      { field, message: `${field} must be an integer between ${min} and ${max ?? '∞'}` },
    ])
  }
  return n
}

function parseListQuery(query) {
  const allowedSorts = ['name', '-name', 'capacity', '-capacity', 'base_price', '-base_price', 'created_at', '-created_at']
  const sort = query.sort ?? 'name'
  if (!allowedSorts.includes(sort)) {
    throw badRequest('Request validation failed', [{ field: 'sort', message: `sort must be one of: ${allowedSorts.join(', ')}` }])
  }
  return {
    page: intQuery(query.page, { min: 1, field: 'page' }) ?? 1,
    pageSize: intQuery(query.page_size, { min: 1, max: 100, field: 'page_size' }) ?? 20,
    search: typeof query.search === 'string' && query.search.trim() ? query.search.trim().slice(0, 120) : undefined,
    location: typeof query.location === 'string' && query.location.trim() ? query.location.trim().slice(0, 255) : undefined,
    minCapacity: intQuery(query.min_capacity, { min: 1, field: 'min_capacity' }),
    maxCapacity: intQuery(query.max_capacity, { min: 1, field: 'max_capacity' }),
    sort,
  }
}

hallsRouter.get('/', async (req, res, next) => {
  try {
    res.json(await listHalls(parseListQuery(req.query)))
  } catch (err) {
    next(err)
  }
})

hallsRouter.get('/:id', async (req, res, next) => {
  try {
    res.json({ data: await getHallDetail(req.params.id) })
  } catch (err) {
    next(err)
  }
})

hallsRouter.get('/:id/availability', async (req, res, next) => {
  try {
    const from = new Date(req.query.from)
    const to = new Date(req.query.to)
    if (!req.query.from || !req.query.to || Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
      throw badRequest('Request validation failed', [
        { field: 'from/to', message: 'from and to are required ISO 8601 datetimes' },
      ])
    }
    if (to <= from) {
      throw badRequest('Request validation failed', [{ field: 'to', message: 'to must be after from' }])
    }
    if (to - from > 366 * 24 * 60 * 60 * 1000) {
      throw badRequest('Request validation failed', [{ field: 'to', message: 'date range must not exceed 366 days' }])
    }
    res.json({ data: await getAvailability(req.params.id, from, to) })
  } catch (err) {
    next(err)
  }
})
