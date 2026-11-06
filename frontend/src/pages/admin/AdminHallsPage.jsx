import { useCallback, useEffect, useState } from 'react'
import { fetchAdminHalls, createHall, updateHall, deactivateHall } from '../../services/admin'
import { ApiError } from '../../services/api'

const inputCls =
  'w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-navy focus:border-teal focus:outline-none focus:ring-2 focus:ring-teal/30'

const EMPTY_FORM = { name: '', description: '', location: '', capacity: '', base_price: '', cover_image_url: '', amenities: '', status: 'active' }

function HallFormModal({ initial, onClose, onSaved }) {
  const isEdit = Boolean(initial)
  const [form, setForm] = useState({ ...EMPTY_FORM, ...(initial ?? {}) })
  const [amenityText, setAmenityText] = useState((initial?.amenities ?? []).join(', '))
  const [errors, setErrors] = useState({})
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  async function submit(e) {
    e.preventDefault()
    if (saving) return
    setErrors({}); setError(null)
    const fe = {}
    if (form.name.trim().length < 2) fe.name = 'Name is required'
    if (!Number.isInteger(Number(form.capacity)) || Number(form.capacity) < 1) fe.capacity = 'Capacity must be a positive integer'
    if (!Number.isFinite(Number(form.base_price)) || Number(form.base_price) < 0) fe.base_price = 'Base price must be a number >= 0'
    if (Object.values(fe).some(Boolean)) { setErrors(fe); return }

    const body = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      location: form.location.trim() || null,
      capacity: Number(form.capacity),
      base_price: Number(form.base_price),
      cover_image_url: form.cover_image_url.trim() || null,
      amenities: amenityText.split(',').map((a) => a.trim()).filter(Boolean),
      ...(isEdit ? {} : {}),
    }
    if (isEdit) body.status = form.status

    setSaving(true)
    try {
      if (isEdit) await updateHall(initial.id, body)
      else await createHall(body)
      onSaved()
    } catch (err) {
      if (err instanceof ApiError && Array.isArray(err.details)) {
        const map = {}
        for (const d of err.details) if (d.field && !map[d.field]) map[d.field] = d.message
        setErrors(map)
      }
      setError(err?.message ?? 'Could not save hall.')
    } finally {
      setSaving(false)
    }
  }

  const Field = ({ k, label, type = 'text', required, ...props }) => (
    <div>
      <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <input type={type} value={form[k] ?? ''} onChange={set(k)} className={inputCls} {...props} />
      {errors[k] && <p className="mt-1 text-xs text-red-600">{errors[k]}</p>}
    </div>
  )

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-navy/50 p-4" onClick={onClose} role="presentation">
      <div role="dialog" aria-modal="true" className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-card bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-xl font-bold text-navy">{isEdit ? `Edit ${initial.name}` : 'Create hall'}</h2>
        {error && <p role="alert" className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        <form onSubmit={submit} className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2"><Field k="name" label="Name" required /></div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Description</label>
            <textarea rows={2} value={form.description ?? ''} onChange={set('description')} className={inputCls} />
          </div>
          <Field k="location" label="Location" />
          <Field k="capacity" label="Capacity" type="number" min="1" required />
          <Field k="base_price" label="Base price ($)" type="number" min="0" step="0.01" required />
          <Field k="cover_image_url" label="Cover image URL" type="url" placeholder="https://…" />
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Amenities (comma-separated)</label>
            <input type="text" value={amenityText} onChange={(e) => setAmenityText(e.target.value)} className={inputCls} placeholder="Stage, Sound system, Parking" />
          </div>
          {isEdit && (
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Status</label>
              <select value={form.status} onChange={set('status')} className={inputCls}>
                <option value="active">active</option>
                <option value="inactive">inactive</option>
                <option value="maintenance">maintenance</option>
              </select>
            </div>
          )}
          <div className="flex gap-3 sm:col-span-2">
            <button type="submit" disabled={saving} className="rounded-md bg-teal px-5 py-2.5 text-sm font-semibold text-white hover:bg-teal-400 disabled:opacity-60">
              {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Create hall'}
            </button>
            <button type="button" onClick={onClose} className="rounded-md border border-slate-300 px-5 py-2.5 text-sm font-semibold text-navy hover:bg-slate-50">
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export function AdminHallsPage() {
  const [halls, setHalls] = useState([])
  const [pagination, setPagination] = useState({ page: 1, total_pages: 1, total: 0 })
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [modal, setModal] = useState(null) // 'create' | hall object
  const [deactivating, setDeactivating] = useState(null)
  const [actionError, setActionError] = useState(null)

  const load = useCallback(async (p = page, s = search) => {
    setLoading(true); setError(null)
    try {
      const res = await fetchAdminHalls({ page: p, pageSize: 20, search: s || undefined, sort: 'name' })
      setHalls(res.data ?? [])
      setPagination(res.pagination)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load halls.')
    } finally {
      setLoading(false)
    }
  }, [page, search])

  useEffect(() => { load() }, [page]) // eslint-disable-line react-hooks/exhaustive-deps

  async function onDeactivate(hall) {
    if (!window.confirm(`Deactivate "${hall.name}"? It will no longer appear in public listings.`)) return
    setDeactivating(hall.id); setActionError(null)
    try {
      await deactivateHall(hall.id)
      await load()
    } catch (err) {
      setActionError(`${hall.name}: ${err?.message ?? 'Deactivation failed'}`)
    } finally {
      setDeactivating(null)
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-navy">Halls</h1>
          <p className="mt-1 text-sm text-slate-500">{pagination.total} active hall{pagination.total === 1 ? '' : 's'} listed.</p>
        </div>
        <button type="button" onClick={() => setModal('create')} className="rounded-md bg-teal px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-400">
          + Create hall
        </button>
      </div>

      <form
        className="mt-5 flex gap-3"
        onSubmit={(e) => { e.preventDefault(); setPage(1); load(1, search) }}
      >
        <input
          type="search" value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name, location or description…"
          className="w-full max-w-md rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-teal focus:outline-none focus:ring-2 focus:ring-teal/30"
        />
        <button type="submit" className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-navy hover:bg-slate-50">Search</button>
      </form>

      {actionError && <p role="alert" className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{actionError}</p>}

      {loading ? (
        <div className="mt-6 space-y-3">{[0,1,2].map((i) => <div key={i} className="h-16 animate-pulse rounded-card border border-slate-200 bg-white" />)}</div>
      ) : error ? (
        <div className="mt-6 rounded-card border border-red-200 bg-red-50 p-8 text-center">
          <p className="font-semibold text-red-700">{error}</p>
          <button type="button" onClick={() => load()} className="mt-3 rounded-md border border-red-300 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-100">Try again</button>
        </div>
      ) : halls.length === 0 ? (
        <div className="mt-6 rounded-card border border-dashed border-slate-300 bg-white p-10 text-center">
          <p className="font-semibold text-navy">No halls found.</p>
        </div>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-card border border-slate-200 bg-white shadow-card">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-400">
                <th className="px-4 py-3">Name</th><th className="px-4 py-3">Location</th>
                <th className="px-4 py-3">Capacity</th><th className="px-4 py-3">Base price</th>
                <th className="px-4 py-3">Status</th><th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {halls.map((h) => (
                <tr key={h.id}>
                  <td className="px-4 py-3 font-medium text-navy">{h.name}</td>
                  <td className="px-4 py-3 text-slate-500">{h.location ?? '—'}</td>
                  <td className="px-4 py-3 text-slate-600">{h.capacity}</td>
                  <td className="px-4 py-3 text-slate-600">${Number(h.base_price).toLocaleString()}</td>
                  <td className="px-4 py-3"><span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-semibold uppercase text-emerald-800">{h.status}</span></td>
                  <td className="px-4 py-3 text-right">
                    <button type="button" onClick={() => setModal(h)} className="mr-2 rounded-md border border-slate-300 px-3 py-1.5 text-xs font-semibold text-navy hover:bg-slate-50">Edit</button>
                    <button
                      type="button"
                      onClick={() => onDeactivate(h)}
                      disabled={deactivating === h.id}
                      className="rounded-md border border-red-300 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
                    >
                      {deactivating === h.id ? '…' : 'Deactivate'}
                    </button>
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
        <HallFormModal
          initial={modal === 'create' ? null : modal}
          onClose={() => setModal(null)}
          onSaved={() => { setModal(null); load() }}
        />
      )}
    </div>
  )
}
