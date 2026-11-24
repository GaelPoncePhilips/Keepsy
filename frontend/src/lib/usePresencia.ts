import { useEffect, useState } from 'react'

/**
 * Mantiene montado un overlay mientras corre su animación de salida.
 * `montado` cuelga el DOM; `cerrando` activa data-closing="true" (ver index.css).
 */
export function usePresencia(abierto: boolean, ms = 220): { montado: boolean; cerrando: boolean } {
  const [montado, setMontado] = useState(abierto)
  useEffect(() => {
    if (abierto) {
      const t = window.setTimeout(() => setMontado(true))
      return () => window.clearTimeout(t)
    }
    const t = window.setTimeout(() => setMontado(false), ms)
    return () => window.clearTimeout(t)
  }, [abierto, ms])
  return { montado: abierto || montado, cerrando: !abierto && montado }
}
