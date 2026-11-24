/**
 * Focos de luz del blob (vidrio propio). Además del foco principal, que sigue a la pestaña activa,
 * cualquier pantalla puede encender focos extra de cualquier color mientras está montada.
 */
import { useEffect } from 'react'
import { create } from 'zustand'

export interface Luz {
  id: string
  /** Centro en px de la ventana (fixed). */
  x: number
  y: number
  /** Radio del halo en px. */
  radio: number
  /** Cualquier color CSS. */
  color: string
  /** 0–1. */
  intensidad: number
}

interface LucesState {
  luces: Luz[]
  poner: (l: Luz) => void
  quitar: (id: string) => void
}

export const useLuces = create<LucesState>((set, get) => ({
  luces: [],
  poner(l) {
    set({ luces: [...get().luces.filter((x) => x.id !== l.id), l] })
  },
  quitar(id) {
    set({ luces: get().luces.filter((x) => x.id !== id) })
  },
}))

/** Enciende un foco mientras el componente esté montado (null = apagado). */
export function useLuz(luz: Luz | null) {
  const poner = useLuces((s) => s.poner)
  const quitar = useLuces((s) => s.quitar)
  const clave = luz ? `${luz.id}|${luz.x}|${luz.y}|${luz.radio}|${luz.color}|${luz.intensidad}` : ''
  useEffect(() => {
    if (!luz) return
    poner(luz)
    return () => quitar(luz.id)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- la clave resume la luz
  }, [clave, poner, quitar])
}
