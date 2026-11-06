import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Navbar } from '../../components/layout/Navbar'
import { Footer } from '../../components/layout/Footer'
import { fetchHall, fetchAvailability } from '../../services/halls'
import { createBooking } from '../../services/bookings'
import { ApiError } from '../../services/api'
import { useAuth } from '../../context/AuthContext'

const inputCls =
  'w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-navy focus:border-teal focus:outline-none focus:ring-2 focus:ring-teal/30'

function formatPrice(basePrice) {
  if (basePrice === null || basePrice === undefined) return 'Price on request'
  const n = Number(basePrice)
  return Number.isFinite(n) ? `$${n.toLocaleString()} per booking` : 'Price on request'
}

function formatRange(iso) {
  const d = new Date(iso)
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' }) + ' UTC'
}

function toISOUTC(dateStr) {
  const d = new Date(`${dateStr}T00:00:00.000Z`)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

export function HallDetailsPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { isAuthenticated, status: authStatus } = useAuth()
  const [hall, setHall] = useState(null)
  const [images, setImages] = useState([])
  const [status, setStatus] = useState('loading') // loading | ready | notfound | error
  const [error, setError] = useState(null)

  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [availability, setAvailability] = useState(null)
  const [availLoading, setAvailLoading] = useState(false)
  const [availError, setAvailError] = useState(null)

  const [bookingForm, setBookingForm] = useState({
    event_name: '', event_type: 'wedding', date: '', start_time: '', end_time: '',
    guest_count: '', customer_notes: '',
  })
  const [bookingLoading, setBookingLoading] = useState(false)
  const [bookingError, setBookingError] = useState(null)
  const [bookingFieldErrors, setBookingFieldErrors] = useState({})
  const [bookingSuccess, setBookingSuccess] = useState(null)

  useEffect(() => {
    let cancelled = false
    setStatus('loading')
    fetchHall(id)
      .then((res) => {
        if (cancelled) return
        const data = res.data
        setHall(data)
        setImages(data.images ?? [])
        setStatus('ready')
      })
      .catch((err) => {
        if (cancelled) return
        if (err instanceof ApiError && err.status === 404) setStatus('notfound')
        else {
          setStatus('error')
          setError(err?.message ?? 'Could not load this hall.')
        }
      })
    return () => { cancelled = true }
  }, [id])

  const cover = useMemo(() => {
    if (images[0]?.image_url) return images[0].image_url
    return hall?.cover_image_url ?? null
  }, [images, hall])

  async function checkAvailability(e) {
    e.preventDefault()
    if (!fromDate || !toDate) {
      setAvailError('Please choose both a start and end date.')
      return
    }
    const from = toISOUTC(fromDate)
    // exclusive end: use the day after the selected end date at 00:00 UTC
    const endPlus = new Date(`${toDate}T00:00:00.000Z`)
    endPlus.setUTCDate(endPlus.getUTCDate() + 1)
    const to = endPlus.toISOString()
    if (!from || !to || new Date(to) <= new Date(from)) {
      setAvailError('End date must be after the start date.')
      return
    }
    setAvailLoading(true)
    setAvailError(null)
    try {
      const res = await fetchAvailability(id, from, to)
      setAvailability(res.data)
    } catch (err) {
      setAvailability(null)
      setAvailError(err?.message ?? 'Could not check availability.')
    } finally {
      setAvailLoading(false)
    }
  }

  if (status === 'loading') {
    return (
      <>
        <Navbar />
        <main className="mx-auto max-w-5xl px-5 py-24">
          <div className="animate-pulse">
            <div className="aspect-[21/9] rounded-card bg-slate-200" />
            <div className="mt-6 h-8 w-1/2 rounded bg-slate-200" />
            <div className="mt-3 h-4 w-1/3 rounded bg-slate-200" />
          </div>
        </main>
        <Footer />
      </>
    )
  }

  if (status === 'notfound') {
    return (
      <>
        <Navbar />
        <main className="mx-auto max-w-3xl px-5 py-24 text-center">
          <h1 className="text-2xl font-bold text-navy">Hall not found</h1>
          <p className="mt-2 text-slate-500">
            This hall may have been removed or is no longer listed. Browse other venues instead.
          </p>
          <Link
            to="/"
            className="mt-6 inline-block rounded-md bg-teal px-5 py-2.5 text-sm font-semibold text-white hover:bg-teal-400"
          >
            Back to halls
          </Link>
        </main>
        <Footer />
      </>
    )
  }

  if (status === 'error' || !hall) {
    return (
      <>
        <Navbar />
        <main className="mx-auto max-w-3xl px-5 py-24 text-center">
          <h1 className="text-2xl font-bold text-navy">Something went wrong</h1>
          <p className="mt-2 text-slate-500">{error}</p>
          <Link to="/" className="mt-6 inline-block rounded-md bg-teal px-5 py-2.5 text-sm font-semibold text-white hover:bg-teal-400">
            Back to halls
          </Link>
        </main>
        <Footer />
      </>
    )
  }

  const busy = availability?.busy_ranges ?? []

  const setB = (k) => (e) => setBookingForm((f) => ({ ...f, [k]: e.target.value }))

  async function submitBooking(e) {
    e.preventDefault()
    if (bookingLoading) return
    setBookingError(null)
    setBookingFieldErrors({})

    const fe = {}
    if (bookingForm.event_name.trim().length < 2) fe.event_name = 'Event name is required (min 2 characters)'
    if (!bookingForm.date) fe.date = 'Date is required'
    if (!bookingForm.start_time) fe.start_time = 'Start time is required'
    if (!bookingForm.end_time) fe.end_time = 'End time is required'
    if (bookingForm.guest_count && (!Number.isInteger(Number(bookingForm.guest_count)) || Number(bookingForm.guest_count) < 1)) {
      fe.guest_count = 'Guest count must be a positive whole number'
    }
    if (Object.values(fe).some(Boolean)) { setBookingFieldErrors(fe); return }

    const startAt = new Date(`${bookingForm.date}T${bookingForm.start_time}`).toISOString()
    const endAt = new Date(`${bookingForm.date}T${bookingForm.end_time}`).toISOString()
    if (new Date(endAt) <= new Date(startAt)) {
      setBookingFieldErrors({ end_time: 'End time must be after start time' })
      return
    }

    setBookingLoading(true)
    try {
      const res = await createBooking({
        hall_id: hall.id,
        event_name: bookingForm.event_name.trim(),
        event_type: bookingForm.event_type.trim(),
        start_at: startAt,
        end_at: endAt,
        guest_count: bookingForm.guest_count ? Number(bookingForm.guest_count) : null,
        customer_notes: bookingForm.customer_notes.trim() || null,
      })
      setBookingSuccess(res.data)
      setTimeout(() => navigate('/bookings'), 2000)
    } catch (err) {
      if (err instanceof ApiError && Array.isArray(err.details)) {
        const map = {}
        for (const d of err.details) if (d.field && !map[d.field]) map[d.field] = d.message
        setBookingFieldErrors(map)
      }
      setBookingError(err?.message ?? 'Could not submit booking request.')
    } finally {
      setBookingLoading(false)
    }
  }

  return (
    <>
      <Navbar />
      <main className="bg-page">
        <div className="mx-auto max-w-6xl px-5 pb-20 pt-24 sm:px-8">
          <Link to="/" className="text-sm font-semibold text-teal hover:text-teal-400">
            ← Back to halls
          </Link>

          <div className="mt-4 overflow-hidden rounded-card border border-slate-200 bg-white shadow-card">
            {cover ? (
              <img src={cover} alt={`${hall.name} — venue photo`} className="aspect-[21/9] w-full object-cover" />
            ) : (
              <div className="flex aspect-[21/9] items-center justify-center bg-gradient-to-br from-navy to-teal/70">
                <span className="text-6xl font-bold text-white/80">{hall.name.charAt(0)}</span>
              </div>
            )}
            {images.length > 1 && (
              <div className="flex gap-2 overflow-x-auto p-3">
                {images.map((img) => (
                  <img
                    key={img.id}
                    src={img.image_url}
                    alt=""
                    className="h-16 w-24 shrink-0 rounded-md object-cover"
                    loading="lazy"
                  />
                ))}
              </div>
            )}

            <div className="p-6 sm:p-8">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h1 className="text-3xl font-bold tracking-tight text-navy">{hall.name}</h1>
                  <p className="mt-1 text-sm text-slate-500">{hall.location ?? 'Location TBD'}</p>
                </div>
                <div className="rounded-lg bg-page px-4 py-3 text-right">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Capacity</p>
                  <p className="text-lg font-bold text-navy">Up to {hall.capacity} guests</p>
                </div>
              </div>

              <p className="mt-4 text-sm leading-relaxed text-slate-600">
                {hall.description ?? 'A community venue available for events and gatherings.'}
              </p>

              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <div className="rounded-lg border border-slate-200 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Pricing</p>
                  <p className="mt-1 font-semibold text-navy">{formatPrice(hall.base_price)}</p>
                </div>
                <div className="rounded-lg border border-slate-200 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Status</p>
                  <p className="mt-1 font-semibold capitalize text-navy">{hall.status}</p>
                </div>
              </div>

              {(hall.amenities ?? []).length > 0 && (
                <div className="mt-6">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Amenities</p>
                  <ul className="mt-2 flex flex-wrap gap-2">
                    {hall.amenities.map((a) => (
                      <li key={a} className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600">
                        {a}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>

          <section className="mt-8 rounded-card border border-slate-200 bg-white p-6 shadow-card sm:p-8">
            <h2 className="text-xl font-bold tracking-tight text-navy">Check availability</h2>
            <p className="mt-1 text-sm text-slate-500">
              Busy periods include approved bookings and scheduled maintenance. Times are shown in UTC.
            </p>

            <form onSubmit={checkAvailability} className="mt-5 grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
              <div>
                <label htmlFor="avail-from" className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  From date
                </label>
                <input id="avail-from" type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label htmlFor="avail-to" className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  To date (inclusive)
                </label>
                <input id="avail-to" type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className={inputCls} />
              </div>
              <button
                type="submit"
                disabled={availLoading}
                className="rounded-md bg-navy px-6 py-2.5 text-sm font-semibold text-white hover:bg-navy/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal disabled:opacity-60"
              >
                {availLoading ? 'Checking…' : 'Check'}
              </button>
            </form>

            {availError && (
              <p role="alert" className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {availError}
              </p>
            )}

            {availability && (
              <div className="mt-6">
                <p className="text-sm text-slate-600">
                  {busy.length === 0
                    ? 'No approved bookings or maintenance windows overlap this range.'
                    : `${busy.length} busy period${busy.length === 1 ? '' : 's'} found.`}
                </p>
                {busy.length > 0 && (
                  <ul className="mt-3 divide-y divide-slate-100 rounded-lg border border-slate-200">
                    {busy.map((r, i) => (
                      <li key={i} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
                        <span className="flex items-center gap-2">
                          <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${
                            r.type === 'maintenance' ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-600'
                          }`}>
                            {r.type === 'maintenance' ? 'Maintenance' : 'Booked'}
                          </span>
                        </span>
                        <span className="text-slate-600">
                          {formatRange(r.start)} — {formatRange(r.end)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
                <p className="mt-3 text-xs text-slate-400">
                  Only confirmed bookings and maintenance are shown. Final availability is confirmed
                  when a booking request is approved.
                </p>
              </div>
            )}
          </section>

          <section className="mt-8 rounded-card border border-slate-200 bg-white p-6 shadow-card sm:p-8">
            <h2 className="text-xl font-bold tracking-tight text-navy">Request a booking</h2>
            <p className="mt-1 text-sm text-slate-500">
              Submit a request — an administrator reviews it before confirmation.
            </p>

            {bookingSuccess ? (
              <div className="mt-5 rounded-lg border border-emerald-200 bg-emerald-50 p-4">
                <p className="font-semibold text-emerald-800">Booking request submitted!</p>
                <p className="mt-1 text-sm text-emerald-700">
                  Reference <span className="font-mono font-bold">{bookingSuccess.booking_ref}</span> —
                  redirecting to My Bookings…
                </p>
                <Link to="/bookings" className="mt-3 inline-block text-sm font-semibold text-teal hover:text-teal-400">
                  Go to My Bookings →
                </Link>
              </div>
            ) : authStatus === 'loading' ? (
              <p className="mt-5 text-sm text-slate-400">Loading…</p>
            ) : !isAuthenticated ? (
              <div className="mt-5 rounded-lg border border-dashed border-slate-300 bg-page p-5 text-center">
                <p className="text-sm text-slate-600">Sign in to request a booking for this hall.</p>
                <Link
                  to="/login"
                  state={{ from: `/halls/${id}` }}
                  className="mt-3 inline-block rounded-md bg-teal px-5 py-2.5 text-sm font-semibold text-white hover:bg-teal-400"
                >
                  Login to continue
                </Link>
              </div>
            ) : (
              <form onSubmit={submitBooking} className="mt-5 grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label htmlFor="bk-name" className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Event name <span className="text-red-500">*</span>
                  </label>
                  <input id="bk-name" type="text" value={bookingForm.event_name} onChange={setB('event_name')}
                    placeholder="e.g. Sharma Wedding Reception" className={inputCls} />
                  {bookingFieldErrors.event_name && <p className="mt-1 text-xs text-red-600">{bookingFieldErrors.event_name}</p>}
                </div>
                <div>
                  <label htmlFor="bk-type" className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Event type <span className="text-red-500">*</span>
                  </label>
                  <input id="bk-type" type="text" value={bookingForm.event_type} onChange={setB('event_type')} className={inputCls} />
                  {bookingFieldErrors.event_type && <p className="mt-1 text-xs text-red-600">{bookingFieldErrors.event_type}</p>}
                </div>
                <div>
                  <label htmlFor="bk-guests" className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Guests (optional, max {hall.capacity})
                  </label>
                  <input id="bk-guests" type="number" min="1" max={hall.capacity} value={bookingForm.guest_count} onChange={setB('guest_count')} className={inputCls} />
                  {bookingFieldErrors.guest_count && <p className="mt-1 text-xs text-red-600">{bookingFieldErrors.guest_count}</p>}
                </div>
                <div>
                  <label htmlFor="bk-date" className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Date <span className="text-red-500">*</span>
                  </label>
                  <input id="bk-date" type="date" value={bookingForm.date} onChange={setB('date')} className={inputCls} />
                  {bookingFieldErrors.date && <p className="mt-1 text-xs text-red-600">{bookingFieldErrors.date}</p>}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="bk-start" className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Start <span className="text-red-500">*</span>
                    </label>
                    <input id="bk-start" type="time" value={bookingForm.start_time} onChange={setB('start_time')} className={inputCls} />
                    {bookingFieldErrors.start_time && <p className="mt-1 text-xs text-red-600">{bookingFieldErrors.start_time}</p>}
                  </div>
                  <div>
                    <label htmlFor="bk-end" className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                      End <span className="text-red-500">*</span>
                    </label>
                    <input id="bk-end" type="time" value={bookingForm.end_time} onChange={setB('end_time')} className={inputCls} />
                    {bookingFieldErrors.end_time && <p className="mt-1 text-xs text-red-600">{bookingFieldErrors.end_time}</p>}
                  </div>
                </div>
                <div className="sm:col-span-2">
                  <label htmlFor="bk-notes" className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Notes (optional)
                  </label>
                  <textarea id="bk-notes" rows={3} maxLength={2000} value={bookingForm.customer_notes} onChange={setB('customer_notes')} className={inputCls} />
                  {bookingFieldErrors.customer_notes && <p className="mt-1 text-xs text-red-600">{bookingFieldErrors.customer_notes}</p>}
                </div>

                {bookingError && (
                  <p role="alert" className="sm:col-span-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                    {bookingError}
                    {bookingError.includes('overlaps') && ' — try different dates or times.'}
                  </p>
                )}

                <div className="sm:col-span-2">
                  <button
                    type="submit"
                    disabled={bookingLoading}
                    className="rounded-md bg-teal px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-teal-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal disabled:opacity-60"
                  >
                    {bookingLoading ? 'Submitting…' : 'Submit booking request'}
                  </button>
                  <p className="mt-2 text-xs text-slate-400">
                    Requests with status "pending" do not block the hall until approved.
                  </p>
                </div>
              </form>
            )}
          </section>
        </div>
      </main>
      <Footer />
    </>
  )
}
