import { useEffect } from 'react'

const ESCRIBIENDO = 'input, textarea, select, [contenteditable="true"]'

/**
 * Flechas ↑/↓ (y J/K) saltan directo a la publicación siguiente/anterior (scroll suave, alineada arriba).
 * Se ignora mientras se escribe o hay un overlay abierto (que bloquea el scroll del body).
 */
export function useFlechasPublicaciones(selector: string, activo = true): void {
  useEffect(() => {
    if (!activo) return
    const h = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return
      const abajo = e.key === 'ArrowDown' || e.key === 'j'
      const arriba = e.key === 'ArrowUp' || e.key === 'k'
      if (!abajo && !arriba) return
      const t = e.target
      if (t instanceof Element && t.closest(ESCRIBIENDO)) return
      if (document.body.style.overflow === 'hidden') return
      const els = [...document.querySelectorAll<HTMLElement>(selector)]
      if (els.length === 0) return
      const margen = (el: HTMLElement) => parseFloat(getComputedStyle(el).scrollMarginTop) || 0
      const top = (el: HTMLElement) => el.getBoundingClientRect().top - margen(el)
      const destino = abajo ? els.find((el) => top(el) > 12) : [...els].reverse().find((el) => top(el) < -12)
      e.preventDefault()
      if (destino) destino.scrollIntoView({ behavior: 'smooth', block: 'start' })
      else window.scrollBy({ top: abajo ? window.innerHeight * 0.8 : -window.innerHeight, behavior: 'smooth' })
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [selector, activo])
}
