import { Link } from 'react-router-dom'

export default function NotFoundPage() {
  return (
    <main className="min-h-screen bg-workspace text-text-primary flex items-center justify-center px-6">
      <section className="max-w-md rounded-2xl border border-border bg-card p-6 text-center shadow-[0_8px_28px_rgba(0,0,0,0.16)]">
        <p className="mb-2 text-xs font-medium uppercase tracking-[0.16em] text-text-muted">
          404
        </p>
        <h1 className="mb-3 text-2xl font-semibold">Page not found</h1>
        <p className="mb-5 text-sm leading-6 text-text-secondary">
          This NavSlides route does not exist or the link is no longer valid.
        </p>
        <Link
          to="/"
          className="inline-flex min-h-10 items-center justify-center rounded-md bg-brand px-4 text-sm font-medium text-white hover:bg-brand-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-secondary"
        >
          Return to dashboard
        </Link>
      </section>
    </main>
  )
}
