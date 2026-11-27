// TEMPORAL — piezas 100 % de cliente mientras el backend no las tenga (docs/TEMPORAL.md).
import { env, temporal } from '../../config/env'
import { DEV_CUENTAS } from '../../mocks/seed'

// ---------- Foto de perfil
// Backend real: GET /usuarios/{username}/avatar redirige a la foto elegida (404 = sin foto → estrella por defecto).
// Mock: las fotos elegidas se guardan en localStorage. Nunca se asigna una foto automática.
const KEY_FOTOS = 'keepsy.fotos'
function leerFotos(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(KEY_FOTOS) ?? '{}') as Record<string, string>
  } catch {
    return {}
  }
}
/** Versión por username: cambia al actualizar la foto para saltear la caché del navegador. */
const versiones = new Map<string, number>()
const oyentes = new Set<() => void>()
export function suscribirAvatares(fn: () => void): () => void {
  oyentes.add(fn)
  return () => oyentes.delete(fn)
}
export function avatarCambiado(username: string, url?: string | null) {
  if (env.useMock) {
    const f = leerFotos()
    if (url) f[username] = url
    else delete f[username]
    try {
      localStorage.setItem(KEY_FOTOS, JSON.stringify(f))
    } catch {
      /* sin almacenamiento */
    }
  }
  versiones.set(username, Date.now())
  oyentes.forEach((fn) => fn())
}
export function avatarUrl(username: string): string | null {
  if (env.useMock) return leerFotos()[username] ?? null
  const v = versiones.get(username)
  return `${env.apiUrl}/usuarios/${encodeURIComponent(username)}/avatar${v ? `?v=${v}` : ''}`
}

// ---------- Hueco 10: guardar posts (sin endpoint)
const KEY_GUARDADOS = 'keepsy.temporal.guardados'
function leerGuardados(): number[] {
  try {
    const raw = localStorage.getItem(KEY_GUARDADOS)
    const v: unknown = raw ? JSON.parse(raw) : []
    return Array.isArray(v) ? v.filter((x): x is number => typeof x === 'number') : []
  } catch {
    return []
  }
}
/** TEMPORAL: guardados en localStorage. Flag VITE_TEMPORAL_GUARDADOS. */
export function estaGuardado(postId: number): boolean {
  return temporal.guardados && leerGuardados().includes(postId)
}
export function alternarGuardado(postId: number): boolean {
  const set = new Set(leerGuardados())
  const nuevo = !set.has(postId)
  if (nuevo) set.add(postId)
  else set.delete(postId)
  try {
    localStorage.setItem(KEY_GUARDADOS, JSON.stringify([...set]))
  } catch {
    /* sin almacenamiento */
  }
  return nuevo
}

// ---------- Hueco 4: subida de archivos (el contrato recibe URLs)
/** TEMPORAL: un archivo local se convierte en URL de objeto (vive mientras la pestaña esté abierta). */
export function urlDeArchivo(file: File): string {
  return URL.createObjectURL(file)
}
/** TEMPORAL: imagen de relleno de picsum para probar sin archivos. */
export function urlAleatoria(w = 1080, h = 1080): string {
  return `https://picsum.photos/seed/up-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6)}/${w}/${h}`
}

// ---------- Hueco 11: cuentas del switcher de desarrollo
/** TEMPORAL: cuentas de prueba (email + contraseña) para el switcher. Flag VITE_TEMPORAL_DEV_CUENTAS. */
export const cuentasDev = temporal.devCuentas ? DEV_CUENTAS : []
