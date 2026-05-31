import { Component } from 'react';

export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo);
    this.props.onError?.(error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }
      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
          <div className="bg-white p-8 rounded-xl shadow-lg max-w-md w-full text-center">
            <div className="text-5xl mb-4">⚠️</div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Algo salió mal</h2>
            <p className="text-sm text-gray-600 mb-2">
              Ocurrió un error inesperado. Recargá la página o volvé al inicio.
            </p>
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <pre className="text-xs text-red-600 bg-red-50 p-3 rounded mb-4 text-left overflow-auto max-h-32">
                {this.state.error.message}
                {this.state.error.stack && `\n\n${this.state.error.stack}`}
              </pre>
            )}
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => window.location.reload()}
                className="bg-indigo-600 text-white px-5 py-2 rounded-lg hover:bg-indigo-700 text-sm font-medium"
              >
                Recargar página
              </button>
              <button
                onClick={() => window.location.href = '/ventas'}
                className="bg-gray-200 text-gray-700 px-5 py-2 rounded-lg hover:bg-gray-300 text-sm font-medium"
              >
                Volver al inicio
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}