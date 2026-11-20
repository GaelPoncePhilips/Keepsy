import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './app/App'
import { instalarRipple } from './components/ui/Feedback'
import './index.css'
import { instalarPwa } from './pwa'
import { useUi } from './stores/ui'
import { aplicarTema, instalarEsquema, vigilarEsquemaSistema } from './theme/color'
import { instalarHaptica } from './lib/haptics'
import { instalarMovimiento } from './theme/motion'

instalarEsquema()
instalarMovimiento()
aplicarTema(useUi.getState().tema)
instalarRipple()
vigilarEsquemaSistema()
instalarHaptica()
instalarPwa()

const root = document.getElementById('root')
if (!root) throw new Error('Falta #root')

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
