import { Link } from 'react-router-dom'

const FOOTER_LINKS = [
  { label: 'Home', href: '#home' },
  { label: 'Explore Halls', href: '#halls' },
  { label: 'How It Works', href: '#how-it-works' },
  { label: 'Contact', href: '#contact' },
]

const FOOTER_ACTIONS = [{ label: 'Login', to: '/login' }]

const COPYRIGHT_YEAR = new Date().getFullYear()

export function Footer() {
  return (
    <footer id="contact" className="bg-navy text-slate-300">
      <div className="mx-auto grid max-w-7xl gap-10 px-5 py-14 sm:px-8 md:grid-cols-3">
        <div>
          <p className="text-lg font-bold tracking-tight text-white">Community Hall</p>
          <p className="mt-3 max-w-xs text-sm leading-relaxed text-slate-400">
            Discover and book trusted community halls for weddings, celebrations, meetings, and
            community events.
          </p>
        </div>

        <nav aria-label="Footer">
          <p className="text-sm font-semibold uppercase tracking-wider text-slate-400">Navigate</p>
          <ul className="mt-4 space-y-2.5">
            {FOOTER_LINKS.map((link) => (
              <li key={link.label}>
                <a
                  href={link.href}
                  className="rounded-sm text-sm text-slate-300 transition-colors hover:text-teal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal"
                >
                  {link.label}
                </a>
              </li>
            ))}
            {FOOTER_ACTIONS.map((link) => (
              <li key={link.label}>
                <Link
                  to={link.to}
                  className="rounded-sm text-sm text-slate-300 transition-colors hover:text-teal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div>
          <p className="text-sm font-semibold uppercase tracking-wider text-slate-400">Contact</p>
          <address className="mt-4 space-y-2.5 text-sm not-italic leading-relaxed text-slate-400">
            <p>hello@communityhall.example</p>
            <p>+1 (555) 010-2030</p>
            <p>123 Example Avenue, Sample City</p>
          </address>
        </div>
      </div>

      <div className="border-t border-white/10">
        <p className="mx-auto max-w-7xl px-5 py-5 text-xs text-slate-500 sm:px-8">
          © {COPYRIGHT_YEAR} Community Hall. All rights reserved. Hall listings shown are
          sample content for preview.
        </p>
      </div>
    </footer>
  )
}
