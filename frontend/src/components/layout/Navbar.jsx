import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { cn } from '../../utils/cn'
import { useAuth } from '../../context/AuthContext'

const NAV_LINKS = [
  { label: 'Home', href: '#home' },
  { label: 'Explore Halls', href: '#halls' },
  { label: 'How It Works', href: '#how-it-works' },
  { label: 'Contact', href: '#contact' },
]

export function Navbar() {
  const [scrolled, setScrolled] = useState(false)
  const [open, setOpen] = useState(false)
  const { user, isAuthenticated, isAdmin, logout } = useAuth()
  const navigate = useNavigate()

  async function onLogout() {
    await logout()
    setOpen(false)
    navigate('/')
  }

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <header
      className={cn(
        'fixed inset-x-0 top-0 z-50 transition-all duration-300',
        scrolled
          ? 'border-b border-slate-200/70 bg-white/90 shadow-[0_4px_24px_rgba(11,31,58,0.06)] backdrop-blur-md'
          : 'bg-transparent',
      )}
    >
      <nav
        aria-label="Primary"
        className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 sm:px-8"
      >
        <Link
          to="/"
          className="flex items-center gap-2.5 rounded-md text-lg font-bold tracking-tight text-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal"
        >
          <span
            aria-hidden="true"
            className="flex h-9 w-9 items-center justify-center rounded-lg bg-navy text-white"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 21h18M5 21V7l7-4 7 4v14M9 21v-6h6v6" />
            </svg>
          </span>
          Community Hall
        </Link>

        <ul className="hidden items-center gap-1 lg:flex">
          {NAV_LINKS.map((link) => (
            <li key={link.label}>
              <a
                href={link.href}
                className={cn(
                  'rounded-md px-3.5 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal',
                  scrolled
                    ? 'text-navy hover:bg-slate-100 hover:text-teal'
                    : 'text-white/85 hover:bg-white/10 hover:text-white',
                )}
              >
                {link.label}
              </a>
            </li>
          ))}
        </ul>

        <div className="hidden items-center gap-3 lg:flex">
          {isAuthenticated ? (
            <>
              <Link
                to="/bookings"
                className={cn(
                  'rounded-md px-4 py-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal',
                  scrolled ? 'text-navy hover:bg-slate-100' : 'text-white hover:bg-white/10',
                )}
              >
                My Bookings
              </Link>
              {isAdmin && (
                <Link
                  to="/admin"
                  className={cn(
                    'rounded-md px-4 py-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal',
                    scrolled ? 'text-navy hover:bg-slate-100' : 'text-white hover:bg-white/10',
                  )}
                >
                  Admin
                </Link>
              )}
              <span className="max-w-[180px] truncate text-sm font-medium text-navy" title={user.email}>
                {user.full_name}
              </span>
              <button
                type="button"
                onClick={onLogout}
                className={cn(
                  'rounded-md px-4 py-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal',
                  scrolled ? 'text-navy hover:bg-slate-100' : 'text-white hover:bg-white/10',
                )}
              >
                Logout
              </button>
            </>
          ) : (
            <>
              <Link
                to="/login"
                className={cn(
                  'rounded-md px-4 py-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal',
                  scrolled
                    ? 'text-navy hover:bg-slate-100'
                    : 'text-white hover:bg-white/10',
                )}
              >
                Login
              </Link>
              <Link
                to="/get-started"
                className="rounded-md bg-teal px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-teal-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal focus-visible:ring-offset-2"
              >
                Get Started
              </Link>
            </>
          )}
        </div>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls="mobile-nav"
          aria-label={open ? 'Close menu' : 'Open menu'}
          className={cn(
            'flex h-10 w-10 items-center justify-center rounded-md lg:hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal',
            scrolled ? 'text-navy hover:bg-slate-100' : 'text-white hover:bg-white/10',
          )}
        >
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2">
            {open ? (
              <path strokeLinecap="round" d="M6 6l12 12M18 6L6 18" />
            ) : (
              <path strokeLinecap="round" d="M4 7h16M4 12h16M4 17h16" />
            )}
          </svg>
        </button>
      </nav>

      {open && (
        <div id="mobile-nav" className="border-t border-slate-200 bg-white px-5 pb-5 pt-2 lg:hidden">
          <ul className="flex flex-col">
            {NAV_LINKS.map((link) => (
              <li key={link.label}>
                <a
                  href={link.href}
                  onClick={() => setOpen(false)}
                  className="block rounded-md px-3 py-2.5 text-sm font-medium text-navy hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal"
                >
                  {link.label}
                </a>
              </li>
            ))}
            <li className="mt-2 flex gap-3">
              {isAuthenticated ? (
                <>
                  <Link
                    to="/bookings"
                    onClick={() => setOpen(false)}
                    className="flex-1 rounded-md border border-slate-300 px-4 py-2.5 text-center text-sm font-semibold text-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal"
                  >
                    My Bookings
                  </Link>
                  {isAdmin && (
                    <Link
                      to="/admin"
                      onClick={() => setOpen(false)}
                      className="flex-1 rounded-md border border-slate-300 px-4 py-2.5 text-center text-sm font-semibold text-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal"
                    >
                      Admin
                    </Link>
                  )}
                  <button
                    type="button"
                    onClick={onLogout}
                    className="flex-1 rounded-md bg-navy px-4 py-2.5 text-center text-sm font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal"
                  >
                    Logout
                  </button>
                  <span className="w-full truncate px-3 pt-1 text-center text-xs text-slate-400">{user.full_name}</span>
                </>
              ) : (
                <>
                  <Link
                    to="/login"
                    onClick={() => setOpen(false)}
                    className="flex-1 rounded-md border border-slate-300 px-4 py-2.5 text-center text-sm font-semibold text-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal"
                  >
                    Login
                  </Link>
                  <Link
                    to="/get-started"
                    onClick={() => setOpen(false)}
                    className="flex-1 rounded-md bg-teal px-4 py-2.5 text-center text-sm font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal"
                  >
                    Get Started
                  </Link>
                </>
              )}
            </li>
          </ul>
        </div>
      )}
    </header>
  )
}
