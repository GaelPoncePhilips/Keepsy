// TEMPORAL — tipos de endpoints que el contrato todavía no define (ver docs/TEMPORAL.md).
import type { ISODate, UsuarioResumen } from './api'

/** TEMPORAL (hueco 1) */
export type TipoNotificacion =
  | 'seguidor_nuevo'
  | 'solicitud_seguimiento'
  /** Solo backend real: aceptaron mi solicitud de seguimiento. */
  | 'solicitud_aceptada'
  | 'like'
  | 'comentario'
  | 'invitacion_album'
  | 'invitacion_aceptada'
  | 'album_contenido'
  | 'album_participante'
  /** Te arrobaron en la descripción de un post/reel (post_id) o de una foto de álbum (album_id). */
  | 'mencion'
  /** Te arrobaron en un comentario (post_id + texto del comentario). */
  | 'mencion_comentario'
  /** Le dieron me gusta a tu story (story_id + url_miniatura). */
  | 'like_story'
  /** Te arrobaron en una story (story_id + url_miniatura; actor = autor de la story). */
  | 'mencion_story'

/** TEMPORAL (hueco 1) */
export interface Notificacion {
  id: number
  tipo: TipoNotificacion
  actor: UsuarioResumen
  post_id: number | null
  album_id: number | null
  /** Stories: like o mención. */
  story_id?: number | null
  url_miniatura: string | null
  texto: string | null
  leida: boolean
  fecha: ISODate
}

/** TEMPORAL (hueco 1) */
export interface CantidadNoLeidas {
  cantidad: number
}
