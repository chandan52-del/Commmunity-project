const STEPS = [
  {
    number: '01',
    title: 'Explore halls',
    description:
      'Browse community halls by location, capacity, and amenities to find a venue that fits your event.',
  },
  {
    number: '02',
    title: 'Submit booking request',
    description:
      'Pick your preferred date and send a booking request with your event details in a few steps.',
  },
  {
    number: '03',
    title: 'Wait for admin approval',
    description:
      'Every request is reviewed by an administrator to confirm availability and venue suitability.',
  },
  {
    number: '04',
    title: 'Confirm your booking',
    description:
      'Once approved, your booking is confirmed and managed from your dashboard.',
  },
]

export function HowItWorks() {
  return (
    <section id="how-it-works" className="scroll-mt-20 bg-white px-5 py-20 sm:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="max-w-2xl">
          <p className="text-sm font-semibold uppercase tracking-widest text-teal">How it works</p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-navy sm:text-4xl">
            Booking in four simple steps
          </h2>
          <p className="mt-4 text-slate-600">
            A transparent process from discovery to confirmation — no guesswork, no hidden steps.
          </p>
        </div>

        <ol className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((step) => (
            <li
              key={step.number}
              className="reveal rounded-card border border-slate-200 bg-page p-6 transition-shadow duration-300 hover:shadow-card"
            >
              <span
                aria-hidden="true"
                className="text-3xl font-bold text-teal/25"
              >
                {step.number}
              </span>
              <h3 className="mt-3 text-lg font-bold text-navy">{step.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{step.description}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}
