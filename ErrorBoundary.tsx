import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorInfo?: ErrorInfo;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
  };

  public static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI.
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // You can also log the error to an error reporting service
    console.error("Uncaught error:", error, errorInfo);
    this.setState({ errorInfo });
  }

  public render() {
    if (this.state.hasError) {
      // You can render any custom fallback UI
      return (
        <div style={{ 
          margin: '20px', 
          padding: '20px', 
          border: '1px solid #ef4444', // red-500
          borderRadius: '8px', 
          backgroundColor: '#fee2e2', // red-100
          color: '#7f1d1d', // red-900
          fontFamily: 'sans-serif'
        }}>
          <h1 style={{ fontSize: '1.5em', color: '#b91c1c' /* red-700 */ }}>Algo salió mal.</h1>
          <p style={{ marginTop: '10px' }}>La aplicación ha encontrado un error y no puede continuar.</p>
          <p style={{ marginTop: '5px' }}>Por favor, intente recargar la página. Si el problema persiste, contacte a soporte.</p>
          <details style={{ 
            marginTop: '15px', 
            padding: '10px', 
            backgroundColor: '#fef2f2', // red-50 
            border: '1px solid #fca5a5', // red-300
            borderRadius: '4px',
            whiteSpace: 'pre-wrap', 
            textAlign: 'left', 
            maxHeight: '300px', 
            overflowY: 'auto',
            fontSize: '0.875em',
            color: '#3f3f46' // zinc-700
          }}>
            <summary style={{ cursor: 'pointer', fontWeight: 'bold' }}>Detalles del Error</summary>
            {this.state.error && this.state.error.toString()}
            <br />
            {this.state.errorInfo && this.state.errorInfo.componentStack}
          </details>
          <button
            onClick={() => window.location.reload()}
            style={{
              marginTop: '20px',
              padding: '10px 20px',
              border: 'none',
              borderRadius: '4px',
              backgroundColor: '#dc2626', // red-600
              color: 'white',
              cursor: 'pointer',
              fontSize: '1em'
            }}
          >
            Recargar Página
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
