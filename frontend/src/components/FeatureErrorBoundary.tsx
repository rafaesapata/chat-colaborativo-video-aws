/**
 * Feature Error Boundary - Granular
 * Isola erros por feature para não derrubar toda a aplicação
 */

import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface FeatureErrorBoundaryProps {
  feature: string;
  fallback?: React.ReactNode;
  onError?: (error: Error, feature: string) => void;
  children: React.ReactNode;
  darkMode?: boolean;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

export class FeatureErrorBoundary extends React.Component<
  FeatureErrorBoundaryProps,
  State
> {
  state: State = { hasError: false, error: null, errorInfo: null };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error(`[${this.props.feature}] Error:`, error, errorInfo);
    this.props.onError?.(error, this.props.feature);

    this.setState({ errorInfo });

    // Reportar para serviço de monitoramento (se configurado)
    if (
      typeof window !== 'undefined' &&
      (window as unknown as { reportError?: (data: unknown) => void }).reportError
    ) {
      (window as unknown as { reportError: (data: unknown) => void }).reportError({
        feature: this.props.feature,
        error: error.message,
        stack: error.stack,
        componentStack: errorInfo.componentStack,
        timestamp: new Date().toISOString(),
      });
    }
  }

  retry = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render() {
    const { darkMode = false } = this.props;

    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div
          className={`p-4 rounded-lg ${
            darkMode ? 'bg-red-900/20 border-red-800' : 'bg-red-50 border-red-200'
          } border`}
        >
          <div className="flex items-start gap-3">
            <AlertTriangle
              className={`w-5 h-5 flex-shrink-0 ${
                darkMode ? 'text-red-400' : 'text-red-500'
              }`}
            />
            <div className="flex-1 min-w-0">
              <p
                className={`text-sm font-medium ${
                  darkMode ? 'text-red-300' : 'text-red-700'
                }`}
              >
                Erro em: {this.props.feature}
              </p>
              <p
                className={`text-xs mt-1 ${
                  darkMode ? 'text-red-400/70' : 'text-red-600/70'
                }`}
              >
                {this.state.error?.message || 'Erro desconhecido'}
              </p>
              <button
                onClick={this.retry}
                className={`mt-2 text-xs flex items-center gap-1 ${
                  darkMode
                    ? 'text-blue-400 hover:text-blue-300'
                    : 'text-blue-600 hover:text-blue-700'
                }`}
              >
                <RefreshCw className="w-3 h-3" />
                Tentar novamente
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// HOC para facilitar uso
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  feature: string
) {
  return function WrappedComponent(props: P & { darkMode?: boolean }) {
    return (
      <FeatureErrorBoundary feature={feature} darkMode={props.darkMode}>
        <Component {...props} />
      </FeatureErrorBoundary>
    );
  };
}
