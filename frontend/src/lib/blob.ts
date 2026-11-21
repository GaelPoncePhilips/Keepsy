/** Formas orgánicas deterministas: la misma semilla da siempre la misma mancha. */

function hash(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

/** Generador pseudoaleatorio chico (mulberry32). */
function rng(seed: number): () => number {
  let a = seed
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * border-radius de 8 valores con forma de mancha. `rareza` (0–1) = cuánto se aleja de un óvalo.
 * Los pares opuestos suman 100% para que el contorno no tenga tramos rectos.
 */
export function radioBlob(semilla: string, rareza = 0.6): string {
  const r = rng(hash(semilla))
  const v = () => Math.round(50 + (r() * 2 - 1) * 28 * rareza)
  const a = v()
  const b = v()
  const c = v()
  const d = v()
  return `${a}% ${100 - a}% ${b}% ${100 - b}% / ${c}% ${d}% ${100 - d}% ${100 - c}%`
}

/** Igual que radioBlob pero en px: para elementos altos, donde los % deformarían todo en un óvalo. */
export function radioBlobPx(semilla: string, min = 18, max = 64): string {
  const r = rng(hash(semilla))
  const v = () => `${Math.round(min + r() * (max - min))}px`
  return `${v()} ${v()} ${v()} ${v()} / ${v()} ${v()} ${v()} ${v()}`
}
