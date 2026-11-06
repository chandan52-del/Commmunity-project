import { apiRequest } from './api'
import { fetchHalls } from './halls'

const qs = (obj) => {
  const p = new URLSearchParams()
  for (const [k, v] of Object.entries(obj)) if (v !== undefined && v !== null && v !== '') p.set(k, String(v))
  return p.toString()
}

// Dashboard & reports
export const fetchDashboard = () => apiRequest('/admin/dashboard')
export const fetchReports = ({ from, to, hallId, groupBy }) =>
  apiRequest(`/admin/reports?${qs({ from, to, hall_id: hallId, group_by: groupBy })}`)

// Halls — public list endpoint is used for browsing (contract has no admin list);
// mutations go through admin endpoints.
export const fetchAdminHalls = (params) => fetchHalls(params)
export const createHall = (body) => apiRequest('/admin/halls', { method: 'POST', body })
export const updateHall = (id, body) => apiRequest(`/admin/halls/${id}`, { method: 'PATCH', body })
export const deactivateHall = (id) => apiRequest(`/admin/halls/${id}`, { method: 'DELETE' })

// Bookings
export const fetchAdminBookings = ({ page = 1, pageSize = 20, status, hallId, userId, from, to, search, sort } = {}) =>
  apiRequest(`/admin/bookings?${qs({ page, page_size: pageSize, status, hall_id: hallId, user_id: userId, from, to, search, sort })}`)
export const approveBooking = (id, adminNotes) =>
  apiRequest(`/admin/bookings/${id}/approve`, { method: 'PATCH', body: adminNotes ? { admin_notes: adminNotes } : {} })
export const rejectBooking = (id, adminNotes) =>
  apiRequest(`/admin/bookings/${id}/reject`, { method: 'PATCH', body: { admin_notes: adminNotes } })

// Maintenance
export const fetchMaintenance = ({ page = 1, pageSize = 20, hallId, status, from, to, sort } = {}) =>
  apiRequest(`/admin/maintenance?${qs({ page, page_size: pageSize, hall_id: hallId, status, from, to, sort })}`)
export const createMaintenance = (body) => apiRequest('/admin/maintenance', { method: 'POST', body })
export const updateMaintenance = (id, body) => apiRequest(`/admin/maintenance/${id}`, { method: 'PATCH', body })
export const cancelMaintenance = (id) => apiRequest(`/admin/maintenance/${id}`, { method: 'DELETE' })
