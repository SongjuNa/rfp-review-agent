import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './mockup/Main.css'
import App from './App.tsx'
import { SessionProvider } from './shell/session'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SessionProvider>
      <App />
    </SessionProvider>
  </StrictMode>,
)
