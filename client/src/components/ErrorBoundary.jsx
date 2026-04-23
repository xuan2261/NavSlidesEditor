import { Component } from 'react'

/**
 * React Error Boundary — catches rendering errors in child tree
 * and displays a recovery UI instead of white screen.
 */
class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, info) {
    console.error('ErrorBoundary caught:', error, info)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-10 text-center text-neutral-200 bg-panel min-h-screen flex flex-col items-center justify-center gap-4">
          <div className="text-5xl mb-2">⚠️</div>
          <h2 className="text-[22px] font-semibold">Something went wrong</h2>
          <p className="text-neutral-400 max-w-[480px] text-sm leading-relaxed">
            {this.state.error?.message || 'An unexpected error occurred.'}
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => this.setState({ hasError: false, error: null })}
              className="px-6 py-2.5 rounded-lg border-none bg-accent text-white text-sm cursor-pointer font-medium hover:bg-accent-hover"
            >
              Try Again
            </button>
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-2.5 rounded-lg border border-border bg-transparent text-neutral-200 text-sm cursor-pointer font-medium hover:bg-hover"
            >
              Reload Page
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

export default ErrorBoundary
