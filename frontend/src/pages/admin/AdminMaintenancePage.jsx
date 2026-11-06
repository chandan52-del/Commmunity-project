import { useCallback, useEffect, useState } from 'react'
import { fetchMaintenance, createMaintenance, updateMaintenance, cancelMaintenance, fetchAdminHalls } from '../../services/admin'
import { ApiError } from '../../services/api'
import { formatDT } from '../customer/MyBookingsPage'

const inputCls =
  'w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-navy focus:border-teal focus:outline-none focus:ring-2 focus:ring-teal/30'
const STATUSES = ['scheduled', 'in_progress', 'completed', 'cancelled']
const ACTIVE = ['scheduled', 'in_progress']

const EMPTY = { hall_id: '', title: '', reason: '', start_at: '', end_at: '', status: 'scheduled' }

function toLocalInput(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}
const fromLocalInput = (v) => (v ? new Date(v).toISOString() : null)

function MaintFormModal({ initial, halls, onClose, onSaved }) {
  const isEdit = Boolean(initial)
  const [form, setForm] = useState({
    ...EMPTY,
    ...(initial ? {
      hall_id: String(initial.hall_id),
      title: initial.title,
      reason: initial.reason ?? '',
      start_at: toLocalInput(initial.start_at),
      end_at: toLocalInput(initial.end_at),
      status: initial.status,
    } : {}),
  })
  const [errors, setErrors] = useState({})
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  async function submit(e) {
    e.preventDefault()
    if (saving) return
    setErrors({}); setError(null)
    const fe = {}
    if (!form.hall_id) fe.hall_id = 'Hall is required'
    if (form.title.trim().length < 2) fe.title = 'Title is required'
    if (!form.start_at || !form.end_at) { fe.start_at = 'Start is required'; fe.end_at = 'End is required' }
    else if (new Date(form.end_at) <= new Date(form.start_at)) fe.end_at = 'End must be after start'
    if (Object.values(fe).some(Boolean)) { setErrors(fe); return }

    const body = {
      hall_id: Number(form.hall_id),
      title: form.title.trim(),
      reason: form.reason.trim() || null,
      start_at: fromLocalInput(form.start_at),
      end_at: fromLocalInput(form.end_at),
      ...(isEdit ? { status: form.status } : {}),
    }
    setSaving(true)
    try {
      if (isEdit) await updateMaintenance(initial.id, body)
      else await createMaintenance(body)
      onSaved()
    } catch (err) {
      if (err instanceof ApiError && Array.isArray(err.details)) {
        const map = {}
        for (const d of err.details) if (d.field && !map[d.field]) map[d.field] = d.message
        setErrors(map)
      }
      setError(err?.message ?? 'Could not save maintenance window.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-navy/50 p-4" onClick={onClose} role="presentation">
      <div role="dialog" aria-modal="true" className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-card bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-xl font-bold text-navy">{isEdit ? 'Edit maintenance window' : 'Schedule maintenance'}</h2>
        {error && <p role="alert" className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        <form onSubmit={submit} className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Hall <span className="text-red-500">*</span></label>
            <select value={form.hall_id} onChange={set('hall_id')} className={inputCls}>
              <option value="">Select a hall…</option>
              {halls.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
            </select>
            {errors.hall_id && <p className="mt-1 text-xs text-red-600">{errors.hall_id}</p>}
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Title <span className="text-red-500">*</span></label>
            <input type="text" value={form.title} onChange={set('title')} className={inputCls} placeholder="e.g. HVAC servicing" />
            {errors.title && <p className="mt-1 text-xs text-red-600">{errors.title}</p>}
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Start <span className="text-red-500">*</span></label>
            <input type="datetime-local" value={form.start_at} onChange={set('start_at')} className={inputCls} />
            {errors.start_at && <p className="mt-1 text-xs text-red-600">{errors.start_at}</p>}
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">End <span className="text-red-500">*</span></label>
            <input type="datetime-local" value={form.end_at} onChange={set('end_at')} className={inputCls} />
            {errors.end_at && <p className="mt-1 text-xs text-red-600">{errors.end_at}</p>}
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Reason</label>
            <textarea rows={2} maxLength={2000} value={form.reason} onChange={set('reason')} className={inputCls} />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Status</label>
            <select value={form.status} onChange={set('status')} className={inputCls}>
              {STATUSES.map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
            </select>
            <p className="mt-1 text-xs text-slate-400">Transitions follow scheduled → in progress → completed; any active state can be cancelled.</p>
          </div>
          <div className="flex gap-3 sm:col-span-2">
            <button type="submit" disabled={saving} className="rounded-md bg-teal px-5 py-2.5 text-sm font-semibold text-white hover:bg-teal-400 disabled:opacity-60">
              {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Schedule window'}
            </button>
            <button type="button" onClick={onClose} className="rounded-md border border-slate-300 px-5 py-2.5 text-sm font-semibold text-navy hover:bg-slate-50">Cancel</button>
          </div>
        </form>
      </div>
    </div>
  )
}

export function AdminMaintenancePage() {
  const [windows, setWindows] = useState([])
  const [pagination, setPagination] = useState({ page: 1, total_pages: 1, total: 0 })
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState('')
  const [halls, setHalls] = useState([])
  const [modal, setModal] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [actionError, setActionError] = useState(null)

  const load = useCallback(async (p = page, s = statusFilter) => {
    setLoading(true); setError(null)
    try {
      const res = await fetchMaintenance({ page: p, pageSize: 20, status: s || undefined, sort: '-start_at' })
      setWindows(res.data ?? [])
      setPagination(res.pagination)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load maintenance windows.')
    } finally {
      setLoading(false)
    }
  }, [page, statusFilter])

  useEffect(() => { load() }, [page, statusFilter]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    fetchAdminHalls({ pageSize: 100 }).then((r) => setHalls(r.data ?? [])).catch(() => {})
  }, [])

  async function onCancel(m) {
    if (!window.confirm(`Cancel maintenance window "${m.title}"?`)) return
    setActionError(null)
    try {
      await cancelMaintenance(m.id)
      await load()
    } catch (err) {
      setActionError(err?.message ?? 'Could not cancel window.')
    }
  }

  const statusBadge = (s) => ({
    scheduled: 'bg-blue-100 text-blue-800',
    in_progress: 'bg-amber-100 text-amber-800',
    completed: 'bg-slate-200 text-slate-600',
    cancelled: 'bg-red-100 text-red-700',
  })[s] ?? 'bg-slate-100 text-slate-600'

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-navy">Maintenance</h1>
          <p className="mt-1 text-sm text-slate-500">{pagination.total} window{pagination.total === 1 ? '' : 's'}.</p>
        </div>
        <button type="button" onClick={() => setModal('create')} className="rounded-md bg-teal px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-400">
          + Schedule maintenance
        </button>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        {['', ...STATUSES].map((s) => (
          <button key={s} type="button" onClick={() => { setStatusFilter(s); setPage(1) }}
            className={`rounded-full px-3 py-1 text-xs font-semibold ${statusFilter === s ? 'bg-navy text-white' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}>
            {s ? s.replace('_', ' ') : 'All'}
          </button>
        ))}
      </div>

      {actionError && <p role="alert" className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{actionError}</p>}

      {loading ? (
        <div className="mt-6 space-y-3">{[0,1,2].map((i) => <div key={i} className="h-16 animate-pulse rounded-card border border-slate-200 bg-white" />)}</div>
      ) : error ? (
        <div className="mt-6 rounded-card border border-red-200 bg-red-50 p-8 text-center">
          <p className="font-semibold text-red-700">{error}</p>
          <button type="button" onClick={() => load()} className="mt-3 rounded-md border border-red-300 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-100">Try again</button>
        </div>
      ) : windows.length === 0 ? (
        <div className="mt-6 rounded-card border border-dashed border-slate-300 bg-white p-10 text-center">
          <p className="font-semibold text-navy">No maintenance windows.</p>
        </div>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-card border border-slate-200 bg-white shadow-card">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-400">
                <th className="px-4 py-3">Title</th><th className="px-4 py-3">Hall</th>
                <th className="px-4 py-3">When</th><th className="px-4 py-3">Reason</th>
                <th className="px-4 py-3">Status</th><th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {windows.map((m) => (
                <tr key={m.id}>
                  <td className="px-4 py-3 font-medium text-navy">{m.title}</td>
                  <td className="px-4 py-3 text-slate-600">{m.hall_name}</td>
                  <td className="px-4 py-3 text-slate-600">{formatDT(m.start_at)}<br /><span className="text-xs text-slate-400">→ {formatDT(m.end_at)}</span></td>
                  <td className="max-w-[220px] truncate px-4 py-3 text-slate-500">{m.reason || '—'}</td>
                  <td className="px-4 py-3"><span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase ${statusBadge(m.status)}`}>{m.status.replace('_', ' ')}</span></td>
                  <td className="px-4 py-3 text-right">
                    <button type="button" onClick={() => setModal(m)} className="mr-2 rounded-md border border-slate-300 px-3 py-1.5 text-xs font-semibold text-navy hover:bg-slate-50">Edit</button>
                    {ACTIVE.includes(m.status) && (
                      <button type="button" onClick={() => onCancel(m)} className="rounded-md border border-red-300 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50">Cancel</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pagination.total_pages > 1 && (
        <nav className="mt-4 flex items-center justify-center gap-3">
          <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-navy disabled:opacity-40">Previous</button>
          <span className="text-sm text-slate-500">Page {pagination.page} of {pagination.total_pages}</span>
          <button type="button" disabled={page >= pagination.total_pages} onClick={() => setPage((p) => p + 1)} className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-navy disabled:opacity-40">Next</button>
        </nav>
      )}

      {modal && (
        <MaintFormModal
          initial={modal === 'create' ? null : modal}
          halls={halls}
          onClose={() => setModal(null)}
          onSaved={() => { setModal(null); load() }}
        />
      )}
    </div>
  )
}
