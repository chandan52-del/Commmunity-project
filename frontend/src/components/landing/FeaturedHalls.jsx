import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { fetchHalls } from '../../services/halls'
import { ApiError } from '../../services/api'

const PAGE_SIZE = 12

function formatPrice(basePrice) {
  if (basePrice === null || basePrice === undefined) return 'Price on request'
  const n = Number(basePrice)
  return Number.isFinite(n) ? `From $${n.toLocaleString()}` : 'Price on request'
}

function HallImage({ hall, className }) {
  if (hall.cover_image_url) {
    return (
      <img
        src={hall.cover_image_url}
        alt={`${hall.name} — event venue in ${hall.location ?? 'community'}`}
        loading="lazy"
        className={className}
      />
    )
  }
  return (
    <div
      className={`${className} flex items-center justify-center bg-gradient-to-br from-navy to-teal/70`}
      aria-hidden="true"
    >
      <span className="text-4xl font-bold text-white/80">{hall.name?.charAt(0) ?? 'H'}</span>
    </div>
  )
}

function HallCard({ hall }) {
  return (
    <article className="group flex flex-col overflow-hidden rounded-card border border-slate-200 bg-white shadow-card transition-shadow duration-300 hover:shadow-[0_16px_40px_rgba(11,31,58,0.12)]">
      <Link to={`/halls/${hall.slug || hall.id}`} className="relative block aspect-[4/3] overflow-hidden">
        <HallImage
          hall={hall}
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
        />
      </Link>

      <div className="flex flex-1 flex-col p-5">
        <h3 className="text-lg font-bold tracking-tight text-navy">{hall.name}</h3>
        <p className="mt-1 text-sm text-slate-500">{hall.location ?? 'Location TBD'}</p>

        <dl className="mt-4 flex items-center gap-5 text-sm text-slate-600">
          <div className="flex items-center gap-1.5">
            <svg viewBox="0 0 24 24" className="h-4 w-4 text-teal" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
            <dt className="sr-only">Capacity</dt>
            <dd>Up to {hall.capacity} guests</dd>
          </div>
          <div className="flex items-center gap-1.5">
            <dt className="sr-only">Price</dt>
            <dd className="font-semibold text-navy">{formatPrice(hall.base_price)}</dd>
          </div>
        </dl>

        <p className="mt-3 line-clamp-2 text-sm leading-relaxed text-slate-500">
          {hall.description ?? 'A community venue available for events and gatherings.'}
        </p>

        <div className="mt-3 flex flex-wrap gap-1.5">
          {(hall.amenities ?? []).slice(0, 4).map((amenity) => (
            <span key={amenity} className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-medium text-slate-600">
              {amenity}
            </span>
          ))}
        </div>

        <Link
          to={`/halls/${hall.slug || hall.id}`}
          className="mt-5 self-start rounded-md border border-navy/15 px-4 py-2 text-sm font-semibold text-navy transition-colors hover:border-teal hover:text-teal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal"
        >
          View Details
        </Link>
      </div>
    </article>
  )
}

export function FeaturedHalls({ filters }) {
  const [halls, setHalls] = useState([])
  const [pagination, setPagination] = useState({ page: 1, total_pages: 1, total: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [page, setPage] = useState(1)

  const location = filters?.location?.trim() || undefined
  const maxCapacity = filters?.guests ? Number(filters.guests) : undefined

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    setPage(1)
    fetchHalls({
      page: 1,
      pageSize: PAGE_SIZE,
      location,
      maxCapacity: Number.isFinite(maxCapacity) ? maxCapacity : undefined,
    })
      .then((res) => {
        if (cancelled) return
        setHalls(res.data ?? [])
        setPagination(res.pagination ?? { page: 1, total_pages: 1, total: 0 })
      })
      .catch((err) => {
        if (cancelled) return
        setError(err instanceof ApiError ? err.message : 'Could not load halls. Please try again.')
        setHalls([])
      })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location, maxCapacity])

  async function goToPage(next) {
    if (next < 1 || next > pagination.total_pages || next === pagination.page) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetchHalls({
        page: next,
        pageSize: PAGE_SIZE,
        location,
        maxCapacity: Number.isFinite(maxCapacity) ? maxCapacity : undefined,
      })
      setHalls(res.data ?? [])
      setPagination(res.pagination)
      setPage(next)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load halls. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <section id="halls" className="scroll-mt-20 bg-page px-5 py-20 sm:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="max-w-2xl">
          <p className="text-sm font-semibold uppercase tracking-widest text-teal">Explore halls</p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-navy sm:text-4xl">
            Featured Community Halls
          </h2>
          <p className="mt-4 text-slate-600">
            A curated selection of venues for every kind of gathering. Live listings from the
            community hall catalogue.
          </p>
        </div>

        {loading ? (
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3" aria-label="Loading halls">
            {[0, 1, 2].map((i) => (
              <div key={i} className="animate-pulse overflow-hidden rounded-card border border-slate-200 bg-white">
                <div className="aspect-[4/3] bg-slate-200" />
                <div className="space-y-3 p-5">
                  <div className="h-5 w-2/3 rounded bg-slate-200" />
                  <div className="h-4 w-1/3 rounded bg-slate-200" />
                  <div className="h-4 w-full rounded bg-slate-200" />
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="mt-12 rounded-card border border-red-200 bg-red-50 p-10 text-center">
            <p className="font-semibold text-red-700">{error}</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-3 rounded-md border border-red-300 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-100"
            >
              Try again
            </button>
          </div>
        ) : halls.length === 0 ? (
          <div className="mt-12 rounded-card border border-dashed border-slate-300 bg-white p-10 text-center">
            <p className="font-semibold text-navy">No halls match your search.</p>
            <p className="mt-1 text-sm text-slate-500">
              Try a different location or a larger guest capacity.
            </p>
          </div>
        ) : (
          <>
            <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {halls.map((hall) => (
                <HallCard key={hall.id} hall={hall} />
              ))}
            </div>
            {pagination.total_pages > 1 && (
              <nav className="mt-8 flex items-center justify-center gap-3" aria-label="Hall pages">
                <button
                  type="button"
                  onClick={() => goToPage(page - 1)}
                  disabled={page <= 1}
                  className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-navy hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Previous
                </button>
                <span className="text-sm text-slate-500">
                  Page {page} of {pagination.total_pages} · {pagination.total} halls
                </span>
                <button
                  type="button"
                  onClick={() => goToPage(page + 1)}
                  disabled={page >= pagination.total_pages}
                  className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-navy hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Next
                </button>
              </nav>
            )}
          </>
        )}
      </div>
    </section>
  )
}
