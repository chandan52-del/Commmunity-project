export function LandingPage() {
  return (
    <main className="min-h-screen bg-page">
      <header className="bg-navy text-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <p className="text-lg font-semibold tracking-tight">Community Hall</p>
          <p className="text-sm text-white/70">Booking and Management</p>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-6 py-16">
        <p className="mb-3 text-sm font-semibold uppercase tracking-wide text-teal">
          Phase 0 scaffold
        </p>
        <h1 className="max-w-2xl text-4xl font-semibold tracking-tight text-navy">
          Book community halls with a clear availability calendar and admin approval workflow.
        </h1>
        <p className="mt-4 max-w-xl text-slate-600">
          Customer dashboards, hall listings, booking requests, and administration screens will
          be added on the frontend branch. The API contract is owned by Devin.
        </p>
        <div className="mt-8 inline-flex rounded-card bg-white px-5 py-3 text-sm font-medium text-teal shadow-card">
          Frontend scaffold is ready
        </div>
      </section>
    </main>
  )
}
