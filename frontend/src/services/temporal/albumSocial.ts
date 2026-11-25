// TEMPORAL (hueco 15) — likes y comentarios de los ítems de álbum, guardados en localStorage.
// El backend solo conoce ítems con url_imagen; para que funcionen como publicaciones normales
// se guardan acá. Flag: VITE_TEMPORAL_ALBUM_SOCIAL. Borrar cuando exista /albums/{id}/items/{item}/likes|comentarios.
import { env, temporal } from '../../config/env'
import type { AlbumItem, Comentario, UsuarioResumen } from '../../types/api'
import { api } from '../client'

const KEY_LIKES = 'keepsy.temporal.albumLikes'
const KEY_COMS = 'keepsy.temporal.albumComentarios'

function leer<T>(key: string): Record<string, T> {
  try {
    const raw = localStorage.getItem(key)
    const v: unknown = raw ? JSON.parse(raw) : {}
    return typeof v === 'object' && v !== null ? (v as Record<string, T>) : {}
  } catch {
    return {}
  }
}
function escribir(key: string, v: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(v))
  } catch {
    /* sin almacenamiento */
  }
}

export function likesDeItem(itemId: number): number[] {
  return leer<number[]>(KEY_LIKES)[String(itemId)] ?? []
}

export function alternarLikeItem(itemId: number, yoId: number): number[] {
  const todo = leer<number[]>(KEY_LIKES)
  const set = new Set(todo[String(itemId)] ?? [])
  if (set.has(yoId)) set.delete(yoId)
  else set.add(yoId)
  todo[String(itemId)] = [...set]
  escribir(KEY_LIKES, todo)
  return todo[String(itemId)]
}

export function comentariosDeItem(itemId: number): Comentario[] {
  return leer<Comentario[]>(KEY_COMS)[String(itemId)] ?? []
}

export function comentarItem(itemId: number, yo: { id: number; username: string }, texto: string): Comentario {
  const todo = leer<Comentario[]>(KEY_COMS)
  const lista = todo[String(itemId)] ?? []
  const c: Comentario = {
    id: Date.now() * 1000 + Math.floor(Math.random() * 1000),
    post_id: itemId,
    usuario_id: yo.id,
    autor_username: yo.username,
    texto,
    fecha: new Date().toISOString(),
  }
  todo[String(itemId)] = [...lista, c]
  escribir(KEY_COMS, todo)
  return c
}

export function borrarComentarioItem(itemId: number, comentarioId: number): void {
  const todo = leer<Comentario[]>(KEY_COMS)
  todo[String(itemId)] = (todo[String(itemId)] ?? []).filter((c) => c.id !== comentarioId)
  escribir(KEY_COMS, todo)
}

// ---------- Backend real (VITE_TEMPORAL_ALBUM_SOCIAL=false): /albums/{id}/items/{item_id}/...
// Interfaz común asíncrona: el visor de ítems la usa sin saber si es local o del servidor.

export interface EstadoLikeItem {
  cantidad_likes: number
  me_gusta: boolean
}

const local = () => env.useMock || temporal.albumSocial
const base = (item: AlbumItem) => `/albums/${item.album_id}/items/${item.id}`

/** Estado inicial de likes/comentarios de un ítem. */
export function socialInicial(item: AlbumItem, yoId: number): EstadoLikeItem & { cantidad_comentarios: number } {
  if (local()) {
    const likes = likesDeItem(item.id)
    return { cantidad_likes: likes.length, me_gusta: likes.includes(yoId), cantidad_comentarios: comentariosDeItem(item.id).length }
  }
  return {
    cantidad_likes: item.cantidad_likes ?? 0,
    me_gusta: item.me_gusta ?? false,
    cantidad_comentarios: item.cantidad_comentarios ?? 0,
  }
}

/** POST|DELETE …/like → {cantidad_likes, me_gusta} */
export async function likeItem(item: AlbumItem, yoId: number, quiero: boolean): Promise<EstadoLikeItem> {
  if (local()) {
    const actual = likesDeItem(item.id)
    const likes = actual.includes(yoId) === quiero ? actual : alternarLikeItem(item.id, yoId)
    return { cantidad_likes: likes.length, me_gusta: likes.includes(yoId) }
  }
  return quiero ? api.post<EstadoLikeItem>(`${base(item)}/like`) : api.del<EstadoLikeItem>(`${base(item)}/like`)
}

/** GET …/likes → UsuarioResumen[] (local: ids resueltos con `resolver`) */
export function likesItem(item: AlbumItem, resolver: (id: number) => Promise<UsuarioResumen>): Promise<UsuarioResumen[]> {
  if (local()) return Promise.all(likesDeItem(item.id).map(resolver))
  return api.get<UsuarioResumen[]>(`${base(item)}/likes`, { limit: 50 })
}

/** GET …/comentarios → Comentario[] (fecha asc) */
export function listarComentariosItem(item: AlbumItem): Promise<Comentario[]> {
  if (local()) return Promise.resolve(comentariosDeItem(item.id))
  return api.get<Comentario[]>(`${base(item)}/comentarios`, { limit: 50 })
}

/** POST …/comentarios {texto} → Comentario */
export function comentarItemApi(item: AlbumItem, yo: { id: number; username: string }, texto: string): Promise<Comentario> {
  if (local()) return Promise.resolve(comentarItem(item.id, yo, texto))
  return api.post<Comentario>(`${base(item)}/comentarios`, { texto })
}

/** DELETE …/comentarios/{id} → 204 */
export function borrarComentarioItemApi(item: AlbumItem, comentarioId: number): Promise<void> {
  if (local()) {
    borrarComentarioItem(item.id, comentarioId)
    return Promise.resolve()
  }
  return api.del(`${base(item)}/comentarios/${comentarioId}`)
}
