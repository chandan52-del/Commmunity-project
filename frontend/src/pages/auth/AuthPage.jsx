import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { ApiError } from '../../services/api'

const inputCls =
  'w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-navy placeholder:text-slate-400 focus:border-teal focus:outline-none focus:ring-2 focus:ring-teal/30'

export function AuthPage({ mode = 'login' }) {
  const isLogin = mode === 'login'
  const { login, register } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const [form, setForm] = useState({ full_name: '', email: '', phone: '', password: '' })
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState(null)
  const [fieldErrors, setFieldErrors] = useState({})
  const [loading, setLoading] = useState(false)

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  async function onSubmit(e) {
    e.preventDefault()
    if (loading) return
    setError(null)
    setFieldErrors({})

    const fe = {}
    if (!isLogin) {
      if (form.full_name.trim().length < 2) fe.full_name = 'Full name is required'
      if (form.password.length < 8) fe.password = 'Password must be at least 8 characters'
      if (form.password !== confirm) fe.confirm = 'Passwords do not match'
    } else if (!form.email || !form.password) {
      fe.email = !form.email ? 'Email is required' : undefined
      fe.password = !form.password ? 'Password is required' : undefined
    }
    if (Object.values(fe).some(Boolean)) {
      setFieldErrors(fe)
      return
    }

    setLoading(true)
    try {
      if (isLogin) {
        await login({ email: form.email.trim(), password: form.password })
      } else {
        await register({
          full_name: form.full_name.trim(),
          email: form.email.trim(),
          phone: form.phone.trim() || undefined,
          password: form.password,
        })
      }
      // Admin area does not exist yet — all roles land on a safe existing route.
      const from = location.state?.from
      navigate(from && from.startsWith('/') ? from : '/')
    } catch (err) {
      if (err instanceof ApiError && Array.isArray(err.details)) {
        const map = {}
        for (const d of err.details) if (d.field && !map[d.field]) map[d.field] = d.message
        setFieldErrors(map)
      }
      setError(err?.message ?? 'Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const Field = ({ name, label, type = 'text', required, autoComplete, ...props }) => (
    <div>
      <label htmlFor={name} className="mb-1 block text-sm font-medium text-navy">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        required={required}
        autoComplete={autoComplete}
        value={form[name] ?? ''}
        onChange={set(name)}
        className={inputCls}
        {...props}
      />
      {fieldErrors[name] && <p className="mt-1 text-xs text-red-600">{fieldErrors[name]}</p>}
    </div>
  )

  return (
    <main className="flex min-h-screen items-center justify-center bg-page px-5">
      <div className="w-full max-w-md rounded-card border border-slate-200 bg-white p-8 shadow-card">
        <Link
          to="/"
          className="text-sm font-semibold text-teal hover:text-teal-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal"
        >
          ← Back to home
        </Link>
        <h1 className="mt-4 text-2xl font-bold tracking-tight text-navy">
          {isLogin ? 'Welcome back' : 'Create your account'}
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          {isLogin
            ? 'Sign in to manage your hall bookings.'
            : 'Get started by creating a free account to request hall bookings.'}
        </p>

        {error && (
          <div role="alert" className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        <form onSubmit={onSubmit} className="mt-6 space-y-4" noValidate>
          {!isLogin && (
            <>
              <Field name="full_name" label="Full name" required autoComplete="name" />
              <Field name="phone" label="Phone (optional)" type="tel" autoComplete="tel" />
            </>
          )}
          <Field name="email" label="Email" type="email" required autoComplete="email" />
          <Field name="password" label="Password" type="password" required autoComplete={isLogin ? 'current-password' : 'new-password'} />
          {!isLogin && (
            <div>
              <label htmlFor="confirm" className="mb-1 block text-sm font-medium text-navy">
                Confirm password <span className="text-red-500">*</span>
              </label>
              <input
                id="confirm"
                name="confirm"
                type="password"
                required
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className={inputCls}
              />
              {fieldErrors.confirm && <p className="mt-1 text-xs text-red-600">{fieldErrors.confirm}</p>}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md bg-navy px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-navy/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? 'Please wait…' : isLogin ? 'Login' : 'Create Account'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-500">
          {isLogin ? 'New here? ' : 'Already have an account? '}
          <Link
            to={isLogin ? '/get-started' : '/login'}
            className="font-semibold text-teal hover:text-teal-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal"
          >
            {isLogin ? 'Get started' : 'Login'}
          </Link>
        </p>
      </div>
    </main>
  )
}
