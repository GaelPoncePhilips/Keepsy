/**
 * Respuesta háptica (Vibration API). En iOS Safari no existe: las llamadas son no-op.
 * Patrones cortos, a la manera de Material: tick al tocar, "click" al confirmar, "heavy" al levantar/soltar.
 */
type Patron = 'tick' | 'click' | 'heavy' | 'exito' | 'error'

const PATRONES: Record<Patron, number | number[]> = {
  tick: 6,
  click: 14,
  heavy: 28,
  exito: [12, 40, 18],
  error: [30, 50, 30],
}

const KEY = 'keepsy.haptica'

export function hapticaActiva(): boolean {
  try {
    return localStorage.getItem(KEY) !== 'off'
  } catch {
    return true
  }
}

export function activarHaptica(v: boolean): void {
  try {
    localStorage.setItem(KEY, v ? 'on' : 'off')
  } catch {
    /* sin almacenamiento */
  }
}

export function vibrar(p: Patron = 'click'): void {
  if (!('vibrate' in navigator) || !hapticaActiva()) return
  // Sin un gesto previo del usuario Chrome bloquea la vibración y lo avisa en consola.
  if ('userActivation' in navigator && !navigator.userActivation.hasBeenActive) return
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
  try {
    navigator.vibrate(PATRONES[p])
  } catch {
    /* el navegador lo bloquea sin gesto del usuario */
  }
}

const INTERACTIVO = 'button, a[href], [role="tab"], [role="switch"], [role="menuitem"], summary, label[for]'

/** Tick suave al tocar cualquier control de la app (un solo listener global). */
export function instalarHaptica(): void {
  window.addEventListener(
    'pointerdown',
    (e) => {
      if (e.pointerType === 'mouse') return
      const t = e.target
      if (!(t instanceof Element)) return
      const el = t.closest(INTERACTIVO)
      if (!el || (el instanceof HTMLButtonElement && el.disabled)) return
      vibrar('tick')
    },
    { passive: true },
  )
}
