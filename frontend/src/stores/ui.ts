/** Estado de UI global: snackbars, selector "Crear", paneles laterales y tema. */
import { create } from 'zustand'
import { aplicarTema, type Tema } from '../theme/color'

export interface Snack {
  id: number
  texto: string
  accion?: { label: string; onClick: () => void }
}

export type Panel = 'notificaciones' | 'buscar' | null

interface UiState {
  snacks: Snack[]
  crearAbierto: boolean
  panel: Panel
  tema: Tema
  snackbar: (texto: string, accion?: Snack['accion']) => void
  cerrarSnack: (id: number) => void
  setCrear: (v: boolean) => void
  setPanel: (p: Panel) => void
  setTema: (t: Tema) => void
  estilo: Estilo
  setEstilo: (e: Partial<Estilo>) => void
}

/** Estilo visual: clásica (tipo Instagram) o blob, con sus variantes de bordes y anillos. */
export interface Estilo {
  ui: 'clasica' | 'blob'
  bordes: 'irregulares' | 'solidos'
  anillos: 'formas' | 'regulares'
}
try {
  localStorage.removeItem('keepsy.estilo')
} catch {
  /* sin almacenamiento */
}
/** Interfaz fija: blob con bordes sólidos y formas de estrella de 8 puntas en todos lados (sin selector). */
const ESTILO_DEF: Estilo = { ui: 'blob', bordes: 'solidos', anillos: 'formas' }
function estiloInicial(): Estilo {
  return ESTILO_DEF
}
function aplicarEstilo(e: Estilo) {
  document.documentElement.dataset.estilo = e.ui
  document.documentElement.dataset.bordes = e.ui === 'blob' ? e.bordes : ''
}

const TEMA_KEY = 'keepsy.tema'
function temaInicial(): Tema {
  try {
    const t = localStorage.getItem(TEMA_KEY)
    return t === 'claro' || t === 'sistema' ? t : 'oscuro'
  } catch {
    return 'oscuro'
  }
}

let snackSeq = 0

export const useUi = create<UiState>((set, get) => ({
  snacks: [],
  crearAbierto: false,
  panel: null,
  tema: temaInicial(),
  estilo: estiloInicial(),
  setEstilo(parcial) {
    const e = { ...get().estilo, ...parcial }
    aplicarEstilo(e)
    set({ estilo: e })
  },
  snackbar(texto, accion) {
    const id = ++snackSeq
    set({ snacks: [...get().snacks.slice(-2), { id, texto, accion }] })
    window.setTimeout(() => get().cerrarSnack(id), 4000)
  },
  cerrarSnack(id) {
    set({ snacks: get().snacks.filter((s) => s.id !== id) })
  },
  setCrear(v) {
    set({ crearAbierto: v })
  },
  setPanel(p) {
    set({ panel: get().panel === p ? null : p })
  },
  setTema(t) {
    try {
      localStorage.setItem(TEMA_KEY, t)
    } catch {
      /* sin almacenamiento */
    }
    aplicarTema(t)
    set({ tema: t })
  },
}))

aplicarEstilo(useUi.getState().estilo)

/** Atajo para mostrar un snackbar desde cualquier lado. */
export const snackbar = (texto: string, accion?: Snack['accion']) => useUi.getState().snackbar(texto, accion)
