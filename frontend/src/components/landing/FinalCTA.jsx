import { Link } from 'react-router-dom'

export function FinalCTA() {
  return (
    <section aria-labelledby="cta-heading" className="bg-navy px-5 py-20 sm:px-8">
      <div className="mx-auto flex max-w-4xl flex-col items-center text-center">
        <h2
          id="cta-heading"
          className="text-3xl font-bold tracking-tight text-white sm:text-4xl"
        >
          Ready to find your venue?
        </h2>
        <p className="mt-4 max-w-xl text-base leading-relaxed text-slate-300">
          Explore available community halls, submit a booking request, and let our administrators
          confirm the perfect space for your occasion.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
          <a
            href="#halls"
            className="rounded-md bg-teal px-7 py-3 text-sm font-semibold text-white transition-colors hover:bg-teal-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal focus-visible:ring-offset-2 focus-visible:ring-offset-navy"
          >
            Explore Available Halls
          </a>
          <Link
            to="/get-started"
            className="rounded-md border border-white/30 px-7 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            Get Started
          </Link>
        </div>
      </div>
    </section>
  )
}
