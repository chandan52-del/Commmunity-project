import { useCallback, useEffect, useState } from 'react'
import { fetchReports, fetchAdminHalls } from '../../services/admin'
import { ApiError } from '../../services/api'

const inputCls =
  'rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-navy focus:border-teal focus:outline-none focus:ring-2 focus:ring-teal/30'
const GROUP_BYS = [
  { value: 'status', label: 'By status' },
  { value: 'hall', label: 'By hall' },
  { value: 'month', label: 'By month' },
]

function defaultRange() {
  const to = new Date()
  const from = new Date()
  from.setMonth(from.getMonth() - 1)
  const f = (d) => d.toISOString().slice(0, 10)
  return { from: f(from), to: f(to) }
}

export function AdminReportsPage() {
  const [range, setRange] = useState(defaultRange)
  const [hallId, setHallId] = useState('')
  const [groupBy, setGroupBy] = useState('status')
  const [halls, setHalls] = useState([])
  const [report, setReport] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [searched, setSearched] = useState(false)

  useEffect(() => {
    fetchAdminHalls({ pageSize: 100 }).then((r) => setHalls(r.data ?? [])).catch(() => {})
  }, [])

  const run = useCallback(async () => {
    if (!range.from || !range.to) { setError('Please choose both start and end dates.'); return }
    setLoading(true); setError(null); setSearched(true)
    try {
      const from = new Date(`${range.from}T00:00:00.000Z`).toISOString()
      const toD = new Date(`${range.to}T00:00:00.000Z`)
      toD.setUTCDate(toD.getUTCDate() + 1)
      const res = await fetchReports({ from, to: toD.toISOString(), hallId: hallId || undefined, groupBy })
      setReport(res.data)
    } catch (err) {
      setReport(null)
      setError(err instanceof ApiError ? err.message : 'Could not load report.')
    } finally {
      setLoading(false)
    }
  }, [range, hallId, groupBy])

  const t = report?.totals
  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight text-navy">Reports</h1>
      <p className="mt-1 text-sm text-slate-500">Booking analytics over a date range (based on event start time).</p>

      <div className="mt-5 flex flex-wrap items-end gap-3 rounded-card border border-slate-200 bg-white p-4 shadow-card">
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">From</label>
          <input type="date" value={range.from} onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))} className={inputCls} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">To</label>
          <input type="date" value={range.to} onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))} className={inputCls} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Hall</label>
          <select value={hallId} onChange={(e) => setHallId(e.target.value)} className={inputCls}>
            <option value="">All halls</option>
            {halls.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Group by</label>
          <select value={groupBy} onChange={(e) => setGroupBy(e.target.value)} className={inputCls}>
            {GROUP_BYS.map((g) => <option key={g.value} value={g.value}>{g.label}</option>)}
          </select>
        </div>
        <button type="button" onClick={run} disabled={loading} className="rounded-md bg-navy px-5 py-2.5 text-sm font-semibold text-white hover:bg-navy/90 disabled:opacity-60">
          {loading ? 'Loading…' : 'Run report'}
        </button>
      </div>

      {error && <p role="alert" className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {report && t && (
        <>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ['Total bookings', t.bookings],
              ['Approved', t.approved],
              ['Pending', t.pending],
              ['Rejected', t.rejected],
              ['Cancelled', t.cancelled],
              ['Completed', t.completed],
              ['Quoted total', `$${Number(t.quoted_amount_total ?? 0).toLocaleString()}`],
            ].map(([label, v]) => (
              <div key={label} className="rounded-card border border-slate-200 bg-white p-4 shadow-card">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p>
                <p className="mt-1 text-2xl font-bold text-navy">{v}</p>
              </div>
            ))}
          </div>

          <h2 className="mt-8 text-lg font-bold text-navy">Breakdown</h2>
          {report.breakdown?.length ? (
            <div className="mt-3 overflow-x-auto rounded-card border border-slate-200 bg-white shadow-card">
              <table className="w-full min-w-[480px] text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-400">
                    <th className="px-4 py-3">{groupBy === 'status' ? 'Status' : groupBy === 'hall' ? 'Hall' : 'Month'}</th>
                    <th className="px-4 py-3">Bookings</th>
                    <th className="px-4 py-3">Quoted amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {report.breakdown.map((row) => (
                    <tr key={row.key}>
                      <td className="px-4 py-3 font-medium text-navy">{row.label ?? row.key}</td>
                      <td className="px-4 py-3 text-slate-600">{row.count}</td>
                      <td className="px-4 py-3 text-slate-600">${Number(row.quoted_amount ?? 0).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="mt-3 rounded-card border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
              No bookings in this range.
            </p>
          )}
        </>
      )}

      {!report && !loading && searched === false && (
        <p className="mt-8 text-sm text-slate-400">Choose a date range and run the report.</p>
      )}
    </div>
  )
}
