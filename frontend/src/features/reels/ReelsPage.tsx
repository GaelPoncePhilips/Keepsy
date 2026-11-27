import { emitirLike } from '../../lib/eventos'
import { useCallback, useEffect, useRef, useState } from 'react'
import { navegarConZoom } from '../../lib/transicion'
import { Link, useNavigate, useParams } from 'react-router'
import { FollowButton } from '../../components/shared'
import { Avatar } from '../../components/ui/Avatar'
import { Ambient } from '../../components/ui/Ambient'
import { Button } from '../../components/ui/Button'
import { CenteredLoader, EmptyState, ErrorState } from '../../components/ui/Feedback'
import { Icon } from '../../components/ui/Icon'
import { IconButton } from '../../components/ui/IconButton'
import { vibrar } from '../../lib/haptics'
import { cn, useAsync, useInfinite, useIsMobile } from '../../lib/hooks'
import { numeroCorto } from '../../lib/time'
import { ApiError, mensajeDeError } from '../../services/client'
import { darLike, obtenerPost, quitarLike, reelsFeed } from '../../services/posts'
import { alternarGuardado, estaGuardado } from '../../services/temporal/local'
import { useRepost } from '../post/PostCard'
import { perfil } from '../../services/usuarios'
import { useYo } from '../../stores/session'
import { snackbar } from '../../stores/ui'
import type { Post, Relacion } from '../../types/api'
import { CommentsSheet } from '../post/CommentsSheet'
import { ShareSheet } from '../post/ShareSheet'

/** Descripción con hashtags clickeables, 2 líneas con "más". */
function Descripcion({ texto }: { texto: string }) {
  const [abierta, setAbierta] = useState(false)
  const partes = texto.split(/(#[\p{L}\p{N}_]+)/u)
  return (
    <div className="type-body-m text-white">
      <p className={cn('break-words', !abierta && 'line-clamp-2')}>
        {partes.map((p, i) =>
          p.startsWith('#') && p.length > 1 ? (
            <Link key={i} to={`/hashtags/${encodeURIComponent(p.slice(1))}`} className="emphasized">
              {p}
            </Link>
          ) : (
            <span key={i}>{p}</span>
          ),
        )}
      </p>
      {!abierta && texto.length > 80 && (
        <button type="button" onClick={() => setAbierta(true)} className="text-white/70">
          más
        </button>
      )}
    </div>
  )
}

/** Relación con el autor, precargada para que "Seguir" esté desde el primer cuadro (no al terminar de bajar). */
const cacheRelacion = new Map<string, Promise<{ relacion: Relacion; esPrivada: boolean }>>()
function relacionDe(username: string) {
  let p = cacheRelacion.get(username)
  if (!p) {
    p = perfil(username).then((x) => ({ relacion: x.relacion, esPrivada: x.es_privada }))
    p.catch(() => cacheRelacion.delete(username))
    cacheRelacion.set(username, p)
  }
  return p
}

function ReelItem({
  post,
  mobile,
  muted,
  onToggleMute,
}: {
  post: Post
  mobile: boolean
  muted: boolean
  onToggleMute: () => void
}) {
  const yo = useYo()
  const raiz = useRef<HTMLElement>(null)
  const video = useRef<HTMLVideoElement>(null)
  const ultimoTap = useRef(0)
  const timerTap = useRef(0)
  const [visible, setVisible] = useState(false)
  const [pausado, setPausado] = useState(false)
  const [corazon, setCorazon] = useState(0)
  const [liked, setLiked] = useState(post.me_gusta)
  const [likes, setLikes] = useState(post.cantidad_likes)
  const [comentarios, setComentarios] = useState(post.cantidad_comentarios)
  const [guardado, setGuardado] = useState(() => estaGuardado(post.id))
  const [verComentarios, setVerComentarios] = useState(false)
  const [compartir, setCompartir] = useState(false)
  const [relacion, setRelacion] = useState<Relacion | null>(null)
  const [esPrivada, setEsPrivada] = useState<boolean | undefined>(undefined)
  const esMio = post.usuario_id === yo.id
  const rep = useRepost(post)

  useEffect(() => {
    const el = raiz.current
    if (!el) return
    const io = new IntersectionObserver(([e]) => {
      const v = e.intersectionRatio >= 0.6
      setVisible(v)
      if (!v) setPausado(false)
    }, { threshold: [0, 0.6, 1] })
    io.observe(el)
    return () => io.disconnect()
  }, [])

  // Reproduce solo el reel visible.
  useEffect(() => {
    const v = video.current
    if (!v) return
    if (visible && !pausado) void v.play().catch(() => undefined)
    else v.pause()
    if (!visible) {
      v.currentTime = 0
    }
  }, [visible, pausado])

  // Relación precargada al montar el reel: el botón Seguir ya está cuando llega la tarjeta.
  useEffect(() => {
    if (esMio || relacion !== null) return
    let vivo = true
    relacionDe(post.autor_username)
      .then((r) => {
        if (!vivo) return
        setRelacion(r.relacion)
        setEsPrivada(r.esPrivada)
      })
      .catch(() => undefined)
    return () => {
      vivo = false
    }
  }, [esMio, relacion, post.autor_username])

  useEffect(() => () => window.clearTimeout(timerTap.current), [])

  const ponerLike = async (quiere: boolean) => {
    if (quiere === liked) return
    setLiked(quiere)
    setLikes((n) => n + (quiere ? 1 : -1))
    vibrar(quiere ? 'click' : 'tick')
    try {
      if (quiere) {
        const p = await darLike(post.id)
        setLikes(p.cantidad_likes)
        emitirLike({ postId: post.id, meGusta: true, cantidad: p.cantidad_likes })
      } else {
        await quitarLike(post.id)
        emitirLike({ postId: post.id, meGusta: false, cantidad: Math.max(0, likes - 1) })
      }
    } catch (e) {
      setLiked(!quiere)
      setLikes((n) => n + (quiere ? -1 : 1))
      snackbar(mensajeDeError(e))
    }
  }

  const tocar = () => {
    const ahora = Date.now()
    if (ahora - ultimoTap.current < 300) {
      window.clearTimeout(timerTap.current)
      ultimoTap.current = 0
      setCorazon((c) => c + 1)
      void ponerLike(true)
      return
    }
    ultimoTap.current = ahora
    timerTap.current = window.setTimeout(() => setPausado((p) => !p), 300)
  }

  const sobre = mobile // iconos blancos sobre el video
  const claseIcono = sobre ? 'text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.6)]' : 'text-on-surface'
  const contador = (n: number) => (
    <span className={cn('type-label-m -mt-1', sobre ? 'text-white drop-shadow' : 'text-on-surface')}>{numeroCorto(n)}</span>
  )

  const acciones = (
    <div className="flex flex-col items-center gap-2">
      <div className="flex flex-col items-center">
        <IconButton
          icon="favorite"
          label={liked ? 'Quitar me gusta' : 'Me gusta'}
          active={liked}
          aria-pressed={liked}
          className={liked ? 'text-error' : claseIcono}
          onClick={() => void ponerLike(!liked)}
        />
        {contador(likes)}
      </div>
      <div className="flex flex-col items-center">
        <IconButton icon="chat_bubble" label="Comentarios" className={claseIcono} onClick={() => setVerComentarios(true)} />
        {contador(comentarios)}
      </div>
      <IconButton icon="send" label="Compartir" className={claseIcono} onClick={() => setCompartir(true)} />
      {!esMio && (
        <div className="flex flex-col items-center">
          <IconButton
            icon="repeat"
            label={rep.republicado ? 'Quitar republicación' : 'Republicar'}
            active={rep.republicado}
            aria-pressed={rep.republicado}
            className={rep.republicado ? 'text-primary-container' : claseIcono}
            activeClassName="pop"
            onClick={() => void rep.alternar()}
          />
          {rep.cantidad > 0 && contador(rep.cantidad)}
        </div>
      )}
      <IconButton
        icon="bookmark"
        label={guardado ? 'Quitar de guardados' : 'Guardar'}
        active={guardado}
        aria-pressed={guardado}
        className={claseIcono}
        onClick={() => setGuardado(alternarGuardado(post.id))}
      />
    </div>
  )

  const tarjeta = (
    <div className={cn('relative overflow-hidden bg-black', mobile ? 'size-full' : 'h-[calc(100dvh-32px)] rounded-md')} style={mobile ? undefined : { aspectRatio: '9 / 16' }}>
      {post.url_imagen && (
        <img src={post.url_imagen} alt="" aria-hidden="true" className="absolute inset-0 size-full scale-110 object-cover opacity-50 blur-2xl" />
      )}
      <video
        ref={video}
        src={post.url_video ?? undefined}
        poster={post.url_imagen}
        muted={muted}
        loop
        playsInline
        preload="metadata"
        className="relative size-full object-contain"
      />
      <button type="button" aria-label={pausado ? 'Reproducir' : 'Pausar'} onClick={tocar} className="absolute inset-0 cursor-pointer">
        {pausado && (
          <span className="absolute top-1/2 left-1/2 flex size-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 text-white">
            <Icon name="play_arrow" fill size={40} />
          </span>
        )}
        {corazon > 0 && (
          <span key={corazon} className="heart-pop absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-white drop-shadow-lg" aria-hidden="true">
            <Icon name="favorite" fill size={96} />
          </span>
        )}
      </button>
      {/* IconButton trae `relative`: el posicionamiento va en un contenedor propio. */}
      <span className="absolute top-[calc(12px+env(safe-area-inset-top))] left-3 z-20">
        <IconButton
          icon={muted ? 'volume_off' : 'volume_up'}
          label={muted ? 'Activar sonido' : 'Silenciar'}
          size={20}
          className="bg-black/40 text-white"
          onClick={onToggleMute}
        />
      </span>
      <div className={cn('pointer-events-none absolute inset-x-0 bottom-0 z-10 flex items-end gap-3 bg-gradient-to-t from-black/60 via-black/25 to-transparent px-4 pt-16 pb-4', mobile && 'pr-2')}>
        <div className="pointer-events-auto flex min-w-0 flex-1 flex-col gap-2">
          <div className="flex items-center gap-2">
            <Link to={`/${post.autor_username}`} className="flex min-w-0 items-center gap-2 text-white">
              <Avatar username={post.autor_username} size={32} />
              <span className="type-label-l emphasized truncate">{post.autor_username}</span>
            </Link>
            {!esMio &&
              (relacion === null ? (
                <span className="skeleton h-8 w-[76px] rounded-full opacity-60" aria-hidden="true" />
              ) : (
                relacion !== 'yo' && <FollowButton usuarioId={post.usuario_id} relacion={relacion} esPrivada={esPrivada} size="xs" onChange={setRelacion} />
              ))}
          </div>
          {post.descripcion && <Descripcion texto={post.descripcion} />}
        </div>
        {mobile && <div className="pointer-events-auto">{acciones}</div>}
      </div>
    </div>
  )

  return (
    <section ref={raiz} aria-label={`Reel de ${post.autor_username}`} className="relative flex h-full w-full snap-start snap-always items-center justify-center gap-4">
      {!mobile && <Ambient src={post.url_imagen} active={visible} />}
      {/* En móvil la tarjeta ocupa todo el visor: los controles quedan anclados al borde inferior de la
          pantalla y el silencio arriba a la izquierda, aunque el video no sea 9:16. */}
      <div className={cn('relative z-10 flex items-center justify-center gap-4', mobile && 'size-full')}>
        {tarjeta}
        {!mobile && <div className="self-end pb-4">{acciones}</div>}
      </div>
      <CommentsSheet
        postId={post.id}
        postOwnerId={post.usuario_id}
        open={verComentarios}
        onClose={() => setVerComentarios(false)}
        onCountChange={(d) => setComentarios((c) => Math.max(0, c + d))}
      />
      <ShareSheet postId={post.id} open={compartir} onClose={() => setCompartir(false)} />
    </section>
  )
}

/** Salir de los reels: vuelve atrás si hay historial; si no, al inicio. */
function useVolver() {
  const navigate = useNavigate()
  return useCallback(() => {
    navegarConZoom(navigate, -1)
  }, [navigate])
}

export function ReelsPage() {
  const yo = useYo()
  const { id } = useParams()
  const navigate = useNavigate()
  const volver = useVolver()
  const mobile = useIsMobile()
  const lista = useRef<HTMLDivElement>(null)
  const [muted, setMuted] = useState(true)
  const inicial = useAsync<Post | null>(async () => {
    if (!id) return null
    // Un reintento: una falla de red puntual no debe mandar al usuario a otro reel.
    for (let i = 0; i < 2; i++) {
      try {
        const p = await obtenerPost(Number(id))
        return p.tipo === 'reel' ? p : null
      } catch {
        /* reintenta */
      }
    }
    return null
  }, [id])
  const { items, error, loading, done, reload, sentinelRef } = useInfinite((offset, limit) => reelsFeed(yo.id, { offset, limit }), [yo.id], 10)

  // ↑/↓ (y J/K) pasan al reel anterior/siguiente.
  const saltar = useCallback((dir: 1 | -1) => {
    const c = lista.current
    if (!c) return
    vibrar('tick')
    c.scrollBy({ top: dir * c.clientHeight, behavior: 'smooth' })
  }, [])
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return
      const t = e.target
      if (t instanceof Element && t.closest('input, textarea, select, [contenteditable="true"]')) return
      if (document.body.style.overflow === 'hidden') return
      if (e.key === 'ArrowDown' || e.key === 'j') saltar(1)
      else if (e.key === 'ArrowUp' || e.key === 'k') saltar(-1)
      else return
      e.preventDefault()
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [saltar])

  const primero = inicial.data ?? null
  // Con un reel concreto abierto (desde el perfil) se muestra aunque falle o esté vacío el feed recomendado.
  if (!primero && error instanceof ApiError && error.status === 403 && items.length === 0) {
    return (
      <EmptyState
        icon="movie_off"
        title="Desactivaste los reels"
        text="Podés volver a activarlos desde los ajustes de tu cuenta."
        action={<Button onClick={() => navigate('/cuenta/ajustes')}>Ir a ajustes</Button>}
      />
    )
  }
  if (!primero && error && items.length === 0) return <ErrorState error={error} onRetry={reload} />
  if (inicial.loading || (!primero && loading && items.length === 0)) return <CenteredLoader className="pt-24" />

  const reels = primero ? [primero, ...items.filter((p) => p.id !== primero.id)] : items
  if (done && reels.length === 0) return <EmptyState icon="movie" title="No hay reels por ahora" text="Volvé más tarde para ver nuevos reels." />

  return (
    <div className="relative">
      <span
        className={cn(
          'absolute z-20',
          mobile ? 'top-[calc(12px+env(safe-area-inset-top))] right-3' : 'top-3 left-3',
        )}
      >
        <IconButton
          icon="arrow_back"
          label="Volver"
          variant={mobile ? 'standard' : 'tonal'}
          className={mobile ? 'bg-black/35 text-white' : undefined}
          onClick={volver}
        />
      </span>
      {!mobile && (
        <div className="fixed top-1/2 right-6 z-20 flex -translate-y-1/2 flex-col gap-3">
          <IconButton icon="keyboard_arrow_up" label="Reel anterior" variant="tonal" onClick={() => saltar(-1)} />
          <IconButton icon="keyboard_arrow_down" label="Reel siguiente" variant="tonal" onClick={() => saltar(1)} />
        </div>
      )}
      <div
        ref={lista}
        className={cn(
          'no-scrollbar snap-y snap-mandatory overflow-y-scroll overscroll-contain bg-black md:bg-transparent',
          mobile ? 'h-[calc(100dvh-var(--nav-h)-env(safe-area-inset-bottom))]' : 'h-dvh',
        )}
      >
        {reels.map((p) => (
          <ReelItem key={p.id} post={p} mobile={mobile} muted={muted} onToggleMute={() => setMuted((m) => !m)} />
        ))}
        <div ref={sentinelRef} aria-hidden="true" className="h-1" />
        {loading && <CenteredLoader />}
        {error && reels.length > 0 && <ErrorState error={error} onRetry={reload} />}
      </div>
    </div>
  )
}
