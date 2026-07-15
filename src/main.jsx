import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Capacitor } from '@capacitor/core'
import './index.css'
import App from './App.jsx'

// Service worker registration only applies to the web PWA. Skip it
// entirely inside the native iOS/Android app - Capacitor already bundles
// all static assets locally, so there's nothing for it to cache, and
// registering under the capacitor://localhost scheme throws
// "Invalid scriptURL scheme is not HTTP or HTTPS" since that's not a
// scheme service workers support.
if (!Capacitor.isNativePlatform()) {
  import('virtual:pwa-register').then(({ registerSW }) => {
    registerSW({ immediate: true })
  })
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
