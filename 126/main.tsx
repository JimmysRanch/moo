import { createRoot } from 'react-dom/client'
import * as Sentry from '@sentry/react'
import "@github/spark/spark"

import App from './App.tsx'
import { ErrorFallback } from './ErrorFallback.tsx'
import { AppearanceProvider } from './hooks/useAppearance'
import { shouldRegisterServiceWorker } from './lib/service-worker'
import { initSentry } from './lib/sentry'

import "./main.css"
import "./styles/theme.css"
import "./index.css"

// Initialize Sentry before rendering
initSentry()

// One-time cleanup: remove stale "kv:" keys left over from pre-Supabase installs
try {
  const keysToRemove: string[] = []
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (key?.startsWith('kv:')) {
      keysToRemove.push(key)
    }
  }
  if (keysToRemove.length > 0) {
    keysToRemove.forEach((k) => localStorage.removeItem(k))
    localStorage.removeItem('demo-mode-enabled')
    localStorage.removeItem('demo-data-ids')
  }
} catch {
  // Ignore errors in restricted environments
}

if (shouldRegisterServiceWorker({
  hasServiceWorkerSupport: 'serviceWorker' in navigator,
  webdriver: navigator.webdriver ?? false,
})) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((error) => {
      console.error('Service worker registration failed:', error)
    })
  })
}

createRoot(document.getElementById('root')!).render(
  <Sentry.ErrorBoundary fallback={({ error, resetError }) => (
    <ErrorFallback error={error} resetErrorBoundary={resetError} />
  )}>
    <AppearanceProvider>
      <App />
    </AppearanceProvider>
  </Sentry.ErrorBoundary>
)
