// Catches a crash inside one page so the rest of the app (menu, other pages) keeps working.
// Keyed by route in App.jsx, so moving to another page clears the error.
import { Component } from 'react';

export default class PageErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('Page crashed:', error, info?.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="mx-auto max-w-xl px-4 pt-32 text-center">
        <p className="font-mono text-[10px] font-bold uppercase tracking-widest text-rose-300">Something went wrong</p>
        <h1 className="mt-2 text-2xl font-bold text-white">This page couldn't be shown</h1>
        <p className="mt-2 text-sm text-slate-400">{String(this.state.error.message || this.state.error)}</p>
        <div className="mt-5 flex justify-center gap-2">
          <button onClick={() => window.location.reload()}
            className="rounded-lg bg-cyan-400 px-4 py-2 text-sm font-bold text-slate-900 hover:bg-cyan-300">Reload</button>
          <a href="/" className="rounded-lg border border-white/15 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-white/5">Back to the campus</a>
        </div>
      </div>
    );
  }
}
