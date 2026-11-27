// TEMPORAL — endpoints que el contrato no define todavía (ver docs/TEMPORAL.md).
// Responden desde el mock aunque VITE_USE_MOCK=false; cada uno se apaga con su VITE_TEMPORAL_*.
import type { Notificacion } from '../../types/temporal'
import type { DbNotificacion } from '../db'
import { obj } from '../handlers/util'
import { assertPuedeVer, hayBloqueo, notFound, paginar, postDTO, resumen, sigue, usuario } from '../rules'
import { nowIso } from '../db'
import { route } from '../server'
import { idParam } from '../handlers/util'
import type { Db } from '../db'

function notifDTO(db: Db, n: DbNotificacion): Notificacion {
  return {
    id: n.id,
    tipo: n.tipo,
    actor: resumen(usuario(db, n.actor_id)),
    post_id: n.post_id,
    album_id: n.album_id,
    story_id: n.story_id ?? null,
    url_miniatura: n.url_miniatura,
    texto: n.texto,
    leida: n.leida,
    fecha: n.fecha,
  }
}

// TEMPORAL (hueco 1): GET /notificaciones?limit&offset
route('GET', '/notificaciones', ({ db, yo, query }) =>
  paginar(
    db.notificaciones
      .filter((n) => n.destinatario_id === yo && !hayBloqueo(db, yo, n.actor_id))
      .sort((a, b) => b.fecha.localeCompare(a.fecha)),
    query,
    50,
  ).map((n) => notifDTO(db, n)),
)

// TEMPORAL (hueco 1): POST /notificaciones/{id}/leida
route('POST', '/notificaciones/{id}/leida', ({ db, yo, params }) => {
  const id = idParam(params, 'id')
  const n = db.notificaciones.find((x) => x.id === id && x.destinatario_id === yo)
  if (!n) throw notFound('Notificación no encontrada')
  n.leida = true
  return undefined
})

// TEMPORAL (hueco 1): POST /notificaciones/leidas
route('POST', '/notificaciones/leidas', ({ db, yo, body }) => {
  obj(body)
  for (const n of db.notificaciones) if (n.destinatario_id === yo) n.leida = true
  return undefined
})

// TEMPORAL (hueco 1): GET /notificaciones/no-leidas/cantidad
route('GET', '/notificaciones/no-leidas/cantidad', ({ db, yo }) => ({
  cantidad: db.notificaciones.filter((n) => n.destinatario_id === yo && !n.leida && !hayBloqueo(db, yo, n.actor_id)).length,
}))

// TEMPORAL (hueco 2): GET /usuarios?q=&limit&offset
route('GET', '/usuarios', ({ db, yo, query }) => {
  const q = (query.get('q') ?? '').trim().toLowerCase().replace(/^@/, '')
  if (!q) return []
  const res = db.usuarios
    .filter((u) => !hayBloqueo(db, yo, u.id))
    .filter((u) => u.username.includes(q) || u.nombre.toLowerCase().includes(q))
    .sort((a, b) => Number(!a.username.startsWith(q)) - Number(!b.username.startsWith(q)) || a.username.localeCompare(b.username))
    .map(resumen)
  return paginar(res, query)
})

// TEMPORAL (hueco 7): GET /usuarios/{id}/resumen — resolver ids sueltos (solicitudes, autores que salieron de un álbum)
route('GET', '/usuarios/{id}/resumen', ({ db, yo, params }) => {
  const id = idParam(params, 'id')
  if (hayBloqueo(db, yo, id)) throw notFound('Usuario no encontrado')
  return resumen(usuario(db, id))
})

// ---------- TEMPORAL (hueco 13): republicaciones
function repostDTO(db: Db, yo: number, r: { usuario_id: number; post_id: number; fecha: string }) {
  const p = db.posts.find((x) => x.id === r.post_id)
  if (!p) return null
  try {
    assertPuedeVer(db, yo, p.usuario_id)
  } catch {
    return null
  }
  if (hayBloqueo(db, yo, p.usuario_id)) return null
  return { ...postDTO(db, p, yo), repostado_por: resumen(usuario(db, r.usuario_id)), fecha_repost: r.fecha }
}

// POST /posts/{id}/repost → {cantidad_reposts, me_republique}
route('POST', '/posts/{id}/repost', ({ db, yo, params }) => {
  const id = idParam(params, 'id')
  const p = db.posts.find((x) => x.id === id)
  if (!p) throw notFound('Post no encontrado')
  assertPuedeVer(db, yo, p.usuario_id)
  if (!db.reposts.some((r) => r.post_id === id && r.usuario_id === yo)) db.reposts.push({ usuario_id: yo, post_id: id, fecha: nowIso() })
  return { cantidad_reposts: db.reposts.filter((r) => r.post_id === id).length, me_republique: true }
})

// DELETE /posts/{id}/repost → {cantidad_reposts, me_republique}
route('DELETE', '/posts/{id}/repost', ({ db, yo, params }) => {
  const id = idParam(params, 'id')
  db.reposts = db.reposts.filter((r) => !(r.post_id === id && r.usuario_id === yo))
  return { cantidad_reposts: db.reposts.filter((r) => r.post_id === id).length, me_republique: false }
})

// GET /usuarios/{id}/reposts → Post[] republicados por el usuario (fecha desc)
route('GET', '/usuarios/{id}/reposts', ({ db, yo, params, query }) => {
  const id = idParam(params, 'id')
  assertPuedeVer(db, yo, id)
  const lista = db.reposts
    .filter((r) => r.usuario_id === id)
    .sort((a, b) => b.fecha.localeCompare(a.fecha))
    .map((r) => repostDTO(db, yo, r))
    .filter((x): x is NonNullable<typeof x> => x !== null)
  return paginar(lista, query)
})

// GET /usuarios/{id}/feed/reposts → republicaciones de las cuentas que sigo (para mezclar en el feed)
route('GET', '/usuarios/{id}/feed/reposts', ({ db, yo, params, query }) => {
  const id = idParam(params, 'id')
  const lista = db.reposts
    .filter((r) => r.usuario_id !== id && sigue(db, id, r.usuario_id))
    .sort((a, b) => b.fecha.localeCompare(a.fecha))
    .map((r) => repostDTO(db, yo, r))
    .filter((x): x is NonNullable<typeof x> => x !== null)
  return paginar(lista, query, 20)
})
