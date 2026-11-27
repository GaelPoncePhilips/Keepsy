/**
 * Revalidación automática: los datos en pantalla (useAsync) se vuelven a pedir por detrás, sin loader,
 * cuando el usuario hace una acción que cambia datos o vuelve a la app. Así la interfaz refleja los
 * cambios sin recargar la página.
 */
const EVENTO = 'keepsy:revalidar'
let timer = 0

export function revalidarTodo(demora = 350): void {
  window.clearTimeout(timer)
  timer = window.setTimeout(() => window.dispatchEvent(new Event(EVENTO)), demora)
}

export function alRevalidar(fn: () => void): () => void {
  window.addEventListener(EVENTO, fn)
  return () => window.removeEventListener(EVENTO, fn)
}

/** Acciones que no cambian lo que se ve (vistas, marcar leído, subir archivos, sesión): no disparan revalidación. */
const SIN_EFECTO = /\/(vista|vistas|leida|leidas|leido|media|auth)(\/|$|\?)/

export function despuesDeMutar(method: string, path: string): void {
  if (method === 'GET' || SIN_EFECTO.test(path)) return
  revalidarTodo()
}

// Volver a la app (cambiar de pestaña, desbloquear el teléfono): revalidar si pasó un rato.
let ultimaVez = Date.now()
function alVolver() {
  if (document.visibilityState !== 'visible') return
  if (Date.now() - ultimaVez < 15_000) return
  ultimaVez = Date.now()
  revalidarTodo(0)
}
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') ultimaVez = Date.now()
  else alVolver()
})
