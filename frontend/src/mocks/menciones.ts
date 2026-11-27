// TEMPORAL (hueco 1) — notificaciones de @menciones generadas por el mock.
import type { TipoNotificacion } from '../types/temporal'
import type { Db } from './db'
import { notificar, type Extra } from './notificar'
import { hayBloqueo, puedeVer } from './rules'

const MENCION = /(^|[^\p{L}\p{N}_.@])@([\p{L}\p{N}_.]+)/gu

/** Usernames mencionados (únicos, en minúscula, sin el punto final de una oración). */
export function extraerMenciones(texto: string | null | undefined): string[] {
  if (!texto) return []
  const vistos = new Set<string>()
  for (const m of texto.matchAll(MENCION)) {
    const u = m[2].replace(/\.+$/, '').toLowerCase()
    if (u) vistos.add(u)
  }
  return [...vistos]
}

/**
 * Notifica a cada @usuario mencionado en `texto`. Omite al actor, a bloqueados (en cualquier
 * sentido), a los ids de `excluir` y a quien no puede ver el contenido. Por defecto "puede ver"
 * = `puedeVer(destinatario, actor)`; `permitido` lo reemplaza (p. ej. miembros aceptados del álbum
 * o quien puede ver al dueño del post comentado).
 * Devuelve los ids notificados.
 */
export function notificarMenciones(
  db: Db,
  actorId: number,
  texto: string | null | undefined,
  tipo: TipoNotificacion,
  extra: Extra,
  excluir: number[] = [],
  permitido?: (usuarioId: number) => boolean,
): number[] {
  const notificados: number[] = []
  for (const username of extraerMenciones(texto)) {
    const u = db.usuarios.find((x) => x.username.toLowerCase() === username)
    if (!u || u.id === actorId || excluir.includes(u.id)) continue
    if (hayBloqueo(db, actorId, u.id)) continue
    if (!(permitido ? permitido(u.id) : puedeVer(db, u.id, actorId))) continue
    notificar(db, u.id, tipo, actorId, extra)
    notificados.push(u.id)
  }
  return notificados
}
