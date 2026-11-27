import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { Avatar } from '../../components/ui/Avatar'
import { Button } from '../../components/ui/Button'
import { Icon } from '../../components/ui/Icon'
import { IconButton } from '../../components/ui/IconButton'
import { cn } from '../../lib/hooks'
import { aceptarInvitacion, obtenerAlbum } from '../../services/albums'
import { mensajeDeError } from '../../services/client'
import { obtenerPost } from '../../services/posts'
import { albumDeInvitacion } from '../../services/temporal/invitacionDm'
import { useBadges } from '../../stores/badges'
import { useYo } from '../../stores/session'
import { snackbar } from '../../stores/ui'
import type { Album, Mensaje, Post, UsuarioResumen } from '../../types/api'
import { usuarioPorId } from '../../services/temporal'
import { decodificar } from '../../services/temporal/comentariosExtra'
import { AvatarStack } from '../albums/common'
import { MediaAdjunta } from '../post/comentarios'

// Caché de posts compartidos (null = no disponible).
const cachePosts = new Map<number, Promise<Post | null>>()
function postCompartido(id: number): Promise<Post | null> {
  let p = cachePosts.get(id)
  if (!p) {
    p = obtenerPost(id).catch(() => null)
    cachePosts.set(id, p)
  }
  return p
}

function PostCard({ postId, mio }: { postId: number; mio: boolean }) {
  const [post, setPost] = useState<Post | null | undefined>(undefined)
  useEffect(() => {
    let vivo = true
    void postCompartido(postId).then((p) => {
      if (vivo) setPost(p)
    })
    return () => {
      vivo = false
    }
  }, [postId])
  if (post === undefined) return <div className="h-60 w-60 animate-pulse rounded-lg bg-surface-container-high" />
  if (post === null)
    return (
      <div className={cn('type-body-m rounded-lg px-4 py-3', mio ? 'bg-primary text-on-primary' : 'bg-surface-container-highest text-on-surface-variant')}>
        Publicación no disponible
      </div>
    )
  return (
    <Link to={`/p/${post.id}`} className="block w-60 overflow-hidden rounded-lg border border-outline-variant bg-surface-container-highest text-on-surface">
      <span className="flex items-center gap-2 px-3 py-2">
        <Avatar username={post.autor_username} size={24} />
        <span className="type-label-l emphasized truncate">{post.autor_username}</span>
      </span>
      <img src={post.url_imagen} alt={`Publicación de ${post.autor_username}`} className="aspect-square w-full object-cover" loading="lazy" />
    </Link>
  )
}

/**
 * TEMPORAL (hueco 12): tarjeta de invitación a álbum con call to action dentro del chat.
 * Se dibuja cuando el texto del mensaje es una invitación (ver services/temporal/invitacionDm.ts).
 */
function InvitacionAlbumCard({ albumId, mio }: { albumId: number; mio: boolean }) {
  const yo = useYo()
  const navigate = useNavigate()
  const [album, setAlbum] = useState<Album | null | undefined>(undefined)
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    let vivo = true
    obtenerAlbum(albumId)
      .then((a) => {
        if (vivo) setAlbum(a)
      })
      .catch(() => {
        if (vivo) setAlbum(null)
      })
    return () => {
      vivo = false
    }
  }, [albumId])
  if (album === undefined) return <div className="h-72 w-64 animate-pulse rounded-lg bg-surface-container-high" />
  if (album === null)
    return <div className="type-body-m rounded-lg bg-surface-container-highest px-4 py-3 text-on-surface-variant">Álbum no disponible</div>
  const yoMiembro = album.miembros.find((m) => m.id === yo.id)
  const pendiente = yoMiembro?.estado === 'pendiente'
  const aceptados = album.miembros.filter((m) => m.estado === 'aceptado')
  const aceptar = async () => {
    setBusy(true)
    try {
      setAlbum(await aceptarInvitacion(album.id))
      snackbar(`Te uniste a «${album.titulo}»`)
      void useBadges.getState().refrescar()
    } catch (e) {
      snackbar(mensajeDeError(e))
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="w-64 overflow-hidden rounded-lg border border-outline-variant bg-surface-container-low text-on-surface">
      <div className="relative aspect-square bg-tertiary-container text-on-tertiary-container">
        {album.portada_url ? (
          <img src={album.portada_url} alt={`Portada de ${album.titulo}`} className="size-full object-cover" loading="lazy" />
        ) : (
          <span className="flex size-full items-center justify-center">
            <Icon name="photo_album" size={56} />
          </span>
        )}
        <span className="absolute top-2 left-2 inline-flex h-7 items-center gap-1 rounded-sm bg-primary px-2 text-on-primary type-label-m">
          <Icon name="photo_album" size={16} fill />
          Álbum compartido
        </span>
      </div>
      <div className="flex flex-col gap-2 p-3">
        <p className="type-title-s emphasized truncate">{album.titulo}</p>
        <div className="flex items-center gap-2">
          <AvatarStack usuarios={aceptados} max={4} size={22} />
          <span className="type-body-s text-on-surface-variant">
            {aceptados.length} {aceptados.length === 1 ? 'participante' : 'participantes'}
          </span>
        </div>
        {mio ? (
          <Button variant="tonal" full size="sm" onClick={() => navigate(`/albumes/${album.id}`)}>
              Ver álbum
            </Button>
        ) : pendiente ? (
          <div className="flex gap-2">
            <Button size="sm" className="flex-1" disabled={busy} onClick={() => void aceptar()}>
              Unirme
            </Button>
            <Button size="sm" variant="tonal" className="flex-1" onClick={() => navigate(`/albumes/${album.id}`)}>
                Ver
              </Button>
          </div>
        ) : (
          <Button size="sm" variant="tonal" full icon={yoMiembro ? 'check' : undefined} onClick={() => navigate(`/albumes/${album.id}`)}>
              {yoMiembro ? 'Ya sos parte · Ver álbum' : 'Ver álbum'}
            </Button>
        )}
      </div>
    </div>
  )
}

// Caché de autores de stories reenviadas.
const cacheAutores = new Map<number, Promise<UsuarioResumen | null>>()
function autorStory(id: number): Promise<UsuarioResumen | null> {
  let p = cacheAutores.get(id)
  if (!p) {
    p = usuarioPorId(id).catch(() => null)
    cacheAutores.set(id, p)
  }
  return p
}

function MiniaturaStory({ m, ancho }: { m: Mensaje; ancho: number }) {
  const navigate = useNavigate()
  const sid = m.story_id ?? null
  if (sid === null || !m.story_url_imagen)
    return (
      <div style={{ width: ancho }} className="type-body-s flex aspect-[9/16] items-center justify-center rounded-lg bg-surface-container-high p-2 text-center text-on-surface-variant italic">
        Story no disponible
      </div>
    )
  return (
    <button
      type="button"
      onClick={() => navigate(`/story/${sid}`)}
      aria-label="Ver story"
      style={{ width: ancho }}
      className="block aspect-[9/16] overflow-hidden rounded-lg bg-surface-container-high"
    >
      <img src={m.story_url_imagen} alt="Story" className="size-full object-cover" loading="lazy" />
    </button>
  )
}

function StoryReenviadaCard({ m }: { m: Mensaje }) {
  const navigate = useNavigate()
  const [autor, setAutor] = useState<UsuarioResumen | null>(null)
  const uid = m.story_usuario_id ?? null
  useEffect(() => {
    if (uid === null) return
    let vivo = true
    void autorStory(uid).then((u) => {
      if (vivo) setAutor(u)
    })
    return () => {
      vivo = false
    }
  }, [uid])
  const sid = m.story_id ?? null
  if (sid === null || !m.story_url_imagen) return <MiniaturaStory m={m} ancho={140} />
  return (
    <button
      type="button"
      onClick={() => navigate(`/story/${sid}`)}
      aria-label={autor ? `Ver story de ${autor.username}` : 'Ver story'}
      className="block w-[140px] overflow-hidden rounded-lg border border-outline-variant bg-surface-container-highest text-left text-on-surface"
    >
      <span className="flex items-center gap-1.5 px-2 py-1.5">
        {autor && <Avatar username={autor.username} size={22} />}
        <span className="type-label-m emphasized truncate">{autor?.username ?? 'Story'}</span>
      </span>
      <img src={m.story_url_imagen} alt={autor ? `Story de ${autor.username}` : 'Story'} className="aspect-[9/16] w-full object-cover" loading="lazy" />
    </button>
  )
}

interface BurbujaProps {
  m: Mensaje
  mio: boolean
  emisor?: UsuarioResumen
  grupal: boolean
  conPrev: boolean
  conNext: boolean
  isMobile: boolean
  onMenu: (m: Mensaje) => void
}

export function Burbuja({ m, mio, emisor, grupal, conPrev, conNext, isMobile, onMenu }: BurbujaProps) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const corto = '4px'
  const largo = '20px'
  const radio = mio
    ? `${largo} ${conPrev ? corto : largo} ${conNext ? corto : largo} ${largo}`
    : `${conPrev ? corto : largo} ${largo} ${largo} ${conNext ? corto : largo}`
  const cancelar = () => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = null
  }
  const pressProps =
    mio && isMobile
      ? {
          onPointerDown: () => {
            cancelar()
            timer.current = setTimeout(() => onMenu(m), 450)
          },
          onPointerUp: cancelar,
          onPointerLeave: cancelar,
          onPointerMove: cancelar,
          onContextMenu: (e: React.MouseEvent) => {
            e.preventDefault()
            onMenu(m)
          },
        }
      : {}
  const mostrarAvatar = grupal && !mio && !conNext
  const invitacion = albumDeInvitacion(m.texto)
  const { texto: textoLimpio, media } = decodificar(m.texto ?? '')
  const textoVisible = textoLimpio.replace(/\u200b/g, '')
  const esStory = m.story_id != null
  const vacio = !esStory && m.post_id === null && !textoVisible && !media && invitacion === null
  return (
    <div className={cn('group flex items-end gap-2', mio ? 'justify-end' : 'justify-start', conPrev ? 'mt-0.5' : 'mt-2')}>
      {!mio && grupal && (
        <span className="w-7 shrink-0">{mostrarAvatar && emisor && <Avatar username={emisor.username} size={28} />}</span>
      )}
      {mio && !isMobile && (
        <span className="opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
          <IconButton icon="more_horiz" label="Opciones del mensaje" size={20} onClick={() => onMenu(m)} />
        </span>
      )}
      <div className={cn('flex max-w-[70%] flex-col', mio ? 'items-end' : 'items-start')}>
        {grupal && !mio && !conPrev && emisor && <span className="type-label-s mb-0.5 ml-3 text-on-surface-variant">{emisor.username}</span>}
        {esStory && textoVisible && (
          <span className="type-label-s mb-1 px-1 text-on-surface-variant">{mio ? 'Respondiste a su story' : 'Respondió a tu story'}</span>
        )}
        {esStory && textoVisible && (
          <div {...pressProps} className="mb-0.5">
            <MiniaturaStory m={m} ancho={96} />
          </div>
        )}
        {esStory && !textoVisible && !media && (
          <div {...pressProps}>
            <StoryReenviadaCard m={m} />
          </div>
        )}
        {vacio && (
          <div {...pressProps} className="type-body-m rounded-lg bg-surface-container-highest px-4 py-2 text-on-surface-variant italic">
            Story no disponible
          </div>
        )}
        {m.post_id !== null && <PostCard postId={m.post_id} mio={mio} />}
        {invitacion !== null && (
          <div {...pressProps}>
            <InvitacionAlbumCard albumId={invitacion} mio={mio} />
          </div>
        )}
        {media && invitacion === null && (
          <div {...pressProps} className={cn(m.post_id !== null && 'mt-0.5')}>
            <MediaAdjunta media={media} className="max-w-[240px]" />
          </div>
        )}
        {textoVisible && invitacion === null && (
          <div
            {...pressProps}
            style={{ borderRadius: radio }}
            className={cn(
              'type-body-l px-4 py-2 break-words whitespace-pre-wrap select-text',
              m.post_id !== null && 'mt-0.5',
              mio ? 'bg-primary text-on-primary' : 'bg-surface-container-highest text-on-surface',
            )}
          >
            {textoVisible}
          </div>
        )}
      </div>
    </div>
  )
}
