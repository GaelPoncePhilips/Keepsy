/** Formas tipo Material 3 Expressive como clip-path: r(t) = 1 - amp + amp*cos(n*(t+rot)). */
const PUNTOS = 120

export const FORMAS = {
  circle: [0, 0, 0],
  cookie9: [9, 0.07, 0],
  clover4: [4, 0.13, Math.PI / 4],
  sunny8: [8, 0.09, 0],
  flower6: [6, 0.09, 0],
  cookie12: [12, 0.05, 0],
} as const satisfies Record<string, readonly [number, number, number]>

export type NombreForma = keyof typeof FORMAS
const NOMBRES = Object.keys(FORMAS) as NombreForma[]
const cache = new Map<NombreForma, string>()

const fmt = (v: number) => `${v.toFixed(2)}%`

function puntos(nombre: NombreForma): string[] {
  const [n, amp, rot] = FORMAS[nombre]
  return Array.from({ length: PUNTOS }, (_, i) => {
    const t = (i / PUNTOS) * 2 * Math.PI
    const r = 1 - amp + amp * Math.cos(n * (t + rot))
    return `${fmt(50 + 50 * r * Math.cos(t))} ${fmt(50 + 50 * r * Math.sin(t))}`
  })
}

export function formaPorNombre(nombre: NombreForma): string {
  let p = cache.get(nombre)
  if (!p) {
    p = `polygon(${puntos(nombre).join(', ')})`
    cache.set(nombre, p)
  }
  return p
}

/**
 * Forma única de TODAS las stories (fila del inicio, avatares con anillo, visor): círculo con anillos
 * "regulares" o la galleta de 8 lóbulos con "irregulares". Antes variaba por usuario y se veía desprolijo.
 */
export function formaStory(regulares: boolean): string {
  return formaPorNombre(regulares ? 'circle' : 'sunny8')
}

/** Fondo del anillo de story según su estado (tokens de index.css). */
export function fondoAnillo(anillo: 'ninguno' | 'sin-ver' | 'visto' | 'amigos'): string | undefined {
  if (anillo === 'sin-ver') return 'var(--keepsy-story-nueva)'
  if (anillo === 'visto') return 'var(--keepsy-story-vista)'
  if (anillo === 'amigos') return 'var(--keepsy-story-amigos)'
  return undefined
}

/** Forma determinística por semilla (hash FNV-1a). */
export function formaPara(semilla: string): string {
  let h = 0x811c9dc5
  for (let i = 0; i < semilla.length; i++) h = Math.imul(h ^ semilla.charCodeAt(i), 0x01000193)
  return formaPorNombre(NOMBRES[(h >>> 0) % NOMBRES.length])
}

/** Self-check: 120 puntos, todos entre 0% y 100%. No se llama en runtime. */
export function __checkFormas(): void {
  for (const nombre of NOMBRES) {
    const pts = puntos(nombre)
    if (pts.length !== PUNTOS) throw new Error(`${nombre}: ${pts.length} puntos`)
    for (const v of pts.flatMap((p) => p.split(' ').map(parseFloat)))
      if (!(v >= 0 && v <= 100)) throw new Error(`${nombre}: valor fuera de rango ${v}`)
  }
}
