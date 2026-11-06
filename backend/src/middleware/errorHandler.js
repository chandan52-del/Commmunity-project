export class HttpError extends Error {
  constructor(status, code, message, details) {
    super(message)
    this.status = status
    this.code = code
    this.details = details
  }
}

export const badRequest = (message, details) =>
  new HttpError(400, 'VALIDATION_ERROR', message, details)
export const unauthorized = (message = 'Authentication required or token expired') =>
  new HttpError(401, 'UNAUTHORIZED', message)
export const forbidden = (message = 'Insufficient permissions') =>
  new HttpError(403, 'FORBIDDEN', message)
export const notFound = (message = 'Resource not found') =>
  new HttpError(404, 'NOT_FOUND', message)
export const conflict = (message, details) =>
  new HttpError(409, 'CONFLICT', message, details)

export function notFoundHandler(req, res) {
  res.status(404).json({
    error: { code: 'NOT_FOUND', message: `Route ${req.method} ${req.path} not found` },
  })
}

// Central error handler — never leaks internals to clients.
export function errorHandler(err, req, res, next) {
  if (res.headersSent) return next(err)

  if (err instanceof HttpError) {
    return res.status(err.status).json({
      error: { code: err.code, message: err.message, ...(err.details ? { details: err.details } : {}) },
    })
  }

  // Body-parser JSON errors
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: 'Malformed JSON body' },
    })
  }

  console.error('unhandled error:', err)
  res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' } })
}
