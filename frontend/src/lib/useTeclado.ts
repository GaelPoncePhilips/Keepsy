import { useEffect, useState } from 'react'

const ES_CAMPO = (el: Element | null) =>
  !!el &&
  (el instanceof HTMLTextAreaElement ||
    (el instanceof HTMLInputElement && !['checkbox', 'radio', 'button', 'submit', 'range', 'file', 'color'].includes(el.type)) ||
    (el instanceof HTMLElement && el.isContentEditable))

/**
 * Teclado en pantalla abierto (móvil). Con el teclado, Android achica la ventana y iOS desplaza el
 * viewport visual: una barra `position: fixed; bottom: 0` "se sube" pegada al teclado o queda flotando
 * a mitad de pantalla. Como Instagram, la barra inferior se oculta mientras se escribe.
 */
export function useTecladoAbierto(): boolean {
  const [abierto, setAbierto] = useState(false)
  useEffect(() => {
    if (!window.matchMedia('(pointer: coarse)').matches) return
    let timer = 0
    const revisar = () => {
      window.clearTimeout(timer)
      // Al pasar de un campo a otro hay un instante sin foco: esperar evita un parpadeo de la barra.
      timer = window.setTimeout(() => {
        const vv = window.visualViewport
        const achicado = vv ? window.innerHeight - vv.height > 120 : false
        setAbierto(ES_CAMPO(document.activeElement) || achicado)
      }, 60)
    }
    document.addEventListener('focusin', revisar)
    document.addEventListener('focusout', revisar)
    window.visualViewport?.addEventListener('resize', revisar)
    return () => {
      window.clearTimeout(timer)
      document.removeEventListener('focusin', revisar)
      document.removeEventListener('focusout', revisar)
      window.visualViewport?.removeEventListener('resize', revisar)
    }
  }, [])
  return abierto
}
