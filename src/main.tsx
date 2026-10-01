import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { pruneCache } from './data/cache'
import { applyStartupLink } from './lib/deeplink'
import { isStandalone } from './lib/pwa'

applyStartupLink(location.search, isStandalone())
// Keep IndexedDB bounded: drop forecasts nobody has looked at for 3 weeks.
void pruneCache(21 * 24 * 3600 * 1000)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
