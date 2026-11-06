import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { SAMPLE_HALLS } from '../../data/sampleHalls'

function HallCard({ hall, onViewDetails }) {
  return (
    <article className="group flex flex-col overflow-hidden rounded-card border border-slate-200 bg-white shadow-card transition-shadow duration-300 hover:shadow-[0_16px_40px_rgba(11,31,58,0.12)]">
      <div className="relative aspect-[4/3] overflow-hidden">
        <img
          src={hall.image}
          alt={`${hall.name} — event venue in ${hall.location}`}
          loading="lazy"
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
        />
        <span className="absolute left-3 top-3 rounded-full bg-white/90 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-navy backdrop-blur-sm">
          Sample listing
        </span>
      </div>

      <div className="flex flex-1 flex-col p-5">
        <h3 className="text-lg font-bold tracking-tight text-navy">{hall.name}</h3>
        <p className="mt-1 text-sm text-slate-500">{hall.location}</p>

        <dl className="mt-4 flex items-center gap-5 text-sm text-slate-600">
          <div className="flex items-center gap-1.5">
            <svg viewBox="0 0 24 24" className="h-4 w-4 text-teal" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
            <dt className="sr-only">Capacity</dt>
            <dd>Up to {hall.capacity} guests</dd>
          </div>
        </dl>

        <p className="mt-3 line-clamp-2 text-sm leading-relaxed text-slate-500">
          {hall.description}
        </p>

        <button
          type="button"
          onClick={() => onViewDetails(hall)}
          className="mt-5 self-start rounded-md border border-navy/15 px-4 py-2 text-sm font-semibold text-navy transition-colors hover:border-teal hover:text-teal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal"
        >
          View Details
        </button>
      </div>
    </article>
  )
}

function HallDetailsModal({ hall, onClose }) {
  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = ''
    }
  }, [onClose])

  if (!hall) return null

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-navy/60 p-4 backdrop-blur-sm"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="hall-details-title"
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-card bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative aspect-[16/9]">
          <img src={hall.image} alt="" className="h-full w-full object-cover" />
          <button
            type="button"
            onClick={onClose}
            aria-label="Close details"
            className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-navy shadow-sm transition-colors hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path strokeLinecap="round" d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>

        <div className="p-6">
          <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Sample listing
          </span>
          <h3 id="hall-details-title" className="mt-3 text-2xl font-bold tracking-tight text-navy">
            {hall.name}
          </h3>
          <p className="mt-1 text-sm text-slate-500">{hall.location}</p>

          <p className="mt-4 text-sm leading-relaxed text-slate-600">{hall.description}</p>

          <dl className="mt-5 grid grid-cols-2 gap-4 rounded-lg bg-page p-4 text-sm">
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">Capacity</dt>
              <dd className="mt-1 font-semibold text-navy">Up to {hall.capacity} guests</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">Pricing</dt>
              <dd className="mt-1 font-semibold text-navy">On request</dd>
            </div>
          </dl>

          <div className="mt-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Amenities</p>
            <ul className="mt-2 flex flex-wrap gap-2">
              {hall.amenities.map((amenity) => (
                <li
                  key={amenity}
                  className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600"
                >
                  {amenity}
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-6 flex gap-3">
            <Link
              to="/get-started"
              onClick={onClose}
              className="flex-1 rounded-md bg-teal px-4 py-2.5 text-center text-sm font-semibold text-white transition-colors hover:bg-teal-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal"
            >
              Request Booking
            </Link>
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-slate-300 px-4 py-2.5 text-sm font-semibold text-navy transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal"
            >
              Close
            </button>
          </div>
          <p className="mt-3 text-center text-xs text-slate-400">
            Booking requests are reviewed by an administrator before confirmation.
          </p>
        </div>
      </div>
    </div>
  )
}

export function FeaturedHalls({ filters }) {
  const [selected, setSelected] = useState(null)

  const visibleHalls = SAMPLE_HALLS.filter((hall) => {
    if (filters.location && !hall.location.toLowerCase().includes(filters.location.toLowerCase())) {
      return false
    }
    if (filters.guests && hall.capacity > Number(filters.guests)) {
      return false
    }
    return true
  })

  return (
    <section id="halls" className="scroll-mt-20 bg-page px-5 py-20 sm:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="max-w-2xl">
          <p className="text-sm font-semibold uppercase tracking-widest text-teal">Explore halls</p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-navy sm:text-4xl">
            Featured Community Halls
          </h2>
          <p className="mt-4 text-slate-600">
            A curated selection of venues for every kind of gathering. Listings below are sample
            content for preview — live availability will connect to the booking API.
          </p>
        </div>

        {visibleHalls.length === 0 ? (
          <div className="mt-12 rounded-card border border-dashed border-slate-300 bg-white p-10 text-center">
            <p className="font-semibold text-navy">No halls match your search.</p>
            <p className="mt-1 text-sm text-slate-500">
              Try a different location or a larger guest capacity.
            </p>
          </div>
        ) : (
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {visibleHalls.map((hall) => (
              <HallCard key={hall.id} hall={hall} onViewDetails={setSelected} />
            ))}
          </div>
        )}
      </div>

      <HallDetailsModal hall={selected} onClose={() => setSelected(null)} />
    </section>
  )
}
