/** Eventos de la app entre pantallas montadas a la vez (feed, perfil, modal de post). */
import { useEffect, useRef, useState } from 'react'

export interface CambioRepost {
  postId: number
  republicado: boolean
  cantidad: number
}

const REPOST = 'keepsy:repost'

/** Avisa que cambió mi republicación de un post (para sincronizar botones y la pestaña del perfil). */
export function emitirRepost(d: CambioRepost): void {
  window.dispatchEvent(new CustomEvent<CambioRepost>(REPOST, { detail: d }))
}

export function useEventoRepost(fn: (d: CambioRepost) => void): void {
  const ref = useRef(fn)
  useEffect(() => {
    ref.current = fn
  })
  useEffect(() => {
    const h = (e: Event) => ref.current((e as CustomEvent<CambioRepost>).detail)
    window.addEventListener(REPOST, h)
    return () => window.removeEventListener(REPOST, h)
  }, [])
}

const POST_EDITADO = 'keepsy:post-editado'

/** Avisa que se editó la descripción de un post (feed, perfil y modal se actualizan solos). */
export function emitirPostEditado(postId: number, descripcion: string | null): void {
  window.dispatchEvent(new CustomEvent<{ postId: number; descripcion: string | null }>(POST_EDITADO, { detail: { postId, descripcion } }))
}

/** Descripción vigente del post: la recibida o la última editada en esta sesión. */
export function useDescripcion(postId: number, inicial: string | null): string | null {
  const [desc, setDesc] = useState(inicial)
  useEffect(() => setDesc(inicial), [inicial])
  useEffect(() => {
    const h = (e: Event) => {
      const d = (e as CustomEvent<{ postId: number; descripcion: string | null }>).detail
      if (d.postId === postId) setDesc(d.descripcion)
    }
    window.addEventListener(POST_EDITADO, h)
    return () => window.removeEventListener(POST_EDITADO, h)
  }, [postId])
  return desc
}

const INVITACION_ALBUM = 'keepsy:invitacion-album'
export interface RespuestaInvitacion {
  albumId: number
  aceptada: boolean
}

/** Avisa que se aceptó o rechazó una invitación a un álbum (perfil y notificaciones se actualizan). */
export function emitirInvitacionAlbum(d: RespuestaInvitacion): void {
  window.dispatchEvent(new CustomEvent<RespuestaInvitacion>(INVITACION_ALBUM, { detail: d }))
}

export function useEventoInvitacionAlbum(fn: (d: RespuestaInvitacion) => void): void {
  const ref = useRef(fn)
  useEffect(() => {
    ref.current = fn
  })
  useEffect(() => {
    const h = (e: Event) => ref.current((e as CustomEvent<RespuestaInvitacion>).detail)
    window.addEventListener(INVITACION_ALBUM, h)
    return () => window.removeEventListener(INVITACION_ALBUM, h)
  }, [])
}

const LIKE = 'keepsy:like'
export interface CambioLike {
  postId: number
  meGusta: boolean
  cantidad: number
}

/** Avisa que cambió mi like de un post: feed, perfil, detalle y reels muestran lo mismo. */
export function emitirLike(d: CambioLike): void {
  window.dispatchEvent(new CustomEvent<CambioLike>(LIKE, { detail: d }))
}

export function useEventoLike(fn: (d: CambioLike) => void): void {
  const ref = useRef(fn)
  useEffect(() => {
    ref.current = fn
  })
  useEffect(() => {
    const h = (e: Event) => ref.current((e as CustomEvent<CambioLike>).detail)
    window.addEventListener(LIKE, h)
    return () => window.removeEventListener(LIKE, h)
  }, [])
}
