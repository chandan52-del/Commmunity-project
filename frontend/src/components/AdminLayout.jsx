import { useState } from 'react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { cn } from '../utils/cn'

const NAV = [
  { to: '/admin', label: 'Overview', end: true },
  { to: '/admin/halls', label: 'Halls' },
  { to: '/admin/bookings', label: 'Bookings' },
  { to: '/admin/maintenance', label: 'Maintenance' },
  { to: '/admin/reports', label: 'Reports' },
]

const linkCls = ({ isActive }) =>
  cn(
    'block rounded-md px-3 py-2 text-sm font-semibold transition-colors',
    isActive ? 'bg-teal/10 text-teal' : 'text-slate-600 hover:bg-slate-100 hover:text-navy',
  )

export function AdminLayout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [mobileOpen, setMobileOpen] = useState(false)

  async function onLogout() {
    await logout()
    navigate('/')
  }

  const sidebar = (
    <div className="flex h-full flex-col">
      <Link to="/admin" className="flex items-center gap-2 px-4 py-5 text-lg font-bold text-navy">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-navy text-white">
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 21h18M5 21V7l7-4 7 4v14M9 21v-6h6v6" />
          </svg>
        </span>
        Admin
      </Link>
      <nav className="flex-1 space-y-1 px-3" aria-label="Admin">
        {NAV.map((item) => (
          <NavLink key={item.to} to={item.to} end={item.end} onClick={() => setMobileOpen(false)} className={linkCls}>
            {item.label}
          </NavLink>
        ))}
      </nav>
      <div className="border-t border-slate-200 p-4">
        <p className="truncate text-sm font-medium text-navy">{user?.full_name}</p>
        <p className="text-xs text-slate-400">{user?.email}</p>
        <button
          type="button"
          onClick={onLogout}
          className="mt-3 w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-navy hover:bg-slate-50"
        >
          Logout
        </button>
        <Link to="/" className="mt-2 block text-center text-xs font-semibold text-teal hover:text-teal-400">
          ← Back to site
        </Link>
      </div>
    </div>
  )

  return (
    <div className="flex min-h-screen bg-page">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 border-r border-slate-200 bg-white lg:block">
        {sidebar}
      </aside>

      {/* Mobile top bar */}
      <div className="fixed inset-x-0 top-0 z-40 flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 lg:hidden">
        <Link to="/admin" className="text-lg font-bold text-navy">Admin</Link>
        <button
          type="button"
          onClick={() => setMobileOpen((v) => !v)}
          aria-expanded={mobileOpen}
          aria-label="Toggle admin menu"
          className="rounded-md p-2 text-navy hover:bg-slate-100"
        >
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2">
            {mobileOpen ? <path strokeLinecap="round" d="M6 6l12 12M18 6L6 18" /> : <path strokeLinecap="round" d="M4 7h16M4 12h16M4 17h16" />}
          </svg>
        </button>
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-navy/40" onClick={() => setMobileOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-64 bg-white shadow-xl">{sidebar}</aside>
        </div>
      )}

      <main className="flex-1 px-4 pb-10 pt-16 sm:px-6 lg:ml-60 lg:px-10 lg:pt-8">
        <Outlet />
      </main>
    </div>
  )
}
