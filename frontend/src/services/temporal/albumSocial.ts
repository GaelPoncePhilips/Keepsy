// TEMPORAL (hueco 15) — likes y comentarios de los ítems de álbum, guardados en localStorage.
// El backend solo conoce ítems con url_imagen; para que funcionen como publicaciones normales
// se guardan acá. Flag: VITE_TEMPORAL_ALBUM_SOCIAL. Borrar cuando exista /albums/{id}/items/{item}/likes|comentarios.
import type { Comentario } from '../../types/api'

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
