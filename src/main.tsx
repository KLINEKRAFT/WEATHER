import React from 'react';
import ReactDOM from 'react-dom/client';
import '@fontsource-variable/dm-sans';
import App from './App';
import './styles.css';

class AppBoundary extends React.Component<{ children: React.ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    if (this.state.failed)
      return (
        <main className="fatal-error">
          <h1>Let’s clear the air.</h1>
          <p>Something interrupted the app. Reload to try again.</p>
          <button onClick={() => location.reload()}>Reload weather</button>
        </main>
      );
    return this.props.children;
  }
}
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AppBoundary>
      <App />
    </AppBoundary>
  </React.StrictMode>,
);
