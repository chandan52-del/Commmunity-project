import { apiRequest } from './api'

export function fetchMyBookings({ page = 1, pageSize = 10, status } = {}) {
  const params = new URLSearchParams({ page: String(page), page_size: String(pageSize) })
  if (status) params.set('status', status)
  return apiRequest(`/bookings?${params}`)
}

export function fetchBooking(id) {
  return apiRequest(`/bookings/${id}`)
}

export function createBooking(body) {
  return apiRequest('/bookings', { method: 'POST', body })
}

export function cancelBooking(id, reason) {
  return apiRequest(`/bookings/${id}/cancel`, { method: 'PATCH', body: reason ? { reason } : {} })
}
