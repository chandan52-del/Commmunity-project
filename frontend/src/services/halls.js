import { apiRequest } from './api'

export function fetchHalls({ page = 1, pageSize = 12, search, location, minCapacity, maxCapacity, sort } = {}) {
  const params = new URLSearchParams({ page: String(page), page_size: String(pageSize) })
  if (search) params.set('search', search)
  if (location) params.set('location', location)
  if (minCapacity) params.set('min_capacity', String(minCapacity))
  if (maxCapacity) params.set('max_capacity', String(maxCapacity))
  if (sort) params.set('sort', sort)
  return apiRequest(`/halls?${params}`)
}

export function fetchHall(idOrSlug) {
  return apiRequest(`/halls/${encodeURIComponent(idOrSlug)}`)
}

export function fetchAvailability(idOrSlug, from, to) {
  const params = new URLSearchParams({ from, to })
  return apiRequest(`/halls/${encodeURIComponent(idOrSlug)}/availability?${params}`)
}
