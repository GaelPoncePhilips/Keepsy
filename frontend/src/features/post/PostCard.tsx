import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'
import { Avatar } from '../../components/ui/Avatar'
import { navegarConZoom } from '../../lib/transicion'
import { HuecoPost } from './HuecoPost'
import { IconButton } from '../../components/ui/IconButton'
import { Icon } from '../../components/ui/Icon'
import { ActionMenu, Confirm, type MenuAction } from '../../components/ui/Overlay'
import { cn, useIsMobile } from '../../lib/hooks'
import { numeroCorto, tiempoCorto } from '../../lib/time'
import { vibrar } from '../../lib/haptics'
import { mensajeDeError } from '../../services/client'
import * as postsApi from '../../services/posts'
import { alternarGuardado, estaGuardado } from '../../services/temporal/local'
import { quitarRepublicacion, republicar } from '../../services/temporal'
import { decodificar } from '../../services/temporal/comentariosExtra'
import * as usuariosApi from '../../services/usuarios'
import { useYo } from '../../stores/session'
import { snackbar, useUi } from '../../stores/ui'
import type { Comentario, Post } from '../../types/api'
import { CajaComentario, MediaAdjunta } from './comentarios'
import { CommentsSheet } from './CommentsSheet'
import { LikesSheet } from './LikesSheet'
import { RichText } from './RichText'
import { ShareSheet } from './ShareSheet'

const LIMITE_DESCRIPCION = 125

/** Relación de aspecto a partir de la URL (picsum: /ancho/alto). 1350 de alto → 4:5; si no, 1:1. */
function aspectoDe(url: string): string {
  const m = /\/(\d{2,5})\/(\d{2,5})(?:[/?.]|$)/.exec(url)
  if (m) {
    const w = Number(m[1])
    const h = Number(m[2])
    if (w > 0 && h > 0) {
      const r = h / w
      if (r > 1.3) return '4 / 5'
      if (r < 0.8) return '1.91 / 1'
      return '1 / 1'
    }
  }
  return '1 / 1'
}

/** Estado de like optimista con rollback. */
export function useLike(post: Post) {
  const [meGusta, setMeGusta] = useState(post.me_gusta)
  const [likes, setLikes] = useState(post.cantidad_likes)
  const busy = useRef(false)
  const set = async (valor: boolean) => {
    if (busy.current || valor === meGusta) return
    busy.current = true
    const prev = { meGusta, likes }
    setMeGusta(valor)
    setLikes((n) => n + (valor ? 1 : -1))
    vibrar(valor ? 'click' : 'tick')
    try {
      if (valor) {
        const p = await postsApi.darLike(post.id)
        setLikes(p.cantidad_likes)
      } else {
        await postsApi.quitarLike(post.id)
      }
    } catch (e) {
      setMeGusta(prev.meGusta)
      setLikes(prev.likes)
      snackbar(mensajeDeError(e))
    } finally {
      busy.current = false
    }
  }
  return { meGusta, likes, set }
}

/** TEMPORAL (hueco 13): republicar con estado optimista. */
export function useRepost(post: Post) {
  const [republicado, setRepublicado] = useState(post.me_republique ?? false)
  const [cantidad, setCantidad] = useState(post.cantidad_reposts ?? 0)
  const busy = useRef(false)
  const alternar = async () => {
    if (busy.current) return
    busy.current = true
    const quiere = !republicado
    setRepublicado(quiere)
    setCantidad((n) => Math.max(0, n + (quiere ? 1 : -1)))
    vibrar(quiere ? 'exito' : 'tick')
    try {
      const r = quiere ? await republicar(post.id) : await quitarRepublicacion(post.id)
      setRepublicado(r.me_republique)
      setCantidad(r.cantidad_reposts)
      snackbar(quiere ? 'Republicado en tu perfil' : 'Quitaste la republicación')
    } catch (e) {
      setRepublicado(!quiere)
      setCantidad((n) => Math.max(0, n + (quiere ? -1 : 1)))
      snackbar(mensajeDeError(e))
    } finally {
      busy.current = false
    }
  }
  return { republicado, cantidad, alternar }
}

/** Media del post (imagen o video de reel) con doble tap = like. */
export function PostMedia({ post, onDoubleLike, onOpen, fill }: { post: Post; onDoubleLike: () => void; onOpen?: () => void; fill?: boolean }) {
  const [corazon, setCorazon] = useState(0)
  const videoRef = useRef<HTMLVideoElement>(null)
  const ultimoTap = useRef(0)

  useEffect(() => {
    const v = videoRef.current
    if (!v) return
    const io = new IntersectionObserver(
      ([e]) => {
        if (e?.isIntersecting) void v.play().catch(() => undefined)
        else v.pause()
      },
      { threshold: 0.6 },
    )
    io.observe(v)
    return () => io.disconnect()
  }, [])

  const doble = () => {
    setCorazon((n) => n + 1)
    onDoubleLike()
  }
  // Un toque abre la publicación (si hay onOpen); dos toques seguidos dan like y cancelan la apertura.
  const timerAbrir = useRef(0)
  useEffect(() => () => window.clearTimeout(timerAbrir.current), [])
  const onClick = () => {
    const ahora = Date.now()
    if (ahora - ultimoTap.current < 300) {
      window.clearTimeout(timerAbrir.current)
      ultimoTap.current = 0
      doble()
      return
    }
    ultimoTap.current = ahora
    if (onOpen) timerAbrir.current = window.setTimeout(onOpen, 300)
  }

  return (
    <div
      className={cn('relative w-full overflow-hidden bg-surface-container-highest select-none', fill && 'h-full bg-transparent')}
      style={fill ? undefined : { aspectRatio: aspectoDe(post.url_imagen) }}
      onClick={onClick}
    >
      {post.tipo === 'reel' && post.url_video ? (
        <video
          ref={videoRef}
          src={post.url_video}
          poster={post.url_imagen}
          muted
          loop
          playsInline
          className={cn('size-full', fill ? 'object-contain' : 'object-cover')}
          aria-label={post.descripcion ?? `Reel de ${post.autor_username}`}
        />
      ) : (
        <img
          src={post.url_imagen}
          alt={post.descripcion ?? `Publicación de ${post.autor_username}`}
          loading="lazy"
          draggable={false}
          className={cn('size-full', fill ? 'object-contain' : 'object-cover')}
        />
      )}
      {post.tipo === 'reel' && (
        <span className="absolute top-3 right-3 text-white drop-shadow">
          <Icon name="movie" fill size={22} />
        </span>
      )}
      {corazon > 0 && (
        <span key={corazon} className="heart-pop pointer-events-none absolute inset-0 flex items-center justify-center text-white drop-shadow-lg">
          <Icon name="favorite" fill size={110} />
        </span>
      )}
    </div>
  )
}

/** Menú ⋯ del post: eliminar (propio) o bloquear / ir / copiar enlace (ajeno). */
export function PostMenu({ post, onDeleted, onBlocked }: { post: Post; onDeleted?: () => void; onBlocked?: () => void }) {
  const yo = useYo()
  const navigate = useNavigate()
  const [menu, setMenu] = useState(false)
  const [confirm, setConfirm] = useState<'borrar' | 'bloquear' | null>(null)
  const mio = post.usuario_id === yo.id
  const copiar = () => {
    const url = `${window.location.origin}/p/${post.id}`
    navigator.clipboard
      .writeText(url)
      .then(() => snackbar('Enlace copiado'))
      .catch(() => snackbar('No se pudo copiar el enlace'))
  }
  const acciones: MenuAction[] = mio
    ? [
        { label: 'Eliminar', icon: 'delete', destructive: true, onClick: () => setConfirm('borrar') },
        { label: 'Copiar enlace', icon: 'link', onClick: copiar },
      ]
    : [
        { label: 'Bloquear', icon: 'block', destructive: true, onClick: () => setConfirm('bloquear') },
        { label: 'Ir a la publicación', icon: 'open_in_new', onClick: () => navigate(`/p/${post.id}`) },
        { label: 'Copiar enlace', icon: 'link', onClick: copiar },
      ]
  const borrar = async () => {
    try {
      await postsApi.borrarPost(post.id)
      snackbar('Publicación eliminada')
      onDeleted?.()
    } catch (e) {
      snackbar(mensajeDeError(e))
    }
  }
  const bloquear = async () => {
    try {
      await usuariosApi.bloquear(post.usuario_id)
      snackbar(`Bloqueaste a ${post.autor_username}`)
      onBlocked?.()
    } catch (e) {
      snackbar(mensajeDeError(e))
    }
  }
  return (
    <>
      <IconButton icon="more_horiz" label="Más opciones" size={22} onClick={() => setMenu(true)} />
      <ActionMenu open={menu} onClose={() => setMenu(false)} actions={acciones} />
      <Confirm
        open={confirm === 'borrar'}
        title="¿Eliminar publicación?"
        text="Esta acción no se puede deshacer."
        confirmLabel="Eliminar"
        destructive
        onConfirm={() => void borrar()}
        onClose={() => setConfirm(null)}
      />
      <Confirm
        open={confirm === 'bloquear'}
        title={`¿Bloquear a ${post.autor_username}?`}
        text="No podrá ver tu perfil ni tus publicaciones, y se eliminarán los seguimientos entre ustedes."
        confirmLabel="Bloquear"
        destructive
        onConfirm={() => void bloquear()}
        onClose={() => setConfirm(null)}
      />
    </>
  )
}

/** Fila de acciones: like, comentar, compartir y guardar a la derecha. */
export function PostActions({
  post,
  meGusta,
  onLike,
  onComment,
  onShare,
}: {
  post: Post
  meGusta: boolean
  onLike: () => void
  onComment: () => void
  onShare: () => void
}) {
  const yo = useYo()
  const rep = useRepost(post)
  const [guardado, setGuardado] = useState(() => estaGuardado(post.id))
  return (
    <div className="flex items-center">
      <IconButton
        icon="favorite"
        label={meGusta ? 'Ya no me gusta' : 'Me gusta'}
        active={meGusta}
        activeClassName="text-error pop"
        aria-pressed={meGusta}
        onClick={onLike}
      />
      <IconButton icon="chat_bubble" label="Comentar" onClick={onComment} />
      <IconButton icon="send" label="Compartir" onClick={onShare} />
      {post.usuario_id !== yo.id && (
        <span className="flex items-center">
          <IconButton
            icon="repeat"
            label={rep.republicado ? 'Quitar republicación' : 'Republicar'}
            active={rep.republicado}
            activeClassName="text-primary pop"
            aria-pressed={rep.republicado}
            onClick={() => void rep.alternar()}
          />
          {rep.cantidad > 0 && <span className="type-label-m -ml-2 text-on-surface-variant">{numeroCorto(rep.cantidad)}</span>}
        </span>
      )}
      <span className="flex-1" />
      <IconButton
        icon="bookmark"
        label={guardado ? 'Quitar de guardados' : 'Guardar'}
        active={guardado}
        aria-pressed={guardado}
        onClick={() => {
          const v = alternarGuardado(post.id)
          setGuardado(v)
          snackbar(v ? 'Guardado' : 'Eliminado de guardados')
        }}
      />
    </div>
  )
}

/** Publicación en el feed, con el orden exacto de Instagram. */
export function PostCard({ post, onDeleted }: { post: Post; onDeleted?: () => void }) {
  const navigate = useNavigate()
  const location = useLocation()
  const isMobile = useIsMobile()
  const { meGusta, likes, set } = useLike(post)
  const [comentariosN, setComentariosN] = useState(post.cantidad_comentarios)
  const [misComentarios, setMisComentarios] = useState<Comentario[]>([])
  const [expandida, setExpandida] = useState(false)
  const [sheet, setSheet] = useState<'comentarios' | 'likes' | 'compartir' | null>(null)
  const estilo = useUi((s) => s.estilo)
  const hueco = isMobile && estilo.ui === 'blob' && estilo.bordes === 'irregulares'
  const solido = isMobile && estilo.ui === 'blob' && estilo.bordes === 'solidos'

  const abrirPost = () => {
    if (isMobile) navegarConZoom(navigate, `/p/${post.id}`)
    else navigate(`/p/${post.id}`, { state: { background: location } })
  }
  const abrirComentarios = () => {
    if (isMobile) setSheet('comentarios')
    else navigate(`/p/${post.id}`, { state: { background: location } })
  }
  const desc = post.descripcion ?? ''
  const larga = desc.length > LIMITE_DESCRIPCION

  return (
    <article
      data-feed-post
      className="mb-4 scroll-mt-[64px] pb-2 md:mb-2 border-outline-variant [[data-estilo=clasica]_&]:border-b md:scroll-mt-4 md:border-b md:border-outline-variant md:pb-4"
      aria-label={`Publicación de ${post.autor_username}`}
    >
      {post.repostado_por && (
        <p className="type-label-m flex items-center gap-1.5 px-3 pt-2 text-on-surface-variant md:px-0">
          <Icon name="repeat" size={16} />
          <Link to={`/${post.repostado_por.username}`} className="emphasized">
            {post.repostado_por.username}
          </Link>
          republicó
        </p>
      )}
      {hueco ? (
        <HuecoPost
          fondo={post.url_imagen}
          avatar={
            <Link to={`/${post.autor_username}`} aria-label={`Perfil de ${post.autor_username}`}>
              <Avatar username={post.autor_username} size={54} alt="" />
            </Link>
          }
          encabezado={
            <>
              <p className="min-w-0 flex-1">
                <Link to={`/${post.autor_username}`} className="type-title-s emphasized block truncate font-semibold">
                  {post.autor_username}
                </Link>
                <span className="type-body-s block text-on-surface-variant">{tiempoCorto(post.fecha_publicacion)}</span>
              </p>
              <PostMenu post={post} onDeleted={onDeleted} onBlocked={onDeleted} />
            </>
          }
        >
          <PostMedia post={post} onDoubleLike={() => void set(true)} onOpen={abrirPost} />
        </HuecoPost>
      ) : (
        <>
          <header className="flex items-center gap-2.5 px-3 py-2 md:px-0">
            <Link to={`/${post.autor_username}`} className="shrink-0">
              <Avatar username={post.autor_username} size={32} />
            </Link>
            <p className="type-label-l min-w-0 flex-1 truncate">
              <Link to={`/${post.autor_username}`} className="emphasized font-semibold">
                {post.autor_username}
              </Link>
              <span className="text-on-surface-variant"> • {tiempoCorto(post.fecha_publicacion)}</span>
            </p>
            <PostMenu post={post} onDeleted={onDeleted} onBlocked={onDeleted} />
          </header>
          <div className={solido ? 'mx-1 overflow-hidden rounded-[28px] [corner-shape:squircle]' : 'md:overflow-hidden md:rounded-xs'}>
            <PostMedia post={post} onDoubleLike={() => void set(true)} onOpen={abrirPost} />
          </div>
        </>
      )}

      <div className="px-1 pt-1 md:px-0">
        <PostActions
          post={post}
          meGusta={meGusta}
          onLike={() => void set(!meGusta)}
          onComment={abrirComentarios}
          onShare={() => setSheet('compartir')}
        />
      </div>

      <div className="space-y-1 px-3 md:px-0">
        {likes > 0 && (
          <button type="button" className="type-label-l emphasized font-semibold" onClick={() => setSheet('likes')}>
            {numeroCorto(likes)} Me gusta
          </button>
        )}
        {desc && (
          <p className="type-body-m break-words">
            <Link to={`/${post.autor_username}`} className="emphasized mr-1.5 font-semibold">
              {post.autor_username}
            </Link>
            <RichText text={larga && !expandida ? `${desc.slice(0, LIMITE_DESCRIPCION).trimEnd()}` : desc} />
            {larga && !expandida && (
              <button type="button" className="ml-1 text-on-surface-variant" onClick={() => setExpandida(true)}>
                … más
              </button>
            )}
          </p>
        )}
        {comentariosN > 0 && (
          <button type="button" className="type-body-m block text-on-surface-variant" onClick={abrirComentarios}>
            {comentariosN === 1 ? 'Ver 1 comentario' : `Ver los ${numeroCorto(comentariosN)} comentarios`}
          </button>
        )}
        {misComentarios.map((c) => {
          const d = decodificar(c.texto)
          return (
            <div key={c.id} className="anim-fade-in">
              <p className="type-body-m break-words">
                <span className="emphasized mr-1.5 font-semibold">{c.autor_username}</span>
                <RichText text={d.texto.replace(/\u200b/g, '')} />
              </p>
              {d.media && <MediaAdjunta media={d.media} className="mt-1" />}
            </div>
          )
        })}
        <CajaComentario
          postId={post.id}
          onComentado={(c) => {
            setMisComentarios((prev) => [...prev, c])
            setComentariosN((n) => n + 1)
          }}
        />
      </div>

      <CommentsSheet
        postId={post.id}
        postOwnerId={post.usuario_id}
        open={sheet === 'comentarios'}
        onClose={() => setSheet(null)}
        onCountChange={(d) => setComentariosN((n) => n + d)}
      />
      <LikesSheet postId={post.id} open={sheet === 'likes'} onClose={() => setSheet(null)} />
      <ShareSheet postId={post.id} open={sheet === 'compartir'} onClose={() => setSheet(null)} />
    </article>
  )
}
