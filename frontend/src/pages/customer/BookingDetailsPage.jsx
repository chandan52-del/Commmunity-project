import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Navbar } from '../../components/layout/Navbar'
import { Footer } from '../../components/layout/Footer'
import { fetchBooking, cancelBooking } from '../../services/bookings'
import { ApiError } from '../../services/api'
import { StatusBadge, formatDT } from './MyBookingsPage'

export function BookingDetailsPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [booking, setBooking] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [notFound, setNotFound] = useState(false)

  const [confirming, setConfirming] = useState(false)
  const [reason, setReason] = useState('')
  const [cancelling, setCancelling] = useState(false)
  const [cancelError, setCancelError] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetchBooking(id)
      setBooking(res.data)
    } catch (err) {
      if (err instanceof ApiError && (err.status === 404 || err.status === 403)) setNotFound(true)
      else setError(err?.message ?? 'Could not load booking.')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { load() }, [load])

  const cancellable = booking && ['pending', 'approved'].includes(booking.status)

  async function onCancel() {
    if (cancelling) return
    setCancelling(true)
    setCancelError(null)
    try {
      const res = await cancelBooking(booking.id, reason.trim() || undefined)
      setBooking(res.data)
      setConfirming(false)
    } catch (err) {
      setCancelError(err instanceof ApiError ? `${err.message}` : 'Could not cancel booking.')
    } finally {
      setCancelling(false)
    }
  }

  return (
    <>
      <Navbar />
      <main className="mx-auto max-w-3xl px-5 pb-20 pt-24 sm:px-8">
        <Link to="/bookings" className="text-sm font-semibold text-teal hover:text-teal-400">
          ← My Bookings
        </Link>

        {loading ? (
          <div className="mt-6 animate-pulse rounded-card border border-slate-200 bg-white p-8">
            <div className="h-7 w-1/3 rounded bg-slate-200" />
            <div className="mt-4 h-4 w-2/3 rounded bg-slate-200" />
          </div>
        ) : notFound ? (
          <div className="mt-8 rounded-card border border-dashed border-slate-300 bg-white p-10 text-center">
            <p className="font-semibold text-navy">Booking not found.</p>
            <p className="mt-1 text-sm text-slate-500">It may not exist or belong to another account.</p>
          </div>
        ) : error ? (
          <div className="mt-8 rounded-card border border-red-200 bg-red-50 p-8 text-center">
            <p className="font-semibold text-red-700">{error}</p>
            <button type="button" onClick={load} className="mt-3 rounded-md border border-red-300 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-100">
              Try again
            </button>
          </div>
        ) : booking ? (
          <div className="mt-6 rounded-card border border-slate-200 bg-white p-6 shadow-card sm:p-8">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-navy">{booking.event_name}</h1>
                <p className="mt-1 text-sm text-slate-500">{booking.booking_ref}</p>
              </div>
              <StatusBadge status={booking.status} />
            </div>

            <dl className="mt-6 grid gap-4 sm:grid-cols-2">
              {[
                ['Hall', booking.hall_name],
                ['Event type', booking.event_type],
                ['Start', formatDT(booking.start_at)],
                ['End', formatDT(booking.end_at)],
                ['Guests', booking.guest_count ?? 'Not specified'],
                ['Quoted price', booking.quoted_amount != null ? `$${Number(booking.quoted_amount).toLocaleString()}` : 'On request'],
                ['Submitted', formatDT(booking.created_at)],
                ...(booking.reviewed_at ? [['Reviewed', formatDT(booking.reviewed_at)]] : []),
              ].map(([k, v]) => (
                <div key={k} className="rounded-lg bg-page px-4 py-3">
                  <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">{k}</dt>
                  <dd className="mt-1 text-sm font-medium text-navy">{v}</dd>
                </div>
              ))}
            </dl>

            {booking.customer_notes && (
              <div className="mt-4 rounded-lg border border-slate-200 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Your notes</p>
                <p className="mt-1 text-sm text-slate-600">{booking.customer_notes}</p>
              </div>
            )}
            {booking.admin_notes && (
              <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">Admin notes</p>
                <p className="mt-1 text-sm text-amber-900">{booking.admin_notes}</p>
              </div>
            )}

            {booking.events?.length > 0 && (
              <div className="mt-6">
                <h2 className="text-sm font-bold uppercase tracking-wide text-slate-400">History</h2>
                <ul className="mt-2 space-y-2">
                  {booking.events.map((ev) => (
                    <li key={ev.id} className="flex flex-wrap items-baseline gap-x-3 text-sm">
                      <span className="font-medium text-navy">
                        {ev.from_status ? `${ev.from_status} → ` : ''}{ev.to_status}
                      </span>
                      <span className="text-slate-500">{formatDT(ev.created_at)}</span>
                      {ev.actor_name && <span className="text-slate-400">by {ev.actor_name}</span>}
                      {ev.note && <span className="w-full text-xs text-slate-400">{ev.note}</span>}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {cancellable && !confirming && (
              <button
                type="button"
                onClick={() => setConfirming(true)}
                className="mt-8 rounded-md border border-red-300 px-5 py-2.5 text-sm font-semibold text-red-700 hover:bg-red-50"
              >
                Cancel booking
              </button>
            )}

            {cancellable && confirming && (
              <div className="mt-8 rounded-lg border border-red-200 bg-red-50 p-4">
                <p className="text-sm font-semibold text-red-800">Cancel this booking?</p>
                <p className="mt-1 text-xs text-red-600">
                  This cannot be undone. Pending and approved bookings can be cancelled.
                </p>
                <input
                  type="text"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Reason (optional)"
                  className="mt-3 w-full rounded-md border border-red-200 bg-white px-3 py-2 text-sm focus:border-red-400 focus:outline-none"
                />
                {cancelError && <p className="mt-2 text-sm text-red-700">{cancelError}</p>}
                <div className="mt-3 flex gap-3">
                  <button
                    type="button"
                    onClick={onCancel}
                    disabled={cancelling}
                    className="rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
                  >
                    {cancelling ? 'Cancelling…' : 'Yes, cancel booking'}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setConfirming(false); setCancelError(null) }}
                    className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-navy hover:bg-slate-50"
                  >
                    Keep booking
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : null}
      </main>
      <Footer />
    </>
  )
}
