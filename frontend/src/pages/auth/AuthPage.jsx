import { Link } from 'react-router-dom'

export function AuthPage({ mode = 'login' }) {
  const isLogin = mode === 'login'

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

        <div className="mt-6 rounded-lg border border-dashed border-slate-300 bg-page p-4 text-sm text-slate-600">
          Authentication is not connected yet. The sign-in form will be enabled once the backend
          API is integrated.
        </div>

        <div className="mt-6 space-y-3">
          <button
            type="button"
            disabled
            className="w-full cursor-not-allowed rounded-md bg-navy/40 px-4 py-3 text-sm font-semibold text-white"
          >
            {isLogin ? 'Login' : 'Create Account'}
          </button>
          <p className="text-center text-sm text-slate-500">
            {isLogin ? 'New here? ' : 'Already have an account? '}
            <Link
              to={isLogin ? '/get-started' : '/login'}
              className="font-semibold text-teal hover:text-teal-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal"
            >
              {isLogin ? 'Get started' : 'Login'}
            </Link>
          </p>
        </div>
      </div>
    </main>
  )
}
