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
        <div style={{
          padding: 40,
          textAlign: 'center',
          color: '#e0e0e0',
          background: 'var(--bg-primary, #1a1a2e)',
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 16,
        }}>
          <div style={{ fontSize: 48, marginBottom: 8 }}>⚠️</div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 600 }}>Something went wrong</h2>
          <p style={{
            color: '#a0a0b0', maxWidth: 480, fontSize: 14, lineHeight: 1.6,
          }}>
            {this.state.error?.message || 'An unexpected error occurred.'}
          </p>
          <div style={{ display: 'flex', gap: 12 }}>
            <button
              onClick={() => this.setState({ hasError: false, error: null })}
              style={{
                padding: '10px 24px', borderRadius: 8, border: 'none',
                background: '#6366f1', color: '#fff', fontSize: 14,
                cursor: 'pointer', fontWeight: 500,
              }}
            >
              Try Again
            </button>
            <button
              onClick={() => window.location.reload()}
              style={{
                padding: '10px 24px', borderRadius: 8,
                border: '1px solid #444', background: 'transparent',
                color: '#e0e0e0', fontSize: 14, cursor: 'pointer', fontWeight: 500,
              }}
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
