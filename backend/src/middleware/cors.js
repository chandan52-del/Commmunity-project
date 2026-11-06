// Zero-dependency CORS middleware.
// Allowed origins come from CORS_ORIGINS (comma-separated). Never reflects
// arbitrary origins and never combines a wildcard with credentials.
const allowedOrigins = (process.env.CORS_ORIGINS ?? 'http://localhost:5173')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean)

export function corsMiddleware(req, res, next) {
  const origin = req.headers.origin
  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin)
    res.setHeader('Vary', 'Origin')
    res.setHeader('Access-Control-Allow-Credentials', 'true')
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization')
  res.setHeader('Access-Control-Max-Age', '600')
  if (req.method === 'OPTIONS') {
    return res.status(204).end()
  }
  next()
}
