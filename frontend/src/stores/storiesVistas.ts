/**
 * Stories que vi en esta sesión (para pintar el anillo como "visto" al volver del visor sin esperar
 * a que el servidor registre la vista) y mis propias stories ya miradas (el backend no cuenta las
 * vistas del dueño, así que se recuerdan en localStorage).
 */
import { create } from 'zustand'

const CLAVE = 'keepsy.stories.propiasVistas'

function leerPropias(): number[] {
  try {
    const v: unknown = JSON.parse(localStorage.getItem(CLAVE) ?? '[]')
    return Array.isArray(v) ? v.filter((x): x is number => typeof x === 'number') : []
  } catch {
    return []
  }
}

interface StoriesVistasState {
  vistas: Set<number>
  marcar: (id: number, propia?: boolean) => void
}

export const useStoriesVistas = create<StoriesVistasState>((set, get) => ({
  vistas: new Set(leerPropias()),
  marcar(id, propia = false) {
    if (get().vistas.has(id)) return
    const vistas = new Set(get().vistas)
    vistas.add(id)
    set({ vistas })
    if (propia) {
      try {
        // Solo las últimas 200: las stories vencen a las 24 h.
        localStorage.setItem(CLAVE, JSON.stringify([...leerPropias(), id].slice(-200)))
      } catch {
        /* almacenamiento no disponible */
      }
    }
  },
}))
