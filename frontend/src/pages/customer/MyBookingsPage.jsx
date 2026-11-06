import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Navbar } from '../../components/layout/Navbar'
import { Footer } from '../../components/layout/Footer'
import { fetchMyBookings } from '../../services/bookings'
import { ApiError } from '../../services/api'

const PAGE_SIZE = 10
const STATUSES = ['', 'pending', 'approved', 'rejected', 'cancelled', 'completed']

const STATUS_STYLES = {
  pending: 'bg-amber-100 text-amber-800',
  approved: 'bg-emerald-100 text-emerald-800',
  rejected: 'bg-red-100 text-red-700',
  cancelled: 'bg-slate-200 text-slate-600',
  completed: 'bg-blue-100 text-blue-800',
}

export function StatusBadge({ status }) {
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${STATUS_STYLES[status] ?? 'bg-slate-100 text-slate-600'}`}>
      {status}
    </span>
  )
}

export function formatDT(iso) {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
}

export function MyBookingsPage() {
  const [data, setData] = useState({ data: [], pagination: { page: 1, total_pages: 1, total: 0 } })
  const [statusFilter, setStatusFilter] = useState('')
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = useCallback(async (p, s) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetchMyBookings({ page: p, pageSize: PAGE_SIZE, status: s || undefined })
      setData(res)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load bookings.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load(page, statusFilter) }, [page, statusFilter, load])

  return (
    <>
      <Navbar />
      <main className="mx-auto max-w-5xl px-5 pb-20 pt-24 sm:px-8">
        <h1 className="text-3xl font-bold tracking-tight text-navy">My Bookings</h1>
        <p className="mt-1 text-sm text-slate-500">Track your hall booking requests and confirmations.</p>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <label htmlFor="status-filter" className="text-sm font-medium text-slate-600">Status</label>
          <select
            id="status-filter"
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1) }}
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-navy focus:border-teal focus:outline-none focus:ring-2 focus:ring-teal/30"
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>{s ? s[0].toUpperCase() + s.slice(1) : 'All'}</option>
            ))}
          </select>
        </div>

        {loading ? (
          <div className="mt-8 space-y-4" aria-label="Loading bookings">
            {[0, 1, 2].map((i) => (
              <div key={i} className="animate-pulse rounded-card border border-slate-200 bg-white p-5">
                <div className="h-5 w-1/3 rounded bg-slate-200" />
                <div className="mt-3 h-4 w-2/3 rounded bg-slate-200" />
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="mt-8 rounded-card border border-red-200 bg-red-50 p-8 text-center">
            <p className="font-semibold text-red-700">{error}</p>
            <button
              type="button"
              onClick={() => load(page, statusFilter)}
              className="mt-3 rounded-md border border-red-300 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-100"
            >
              Try again
            </button>
          </div>
        ) : data.data.length === 0 ? (
          <div className="mt-8 rounded-card border border-dashed border-slate-300 bg-white p-10 text-center">
            <p className="font-semibold text-navy">No bookings yet.</p>
            <p className="mt-1 text-sm text-slate-500">Browse halls and submit your first booking request.</p>
            <Link to="/" className="mt-4 inline-block rounded-md bg-teal px-5 py-2.5 text-sm font-semibold text-white hover:bg-teal-400">
              Explore halls
            </Link>
          </div>
        ) : (
          <>
            <ul className="mt-6 space-y-4">
              {data.data.map((b) => (
                <li key={b.id}>
                  <Link
                    to={`/bookings/${b.id}`}
                    className="block rounded-card border border-slate-200 bg-white p-5 shadow-card transition-shadow hover:shadow-[0_8px_24px_rgba(11,31,58,0.08)]"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-navy">{b.event_name}</p>
                        <p className="mt-0.5 text-sm text-slate-500">
                          {b.hall_name} · {formatDT(b.start_at)} → {formatDT(b.end_at)}
                        </p>
                        <p className="mt-1 text-xs text-slate-400">
                          {b.booking_ref} · {b.guest_count != null ? `${b.guest_count} guests` : 'Guest count TBD'}
                        </p>
                      </div>
                      <StatusBadge status={b.status} />
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
            {data.pagination.total_pages > 1 && (
              <nav className="mt-6 flex items-center justify-center gap-3" aria-label="Booking pages">
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-navy hover:bg-slate-50 disabled:opacity-40"
                >
                  Previous
                </button>
                <span className="text-sm text-slate-500">Page {data.pagination.page} of {data.pagination.total_pages}</span>
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.min(data.pagination.total_pages, p + 1))}
                  disabled={page >= data.pagination.total_pages}
                  className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-navy hover:bg-slate-50 disabled:opacity-40"
                >
                  Next
                </button>
              </nav>
            )}
          </>
        )}
      </main>
      <Footer />
    </>
  )
}
