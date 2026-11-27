import type { MouseEvent } from 'react'
import type { NavigateFunction, NavigateOptions, To } from 'react-router'

/**
 * Navega con un zoom tipo "container transform" (View Transitions API).
 * Adelante: lo nuevo crece desde atrás. Atrás (`atras` o `to` numérico negativo): lo que se cierra se encoge.
 * Sin soporte o con reduced-motion se navega directo (la entrada `.anim-page` ya hace el zoom/fade).
 */
export function navegarConZoom(navigate: NavigateFunction, to: To | number, opts: NavigateOptions & { atras?: boolean } = {}) {
  const { atras = typeof to === 'number' && to < 0, ...navOpts } = opts
  // Sin View Transitions: con <BrowserRouter> la navegación va en una transición de React y el callback
  // de startViewTransition no llegaba a navegar (el post no se abría). El zoom lo hace `.anim-page`,
  // que lee data-dir para elegir sentido: adelante crece, atrás vuelve desde más grande.
  const html = document.documentElement
  html.dataset.dir = atras ? 'atras' : 'adelante'
  window.setTimeout(() => delete html.dataset.dir, 450)
  if (typeof to === 'number') {
    if (to < 0) {
      // Evita retrocesos dobles (doble toque o efectos repetidos) que sacaban de la pantalla anterior.
      const ahora = Date.now()
      if (ahora - ultimoAtras < 400) return
      ultimoAtras = ahora
      // Sin historial dentro de la app (entrada directa o recarga): volver al inicio en vez de salir.
      if (!puedeVolver()) {
        void navigate('/', { replace: true })
        return
      }
    }
    void navigate(to)
  } else void navigate(to, navOpts)
}

let ultimoAtras = 0

/** react-router guarda el índice de la entrada en history.state.idx: 0 = primera página de la app. */
export function puedeVolver(): boolean {
  const st: unknown = window.history.state
  const idx = st && typeof st === 'object' && 'idx' in st ? Number((st as { idx: unknown }).idx) : 0
  return idx > 0
}

/** onClick para un <Link>: intercepta el clic normal y navega con zoom (respeta cmd/ctrl-clic). */
export function clicConZoom(navigate: NavigateFunction, to: To, opts?: NavigateOptions) {
  return (e: MouseEvent<HTMLAnchorElement>) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
    e.preventDefault()
    navegarConZoom(navigate, to, opts)
  }
}
