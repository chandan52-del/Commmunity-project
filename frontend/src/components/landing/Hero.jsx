import { Link } from 'react-router-dom'

export function Hero() {
  return (
    <section id="home" className="relative flex min-h-[92vh] items-center overflow-hidden">
      <img
        src="https://images.unsplash.com/photo-1519167758481-83f550bb49b3?auto=format&fit=crop&w=2000&q=80"
        alt="Elegant community hall set for an event with warm lighting and round tables"
        className="absolute inset-0 h-full w-full object-cover"
      />
      <div className="absolute inset-0 bg-navy/70" aria-hidden="true" />

      <div className="relative mx-auto w-full max-w-7xl px-5 pb-28 pt-32 sm:px-8">
        <div className="max-w-2xl">
          <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-widest text-teal-400 backdrop-blur-sm">
            Community venue booking
          </p>
          <h1 className="text-4xl font-bold leading-[1.1] tracking-tight text-white sm:text-5xl lg:text-6xl">
            Find the Perfect Space for Every Occasion.
          </h1>
          <p className="mt-6 max-w-xl text-base leading-relaxed text-slate-200 sm:text-lg">
            Discover trusted community halls for weddings, celebrations, meetings, and gatherings.
            Browse verified venues, check availability, and send booking requests for admin
            approval — all in one place.
          </p>
          <div className="mt-9 flex flex-wrap items-center gap-4">
            <a
              href="#halls"
              className="rounded-md bg-teal px-6 py-3 text-sm font-semibold text-white shadow-lg transition-colors hover:bg-teal-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal focus-visible:ring-offset-2 focus-visible:ring-offset-navy"
            >
              Explore Halls
            </a>
            <Link
              to="/get-started"
              className="rounded-md border border-white/40 bg-white/10 px-6 py-3 text-sm font-semibold text-white backdrop-blur-sm transition-colors hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              Get Started
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}
