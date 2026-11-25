// TEMPORAL — servicios de endpoints que el contrato no define todavía (docs/TEMPORAL.md).
// Cada uno responde desde el mock aunque VITE_USE_MOCK=false mientras su flag esté activo.
import { env, temporal } from '../../config/env'
import type { Paginacion, Post, UsuarioResumen } from '../../types/api'
import type { CantidadNoLeidas, Notificacion, TipoNotificacion } from '../../types/temporal'
import { temporalRequest } from '../client'

// ---------- Hueco 1: notificaciones

/** Forma de GET /notificaciones del backend real: `solicitud` en vez de `solicitud_seguimiento`. */
type NotificacionBackend = Omit<Notificacion, 'tipo'> & { tipo: TipoNotificacion | 'solicitud' }
const usaMock = () => env.useMock || temporal.notificaciones

/** GET /notificaciones?limit&offset → Notificacion[] (fecha desc) */
export async function notificaciones(p: Paginacion = {}): Promise<Notificacion[]> {
  const lista = await temporalRequest<NotificacionBackend[]>(temporal.notificaciones, 'GET', '/notificaciones', {
    query: { limit: 50, ...p },
  })
  return lista.map((n) => ({
    ...n,
    tipo: n.tipo === 'solicitud' ? 'solicitud_seguimiento' : n.tipo,
    url_miniatura: n.url_miniatura ?? null,
    texto: n.texto ?? null,
  }))
}

/** TEMPORAL POST /notificaciones/{id}/leida → 204 */
export const marcarNotificacionLeida = (id: number) =>
  temporalRequest<void>(temporal.notificaciones, 'POST', `/notificaciones/${id}/leida`, { body: {} })

/** TEMPORAL POST /notificaciones/leidas → 204 (marca todas) */
export const marcarTodasLeidas = () => temporalRequest<void>(temporal.notificaciones, 'POST', '/notificaciones/leidas', { body: {} })

/** Mock: GET /notificaciones/no-leidas/cantidad → {cantidad}. Backend real: GET /notificaciones/no-leidas → {no_leidas}. */
export async function cantidadNoLeidas(): Promise<CantidadNoLeidas> {
  if (usaMock()) return temporalRequest<CantidadNoLeidas>(true, 'GET', '/notificaciones/no-leidas/cantidad')
  const r = await temporalRequest<{ no_leidas: number }>(false, 'GET', '/notificaciones/no-leidas')
  return { cantidad: r.no_leidas }
}

// ---------- Hueco 2: búsqueda de usuarios

/** TEMPORAL GET /usuarios?q=&limit&offset → UsuarioResumen[] */
export const buscarUsuarios = (q: string, p: Paginacion = {}) =>
  temporalRequest<UsuarioResumen[]>(temporal.busqueda, 'GET', '/usuarios', { query: { q, limit: 20, ...p } })

// ---------- Hueco 7: resolver un usuario por id

const cacheResumen = new Map<number, Promise<UsuarioResumen>>()

/** TEMPORAL GET /usuarios/{id}/resumen → UsuarioResumen (con caché en memoria) */
export function usuarioPorId(id: number): Promise<UsuarioResumen> {
  const hit = cacheResumen.get(id)
  if (hit) return hit
  const p = temporalRequest<UsuarioResumen>(temporal.usuariosPorId, 'GET', `/usuarios/${id}/resumen`)
  p.catch(() => cacheResumen.delete(id))
  cacheResumen.set(id, p)
  return p
}

export function recordarUsuario(u: UsuarioResumen): void {
  cacheResumen.set(u.id, Promise.resolve(u))
}

// ---------- Hueco 13: republicaciones

export interface EstadoRepost {
  cantidad_reposts: number
  me_republique: boolean
}

/** TEMPORAL POST /posts/{id}/repost → {cantidad_reposts, me_republique} */
export const republicar = (id: number) =>
  temporalRequest<EstadoRepost>(temporal.reposts, 'POST', `/posts/${id}/repost`, { body: {} })

/** TEMPORAL DELETE /posts/{id}/repost */
export const quitarRepublicacion = (id: number) => temporalRequest<EstadoRepost>(temporal.reposts, 'DELETE', `/posts/${id}/repost`)

/** TEMPORAL GET /usuarios/{id}/reposts → Post[] con repostado_por */
export const repostsDeUsuario = (id: number, p: Paginacion = {}) =>
  temporalRequest<Post[]>(temporal.reposts, 'GET', `/usuarios/${id}/reposts`, { query: { limit: 12, ...p } })

/** TEMPORAL GET /usuarios/{id}/feed/reposts → Post[] republicados por quienes sigo */
export const repostsDelFeed = (id: number) =>
  temporalRequest<Post[]>(temporal.reposts, 'GET', `/usuarios/${id}/feed/reposts`, { query: { limit: 20 } })
