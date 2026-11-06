import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { fetchDashboard } from '../../services/admin'
import { ApiError } from '../../services/api'

function StatCard({ label, value, sub, to }) {
  const inner = (
    <div className="rounded-card border border-slate-200 bg-white p-5 shadow-card">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-2 text-3xl font-bold text-navy">{value}</p>
      {sub && <p className="mt-1 text-xs text-slate-400">{sub}</p>}
    </div>
  )
  return to ? <Link to={to} className="block transition-shadow hover:shadow-[0_8px_24px_rgba(11,31,58,0.08)]">{inner}</Link> : inner
}

export function AdminDashboardPage() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = () => {
    setLoading(true)
    setError(null)
    fetchDashboard()
      .then((res) => setData(res.data))
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Could not load dashboard.'))
      .finally(() => setLoading(false))
  }
  useEffect(load, [])

  if (loading) {
    return <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Loading dashboard">
      {[0,1,2,3,4,5,6,7].map((i) => <div key={i} className="h-28 animate-pulse rounded-card border border-slate-200 bg-white" />)}
    </div>
  }
  if (error) {
    return (
      <div className="rounded-card border border-red-200 bg-red-50 p-8 text-center">
        <p className="font-semibold text-red-700">{error}</p>
        <button type="button" onClick={load} className="mt-3 rounded-md border border-red-300 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-100">Try again</button>
      </div>
    )
  }
  if (!data) return null

  const b = data.bookings ?? {}
  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight text-navy">Overview</h1>
      <p className="mt-1 text-sm text-slate-500">Live statistics across halls, bookings, users and maintenance.</p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Halls" value={data.halls?.total ?? 0} sub={`${data.halls?.active ?? 0} active · ${data.halls?.inactive ?? 0} inactive · ${data.halls?.maintenance ?? 0} maintenance`} to="/admin/halls" />
        <StatCard label="Users" value={data.users?.total ?? 0} sub={`${data.users?.customers ?? 0} customers · ${data.users?.admins ?? 0} admins`} />
        <StatCard label="Pending requests" value={data.pending_requests ?? 0} sub="Awaiting review" to="/admin/bookings?status=pending" />
        <StatCard label="Upcoming approved" value={data.upcoming_approved_bookings ?? 0} sub="Starting in the future" to="/admin/bookings?status=approved" />
        <StatCard label="Active maintenance" value={data.active_maintenance_windows ?? 0} sub="Scheduled or in progress now" to="/admin/maintenance" />
        <StatCard label="Est. revenue" value={`$${Number(data.estimated_revenue ?? 0).toLocaleString()}`} sub="Approved upcoming bookings" />
      </div>

      <h2 className="mt-10 text-lg font-bold text-navy">Bookings by status</h2>
      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {['pending', 'approved', 'rejected', 'cancelled', 'completed'].map((s) => (
          <StatCard key={s} label={s[0].toUpperCase() + s.slice(1)} value={b[s] ?? 0} to={`/admin/bookings?status=${s}`} />
        ))}
      </div>
    </div>
  )
}
