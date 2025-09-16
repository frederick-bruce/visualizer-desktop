import React from 'react'

interface Props { children: React.ReactNode; fallback?: React.ReactNode }
interface State { hasError: boolean; error?: any }

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false }
  static getDerivedStateFromError(error: any): State { return { hasError: true, error } }
  componentDidCatch(error: any, info: any) {
    // eslint-disable-next-line no-console
    console.error('[ErrorBoundary]', error, info)
  }
  reset = () => this.setState({ hasError: false, error: null })
  render() {
    if (this.state.hasError) {
      return this.props.fallback ?? (
        <div className="h-screen w-screen flex flex-col items-center justify-center gap-4 bg-neutral-950 text-white p-6">
          <h1 className="text-lg font-semibold">Something went wrong.</h1>
          <pre className="max-w-[680px] text-xs bg-black/40 p-3 rounded border border-white/10 overflow-auto">
            {String(this.state.error)}
          </pre>
          <button onClick={this.reset} className="px-3 py-1 rounded bg-white/10 hover:bg-white/20 border border-white/20">Retry</button>
        </div>
      )
    }
    return this.props.children
  }
}

export default ErrorBoundary
