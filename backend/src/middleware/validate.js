import { badRequest } from './errorHandler.js'

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

function checkString(value, { field, required = false, minLength, maxLength }) {
  if (value === undefined || value === null || value === '') {
    return required ? `${field} is required` : null
  }
  if (typeof value !== 'string') return `${field} must be a string`
  const v = value.trim()
  if (minLength !== undefined && v.length < minLength) {
    return `${field} must be at least ${minLength} characters`
  }
  if (maxLength !== undefined && v.length > maxLength) {
    return `${field} must be at most ${maxLength} characters`
  }
  return null
}

// rules: { fieldName: { required, minLength, maxLength, type: 'string'|'email'|'integer', trim } }
// Returns middleware that validates req.body and collects field-level errors.
export function validateBody(rules) {
  return (req, res, next) => {
    const errors = []
    const cleaned = {}

    for (const [field, rule] of Object.entries(rules)) {
      let value = req.body?.[field]
      if (rule.type === 'email' || rule.type === 'string' || rule.type === undefined) {
        const err = checkString(value, { field, ...rule })
        if (err) {
          errors.push({ field, message: err })
          continue
        }
        if (typeof value === 'string' && rule.trim !== false) value = value.trim()
        if (rule.type === 'email' && value && !EMAIL_RE.test(value)) {
          errors.push({ field, message: `${field} must be a valid email address` })
          continue
        }
      } else if (rule.type === 'integer') {
        const n = Number(value)
        if (value === undefined || value === null || value === '' ) {
          if (rule.required) errors.push({ field, message: `${field} is required` })
          continue
        }
        if (!Number.isInteger(n)) {
          errors.push({ field, message: `${field} must be an integer` })
          continue
        }
        value = n
      }
      cleaned[field] = value
    }

    if (errors.length > 0) {
      return next(badRequest('Request validation failed', errors))
    }
    req.body = { ...(req.body ?? {}), ...cleaned }
    next()
  }
}
