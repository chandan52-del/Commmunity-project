import { useState } from 'react'
import { GUEST_OPTIONS } from '../../data/sampleHalls'

const inputClass =
  'w-full rounded-md border border-slate-300 bg-white px-4 py-3 text-sm text-navy placeholder:text-slate-400 focus:border-teal focus:outline-none focus:ring-2 focus:ring-teal/30'

export function HallSearch({ onSearch }) {
  const [location, setLocation] = useState('')
  const [date, setDate] = useState('')
  const [guests, setGuests] = useState('')

  const handleSubmit = (event) => {
    event.preventDefault()
    onSearch({ location: location.trim(), date, guests })
    document.getElementById('halls')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <section aria-label="Search halls" className="relative z-10 -mt-20 px-5 sm:px-8">
      <form
        onSubmit={handleSubmit}
        className="mx-auto grid max-w-6xl gap-4 rounded-card border border-slate-200 bg-white p-5 shadow-card sm:grid-cols-2 lg:grid-cols-[1.2fr_1fr_1fr_auto] lg:items-end lg:p-6"
      >
        <div>
          <label htmlFor="search-location" className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
            Location
          </label>
          <input
            id="search-location"
            type="text"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="e.g. Riverside District"
            className={inputClass}
          />
        </div>

        <div>
          <label htmlFor="search-date" className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
            Event date
          </label>
          <input
            id="search-date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className={inputClass}
          />
        </div>

        <div>
          <label htmlFor="search-guests" className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
            Guest capacity
          </label>
          <select
            id="search-guests"
            value={guests}
            onChange={(e) => setGuests(e.target.value)}
            className={inputClass}
          >
            {GUEST_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <button
          type="submit"
          className="rounded-md bg-navy px-7 py-3 text-sm font-semibold text-white transition-colors hover:bg-navy-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal focus-visible:ring-offset-2"
        >
          Search
        </button>
      </form>
    </section>
  )
}
