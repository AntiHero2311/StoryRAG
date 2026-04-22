import { createRoot } from 'react-dom/client'
import { GoogleOAuthProvider } from '@react-oauth/google'
import './index.css'
import App from './App.jsx'
import { initializeThemeMode } from './utils/themeMode'

const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID
initializeThemeMode()

createRoot(document.getElementById('root')!).render(
  googleClientId ? (
    <GoogleOAuthProvider clientId={googleClientId}>
      <App />
    </GoogleOAuthProvider>
  ) : (
    <App />
  ),
)
