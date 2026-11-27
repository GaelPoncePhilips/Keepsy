/**
 * PWA: registro del service worker e instalación.
 * El SW solo se registra en el build de producción (en `vite dev` cachearía módulos en desarrollo)
 * y solo en contextos seguros (https o localhost), que es lo que exige el navegador.
 */
import { create } from 'zustand'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

interface PwaState {
  /** El navegador ofrece instalar (Chrome/Edge/Android). */
  instalable: boolean
  /** Ya corre como app instalada. */
  instalada: boolean
  instalar: () => Promise<void>
  /** Hoja con los pasos para instalar en iOS (Compartir → Agregar a inicio). */
  mostrarAyudaIos: boolean
  abrirAyudaIos: () => void
  cerrarAyudaIos: () => void
}

let diferido: BeforeInstallPromptEvent | null = null

const enStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true

export const usePwa = create<PwaState>((set) => ({
  instalable: false,
  instalada: enStandalone(),
  async instalar() {
    if (!diferido) return
    await diferido.prompt()
    const { outcome } = await diferido.userChoice
    diferido = null
    set({ instalable: false, instalada: outcome === 'accepted' })
  },
  mostrarAyudaIos: false,
  abrirAyudaIos: () => set({ mostrarAyudaIos: true }),
  cerrarAyudaIos: () => set({ mostrarAyudaIos: false }),
}))

/** iOS no tiene beforeinstallprompt: se instala con Compartir → "Agregar a inicio". Incluye iPadOS (que se anuncia como Macintosh). */
export const esIOS = () =>
  /iphone|ipad|ipod/i.test(navigator.userAgent) || (/macintosh/i.test(navigator.userAgent) && navigator.maxTouchPoints > 1)

/** Safari de iOS/iPadOS (no Chrome/Firefox/Edge/Opera ni webviews con otra marca). */
export const esSafariIOS = () => esIOS() && !/crios|fxios|edgios|opios|gsa\//i.test(navigator.userAgent)

/** Ya corre como app instalada (standalone). */
export const estaEnStandalone = enStandalone

export function instalarPwa(): void {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    diferido = e as BeforeInstallPromptEvent
    usePwa.setState({ instalable: true })
  })
  window.addEventListener('appinstalled', () => usePwa.setState({ instalable: false, instalada: true }))

  if (import.meta.env.PROD && 'serviceWorker' in navigator && window.isSecureContext) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch((err: unknown) => console.warn('No se pudo registrar el service worker', err))
    })
  }
}
