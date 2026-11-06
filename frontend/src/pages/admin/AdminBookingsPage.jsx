import { Fragment, useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { fetchAdminBookings, approveBooking, rejectBooking } from '../../services/admin'
import { ApiError } from '../../services/api'
import { StatusBadge, formatDT } from '../customer/MyBookingsPage'

const inputCls =
  'rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-navy focus:border-teal focus:outline-none focus:ring-2 focus:ring-teal/30'
const STATUSES = ['', 'pending', 'approved', 'rejected', 'cancelled', 'completed']

function ActionModal({ booking, action, onClose, onDone }) {
  const [notes, setNotes] = useState('')
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const isApprove = action === 'approve'

  async function submit(e) {
    e.preventDefault()
    if (busy) return
    if (!isApprove && !notes.trim()) { setError('A reason is required to reject a booking.'); return }
    setBusy(true); setError(null)
    try {
      if (isApprove) await approveBooking(booking.id, notes.trim() || undefined)
      else await rejectBooking(booking.id, notes.trim())
      onDone()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Action failed.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-navy/50 p-4" onClick={onClose} role="presentation">
      <div role="dialog" aria-modal="true" className="w-full max-w-md rounded-card bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-xl font-bold text-navy">{isApprove ? 'Approve' : 'Reject'} booking {booking.booking_ref}</h2>
        <p className="mt-1 text-sm text-slate-500">{booking.event_name} · {booking.hall_name}</p>
        {error && <p role="alert" className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        <form onSubmit={submit} className="mt-4">
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
            Notes {isApprove ? '(optional)' : '(required)'}
          </label>
          <textarea rows={3} maxLength={2000} value={notes} onChange={(e) => setNotes(e.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-teal focus:outline-none focus:ring-2 focus:ring-teal/30" />
          <div className="mt-4 flex gap-3">
            <button type="submit" disabled={busy} className={`rounded-md px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60 ${isApprove ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-red-600 hover:bg-red-700'}`}>
              {busy ? 'Working…' : isApprove ? 'Approve booking' : 'Reject booking'}
            </button>
            <button type="button" onClick={onClose} className="rounded-md border border-slate-300 px-5 py-2.5 text-sm font-semibold text-navy hover:bg-slate-50">Cancel</button>
          </div>
        </form>
      </div>
    </div>
  )
}

export function AdminBookingsPage() {
  const [searchParams] = useSearchParams()
  const [bookings, setBookings] = useState([])
  const [counts, setCounts] = useState(null)
  const [pagination, setPagination] = useState({ page: 1, total_pages: 1, total: 0 })
  const [page, setPage] = useState(1)
  const [status, setStatus] = useState(searchParams.get('status') ?? '')
  const [search, setSearch] = useState('')
  const [expanded, setExpanded] = useState(null)
  const [action, setAction] = useState(null) // {booking, type}
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = useCallback(async (p = page, s = status, q = search) => {
    setLoading(true); setError(null)
    try {
      const res = await fetchAdminBookings({ page: p, pageSize: 20, status: s || undefined, search: q || undefined, sort: '-created_at' })
      setBookings(res.data ?? [])
      setCounts(res.counts ?? null)
      setPagination(res.pagination)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load bookings.')
    } finally {
      setLoading(false)
    }
  }, [page, status, search])

  useEffect(() => { load() }, [page, status]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight text-navy">Bookings</h1>
      <p className="mt-1 text-sm text-slate-500">Review and manage booking requests.</p>

      {counts && (
        <div className="mt-4 flex flex-wrap gap-2">
          {['pending', 'approved', 'rejected', 'cancelled', 'completed'].map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => { setStatus(s); setPage(1) }}
              className={`rounded-full px-3 py-1 text-xs font-semibold ${status === s ? 'bg-navy text-white' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}
            >
              {s[0].toUpperCase() + s.slice(1)} · {counts[s] ?? 0}
            </button>
          ))}
          <button type="button" onClick={() => { setStatus(''); setPage(1) }}
            className={`rounded-full px-3 py-1 text-xs font-semibold ${status === '' ? 'bg-navy text-white' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}>
            All
          </button>
        </div>
      )}

      <form className="mt-4 flex gap-3" onSubmit={(e) => { e.preventDefault(); setPage(1); load(1, status, search) }}>
        <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search ref, event, customer…" className={`${inputCls} w-full max-w-md`} />
        <button type="submit" className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-navy hover:bg-slate-50">Search</button>
      </form>

      {loading ? (
        <div className="mt-6 space-y-3">{[0,1,2].map((i) => <div key={i} className="h-16 animate-pulse rounded-card border border-slate-200 bg-white" />)}</div>
      ) : error ? (
        <div className="mt-6 rounded-card border border-red-200 bg-red-50 p-8 text-center">
          <p className="font-semibold text-red-700">{error}</p>
          <button type="button" onClick={() => load()} className="mt-3 rounded-md border border-red-300 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-100">Try again</button>
        </div>
      ) : bookings.length === 0 ? (
        <div className="mt-6 rounded-card border border-dashed border-slate-300 bg-white p-10 text-center">
          <p className="font-semibold text-navy">No bookings match the filters.</p>
        </div>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-card border border-slate-200 bg-white shadow-card">
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-400">
                <th className="px-4 py-3">Reference</th><th className="px-4 py-3">Event</th>
                <th className="px-4 py-3">Hall</th><th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">When</th><th className="px-4 py-3">Guests</th>
                <th className="px-4 py-3">Status</th><th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {bookings.map((b) => (
                <Fragment key={b.id}>
                  <tr className="align-top">
                    <td className="px-4 py-3 font-mono text-xs text-navy">{b.booking_ref}</td>
                    <td className="px-4 py-3">
                      <button type="button" onClick={() => setExpanded(expanded === b.id ? null : b.id)} className="text-left font-medium text-navy hover:text-teal">
                        {b.event_name}
                      </button>
                      <p className="text-xs text-slate-400">{b.event_type}</p>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{b.hall_name}</td>
                    <td className="px-4 py-3 text-slate-600">{b.customer_name ?? '—'}<br /><span className="text-xs text-slate-400">{b.customer_email}</span></td>
                    <td className="px-4 py-3 text-slate-600">{formatDT(b.start_at)}<br /><span className="text-xs text-slate-400">→ {formatDT(b.end_at)}</span></td>
                    <td className="px-4 py-3 text-slate-600">{b.guest_count ?? '—'}</td>
                    <td className="px-4 py-3"><StatusBadge status={b.status} /></td>
                    <td className="px-4 py-3 text-right">
                      {b.status === 'pending' && (
                        <div className="flex justify-end gap-2">
                          <button type="button" onClick={() => setAction({ booking: b, type: 'approve' })} className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700">Approve</button>
                          <button type="button" onClick={() => setAction({ booking: b, type: 'reject' })} className="rounded-md bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700">Reject</button>
                        </div>
                      )}
                    </td>
                  </tr>
                  {expanded === b.id && (
                    <tr className="bg-slate-50">
                      <td colSpan={8} className="px-4 py-3 text-sm text-slate-600">
                        <div className="grid gap-2 sm:grid-cols-2">
                          <p><span className="font-semibold text-navy">Notes:</span> {b.customer_notes || '—'}</p>
                          <p><span className="font-semibold text-navy">Admin notes:</span> {b.admin_notes || '—'}</p>
                          <p><span className="font-semibold text-navy">Quoted:</span> {b.quoted_amount != null ? `$${Number(b.quoted_amount).toLocaleString()}` : '—'}</p>
                          <p><span className="font-semibold text-navy">Reviewed:</span> {b.reviewed_at ? `${formatDT(b.reviewed_at)}${b.reviewed_by ? ` by #${b.reviewed_by}` : ''}` : '—'}</p>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pagination.total_pages > 1 && (
        <nav className="mt-4 flex items-center justify-center gap-3">
          <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-navy disabled:opacity-40">Previous</button>
          <span className="text-sm text-slate-500">Page {pagination.page} of {pagination.total_pages}</span>
          <button type="button" disabled={page >= pagination.total_pages} onClick={() => setPage((p) => p + 1)} className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-navy disabled:opacity-40">Next</button>
        </nav>
      )}

      {action && (
        <ActionModal
          booking={action.booking}
          action={action.type}
          onClose={() => setAction(null)}
          onDone={() => { setAction(null); load() }}
        />
      )}
    </div>
  )
}
