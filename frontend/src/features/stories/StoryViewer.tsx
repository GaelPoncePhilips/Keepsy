import type { PointerEvent as ReactPointerEvent } from 'react'
import { navegarConZoom } from '../../lib/transicion'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import { Ambient } from '../../components/ui/Ambient'
import { Avatar } from '../../components/ui/Avatar'
import { CenteredLoader, EmptyState, ErrorState } from '../../components/ui/Feedback'
import { Icon } from '../../components/ui/Icon'
import { IconButton } from '../../components/ui/IconButton'
import { ActionMenu, Confirm, type MenuAction } from '../../components/ui/Overlay'
import { vibrar } from '../../lib/haptics'
import { cn, useAsync, useIsDesktop } from '../../lib/hooks'
import { tiempoCorto } from '../../lib/time'
import { ApiError, mensajeDeError } from '../../services/client'
import { enviarAUsuario } from '../../services/dms'
import * as storiesApi from '../../services/stories'
import { usuarioPorId } from '../../services/temporal'
import { useYo } from '../../stores/session'
import { useStoriesVistas } from '../../stores/storiesVistas'
import { snackbar } from '../../stores/ui'
import type { Story, UsuarioResumen } from '../../types/api'
import { ShareSheet } from '../post/ShareSheet'
import { DestacarSheet, descargarStory, TextoStory, useLikeStory, VistasSheet } from './StorySocial'

type Modo = 'usuario' | 'destacada' | 'story'
const RAPIDAS = ['😍', '😂', '🔥', '👏', '😮', '😢']

const DURACION_MS = 5000

interface Grupo {
  usuario: UsuarioResumen
  stories: Story[]
  /** Destacadas: varias del mismo usuario; identifica cada grupo. */
  clave?: string
}

interface Cola {
  grupos: Grupo[]
  inicio: number
}

function primeraNoVista(g: Grupo | undefined): number {
  if (!g) return 0
  const i = g.stories.findIndex((s) => !s.vista)
  return i < 0 ? 0 : i
}

async function cargarCola(modo: Modo, param: number, yo: UsuarioResumen, solo = false): Promise<Cola> {
  if (modo === 'story') {
    // Story suelta (notificaciones, DMs, archivo): vale también para vencidas propias o destacadas.
    const st = await storiesApi.obtenerStory(param)
    const usuario = st.usuario_id === yo.id ? yo : await usuarioPorId(st.usuario_id)
    return { grupos: [{ usuario, stories: [{ ...st, vista: true }] }], inicio: 0 }
  }
  if (modo === 'destacada') {
    const d = await storiesApi.obtenerDestacada(param)
    const usuario = d.usuario_id === yo.id ? yo : await usuarioPorId(d.usuario_id)
    // Todas las destacadas del usuario en orden: se pasa de una a otra sin salir del visor.
    const todas = await storiesApi.destacadasDe(d.usuario_id).catch(() => [d])
    const lista = todas.some((x) => x.id === d.id) ? todas.map((x) => (x.id === d.id ? d : x)) : [d]
    const grupos: Grupo[] = lista.map((x) => ({ usuario, clave: `d${x.id}`, stories: x.stories.map((s) => ({ ...s, vista: true })) }))
    return { grupos, inicio: Math.max(0, lista.findIndex((x) => x.id === d.id)) }
  }
  if (solo) {
    // Desde un perfil: solo las stories de esa persona (no salta a las de otros).
    const stories = await storiesApi.storiesPublicadas(param)
    const usuario = param === yo.id ? yo : await usuarioPorId(param)
    return { grupos: [{ usuario, stories: param === yo.id ? stories.map((s) => ({ ...s, vista: true })) : stories }], inicio: 0 }
  }
  const seguidos = await storiesApi.storiesDeSeguidos(yo.id)
  const grupos: Grupo[] = seguidos.filter((g) => g.stories.length > 0).map((g) => ({ usuario: g.usuario, stories: g.stories }))
  if (param === yo.id) {
    const mias = await storiesApi.storiesPublicadas(yo.id)
    if (mias.length > 0) grupos.unshift({ usuario: yo, stories: mias.map((s) => ({ ...s, vista: true })) })
  }
  const idx = grupos.findIndex((g) => g.usuario.id === param)
  if (idx >= 0) return { grupos, inicio: idx }
  const stories = await storiesApi.storiesPublicadas(param)
  const usuario = await usuarioPorId(param)
  return { grupos: [{ usuario, stories }], inicio: 0 }
}

export function StoryViewerPage({ modo }: { modo: Modo }) {
  const params = useParams()
  const navigate = useNavigate()
  const yo = useYo()
  const param = Number(modo === 'usuario' ? params.usuarioId : params.id)
  const yoResumen: UsuarioResumen = { id: yo.id, username: yo.username, nombre: yo.nombre }
  const [busqueda] = useSearchParams()
  const solo = busqueda.get('solo') === '1'
  const { data, error, loading, reload } = useAsync(() => cargarCola(modo, param, yoResumen, solo), [modo, param, yo.id, solo])
  const cerrar = useCallback(() => {
    navegarConZoom(navigate, -1)
  }, [navigate])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black text-white" role="dialog" aria-modal="true" aria-label="Stories">
      {loading && !data ? (
        <CenteredLoader />
      ) : error ? (
        <div className="rounded-lg bg-surface p-4 text-on-surface">
          {error instanceof ApiError && error.status === 403 ? (
            <EmptyState icon="lock" title="Esta cuenta es privada" />
          ) : error instanceof ApiError && error.status === 404 ? (
            <EmptyState icon="link_off" title="Esta story no está disponible" />
          ) : (
            <ErrorState error={error} onRetry={reload} />
          )}
          <button type="button" className="type-label-l mt-2 w-full text-primary" onClick={cerrar}>
            Cerrar
          </button>
        </div>
      ) : data && data.grupos.some((g) => g.stories.length > 0) ? (
        <Visor key={`${modo}-${param}`} cola={data} onCerrar={cerrar} />
      ) : (
        <div className="rounded-lg bg-surface p-4 text-on-surface">
          <EmptyState icon="history_toggle_off" title="No hay stories para ver" />
          <button type="button" className="type-label-l mt-2 w-full text-primary" onClick={cerrar}>
            Cerrar
          </button>
        </div>
      )}
    </div>
  )
}

function Visor({ cola, onCerrar }: { cola: Cola; onCerrar: () => void }) {
  const yo = useYo()
  const navigate = useNavigate()
  const isDesktop = useIsDesktop()
  const [grupos, setGrupos] = useState<Grupo[]>(() => cola.grupos.filter((g) => g.stories.length > 0))
  const inicioGrupo = Math.max(
    0,
    grupos.findIndex((g) =>
      cola.grupos[cola.inicio]?.clave ? g.clave === cola.grupos[cola.inicio]?.clave : g.usuario.id === cola.grupos[cola.inicio]?.usuario.id,
    ),
  )
  const [pos, setPos] = useState(() => ({ g: inicioGrupo, s: primeraNoVista(grupos[inicioGrupo]) }))
  const [pausaPress, setPausaPress] = useState(false)
  const [pausaUi, setPausaUi] = useState(false)
  const [vistasAbiertas, setVistasAbiertas] = useState<'vistas' | 'likes' | null>(null)
  const [menu, setMenu] = useState(false)
  const [confirmar, setConfirmar] = useState(false)
  const [compartir, setCompartir] = useState(false)
  const [destacar, setDestacar] = useState(false)
  const [escribiendo, setEscribiendo] = useState(false)
  const marcarVista = useStoriesVistas((s) => s.marcar)
  const registradas = useRef(new Set<number>())
  const pressTimer = useRef<number | null>(null)
  const fuePausa = useRef(false)

  const grupo = grupos[pos.g]
  const story = grupo?.stories[pos.s]
  const esMia = grupo?.usuario.id === yo.id
  const hojaAbierta = vistasAbiertas !== null || menu || confirmar || compartir || destacar
  const pausado = pausaPress || pausaUi || hojaAbierta || escribiendo

  // Sin efectos dentro del updater de setState (en StrictMode corría dos veces y cerraba/retrocedía de más).
  const posRef = useRef(pos)
  useEffect(() => {
    posRef.current = pos
  }, [pos])
  const siguiente = useCallback(() => {
    const p = posRef.current
    const g = grupos[p.g]
    if (g && p.s < g.stories.length - 1) setPos({ g: p.g, s: p.s + 1 })
    else if (p.g < grupos.length - 1) setPos({ g: p.g + 1, s: primeraNoVista(grupos[p.g + 1]) })
    else onCerrar()
  }, [grupos, onCerrar])

  const anterior = useCallback(() => {
    setPos((p) => {
      if (p.s > 0) return { g: p.g, s: p.s - 1 }
      if (p.g > 0) return { g: p.g - 1, s: 0 }
      return { g: p.g, s: 0 }
    })
  }, [])

  // Registrar vista (una vez por story; el servidor solo cuenta las ajenas) y marcarla vista en la fila.
  useEffect(() => {
    if (!story || registradas.current.has(story.id)) return
    registradas.current.add(story.id)
    marcarVista(story.id, esMia)
    if (!esMia && !story.vista) storiesApi.registrarVista(story.id).catch(() => undefined)
  }, [story, esMia, marcarVista])

  // Precargar la siguiente imagen
  useEffect(() => {
    if (!grupo) return
    const prox = grupo.stories[pos.s + 1] ?? grupos[pos.g + 1]?.stories[0]
    if (prox) {
      const img = new Image()
      img.src = prox.url_imagen
    }
  }, [grupo, grupos, pos])

  // Teclado
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (hojaAbierta || escribiendo) return
      if (e.key === 'ArrowRight') siguiente()
      else if (e.key === 'ArrowLeft') anterior()
      else if (e.key === 'Escape') onCerrar()
      else if (e.key === ' ') {
        e.preventDefault()
        setPausaUi((v) => !v)
      } else return
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [siguiente, anterior, onCerrar, hojaAbierta, escribiendo])

  const inicioToque = useRef<{ x: number; y: number } | null>(null)
  const saltarGrupo = (dir: 1 | -1) => {
    const p = posRef.current
    const g = p.g + dir
    if (g < 0) setPos({ g: p.g, s: 0 })
    else if (g >= grupos.length) onCerrar()
    else setPos({ g, s: dir > 0 ? primeraNoVista(grupos[g]) : 0 })
  }
  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    inicioToque.current = { x: e.clientX, y: e.clientY }
    fuePausa.current = false
    pressTimer.current = window.setTimeout(() => {
      fuePausa.current = true
      setPausaPress(true)
    }, 200)
  }
  const onPointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (pressTimer.current !== null) window.clearTimeout(pressTimer.current)
    pressTimer.current = null
    const ini = inicioToque.current
    inicioToque.current = null
    const dx = ini ? e.clientX - ini.x : 0
    const dy = ini ? e.clientY - ini.y : 0
    // Deslizar a los lados: grupo siguiente/anterior (otra persona u otra destacada). Hacia abajo: cerrar.
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy)) {
      setPausaPress(false)
      vibrar('tick')
      saltarGrupo(dx < 0 ? 1 : -1)
      return
    }
    if (dy > 100 && Math.abs(dy) > Math.abs(dx)) {
      setPausaPress(false)
      onCerrar()
      return
    }
    if (fuePausa.current) {
      setPausaPress(false)
      return
    }
    vibrar('tick')
    const r = e.currentTarget.getBoundingClientRect()
    if (e.clientX - r.left < r.width / 3) anterior()
    else siguiente()
  }
  const onPointerCancel = () => {
    if (pressTimer.current !== null) window.clearTimeout(pressTimer.current)
    setPausaPress(false)
  }

  const borrar = async () => {
    if (!story) return
    try {
      await storiesApi.borrarStory(story.id)
      snackbar('Story eliminada')
      const restantes = grupo.stories.filter((s) => s.id !== story.id)
      if (restantes.length === 0) {
        if (grupos.length === 1) {
          onCerrar()
          return
        }
        const nuevos = grupos.filter((_, i) => i !== pos.g)
        setGrupos(nuevos)
        setPos({ g: Math.min(pos.g, nuevos.length - 1), s: 0 })
      } else {
        setGrupos(grupos.map((g, i) => (i === pos.g ? { ...g, stories: restantes } : g)))
        setPos({ g: pos.g, s: Math.min(pos.s, restantes.length - 1) })
      }
    } catch (e) {
      snackbar(mensajeDeError(e))
    }
  }

  if (!grupo || !story) return null

  return (
    <div className="relative flex h-full w-full items-center justify-center gap-4">
      {isDesktop && <Ambient src={story.url_imagen} />}
      {isDesktop && (
        <IconButton
          className="relative z-10"
          icon="chevron_left"
          label="Anterior"
          variant="tonal"
          disabled={pos.g === 0 && pos.s === 0}
          onClick={anterior}
        />
      )}
      <div
        className={cn(
          'relative z-10 overflow-hidden bg-neutral-900',
          isDesktop ? 'aspect-[9/16] h-[92vh] rounded-md' : 'h-full w-full md:aspect-[9/16] md:h-[92vh] md:w-auto md:rounded-md',
        )}
      >
        <img
          key={story.id}
          src={story.url_imagen}
          alt={`Story de ${grupo.usuario.username}`}
          draggable={false}
          className="anim-fade-in absolute inset-0 size-full object-cover select-none"
        />
        {story.texto && <TextoStory key={`t${story.id}`} texto={story.texto} />}
        {/* Zona de toque */}
        <div
          className="absolute inset-0 touch-none"
          onPointerDown={onPointerDown}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerCancel}
          onPointerLeave={onPointerCancel}
          onContextMenu={(e) => e.preventDefault()}
        />
        {/* Cabecera */}
        <div className="pointer-events-none absolute inset-x-0 top-0 bg-gradient-to-b from-black/60 to-transparent px-3 pt-[max(12px,env(safe-area-inset-top))] pb-8">
          <div className="flex gap-1">
            {grupo.stories.map((s, i) => (
              <div key={s.id} className="h-0.5 flex-1 overflow-hidden rounded-full bg-white/35">
                {i < pos.s ? (
                  <div className="h-full w-full bg-white" />
                ) : i === pos.s ? (
                  <div
                    key={`${pos.g}-${pos.s}-${story.id}`}
                    className="story-progress-bar h-full w-full origin-left bg-white"
                    style={{
                      animation: `story-progress ${DURACION_MS}ms linear forwards`,
                      animationPlayState: pausado ? 'paused' : 'running',
                    }}
                    onAnimationEnd={siguiente}
                  />
                ) : null}
              </div>
            ))}
          </div>
          <div className="pointer-events-auto mt-3 flex items-center gap-2">
            <Link
              to={`/${grupo.usuario.username}`}
              aria-label={`Ir al perfil de ${grupo.usuario.username}`}
              className="flex min-w-0 items-center gap-2 text-white"
            >
              <Avatar username={grupo.usuario.username} size={32} />
              <span className="type-label-l emphasized truncate">{grupo.usuario.username}</span>
            </Link>
            <span className="type-label-m text-white/75">{tiempoCorto(story.fecha_publicacion)}</span>
            {story.solo_mejores_amigos && (
              <span
                className="flex size-6 items-center justify-center rounded-full bg-amigos text-white"
                role="img"
                aria-label="Mejores amigos"
                title="Mejores amigos"
              >
                <Icon name="crown" fill size={14} />
              </span>
            )}
            <span className="flex-1" />
            <IconButton
              icon={pausaUi ? 'play_arrow' : 'pause'}
              label={pausaUi ? 'Reanudar' : 'Pausar'}
              className="text-white"
              onClick={() => setPausaUi((v) => !v)}
            />
            <IconButton icon="more_horiz" label="Más opciones" className="text-white" onClick={() => setMenu(true)} />
            <IconButton icon="close" label="Cerrar" className="text-white" onClick={onCerrar} />
          </div>
        </div>
        {esMia ? (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center gap-4 bg-gradient-to-t [&>*]:pointer-events-auto from-black/60 to-transparent px-4 pt-8 pb-[max(12px,env(safe-area-inset-bottom))]">
            <button type="button" className="type-label-l flex items-center gap-1.5 text-white" onClick={() => setVistasAbiertas('vistas')}>
              <Icon name="visibility" size={20} />
              <VistoPor storyId={story.id} />
            </button>
            {(story.cantidad_likes ?? 0) > 0 && (
              <button type="button" className="type-label-l flex items-center gap-1.5 text-white" onClick={() => setVistasAbiertas('likes')}>
                <Icon name="favorite" fill size={20} className="text-[var(--keepsy-rosa)]" />
                {story.cantidad_likes} Me gusta
              </button>
            )}
            <span className="flex-1" />
            <IconButton icon="bookmark_add" label="Destacar" className="text-white" onClick={() => setDestacar(true)} />
            <IconButton icon="send" label="Enviar" className="text-white" onClick={() => setCompartir(true)} />
          </div>
        ) : (
          <BarraRespuesta
            key={story.id}
            story={story}
            autor={grupo.usuario}
            onFoco={setEscribiendo}
            onCompartir={() => setCompartir(true)}
          />
        )}
      </div>
      {isDesktop && (
        <IconButton
          className="relative z-10"
          icon="chevron_right"
          label="Siguiente"
          variant="tonal"
          onClick={siguiente}
        />
      )}
      <ShareSheet storyId={story.id} open={compartir} onClose={() => setCompartir(false)} />
      <ActionMenu
        open={menu}
        onClose={() => setMenu(false)}
        actions={
          esMia
            ? [
                { label: 'Destacar', icon: 'bookmark_add', onClick: () => setDestacar(true) },
                { label: 'Enviar a…', icon: 'send', onClick: () => setCompartir(true) },
                { label: 'Actividad', icon: 'insights', onClick: () => setVistasAbiertas('vistas') },
                { label: 'Descargar', icon: 'download', onClick: () => void descargarStory(story) },
                { label: 'Eliminar', icon: 'delete', destructive: true, onClick: () => setConfirmar(true) },
              ]
            : ([
                { label: 'Enviar a…', icon: 'send', onClick: () => setCompartir(true) },
                { label: 'Ir al perfil', icon: 'person', onClick: () => navigate(`/${grupo.usuario.username}`) },
              ] satisfies MenuAction[])
        }
      />
      {esMia && (
        <>
          <VistasSheet
            key={`${story.id}-${vistasAbiertas ?? ''}`}
            storyId={story.id}
            open={vistasAbiertas !== null}
            inicial={vistasAbiertas ?? 'vistas'}
            onClose={() => setVistasAbiertas(null)}
          />
          <DestacarSheet story={story} open={destacar} onClose={() => setDestacar(false)} />
          <Confirm
            open={confirmar}
            title="¿Eliminar story?"
            text="Esta acción no se puede deshacer."
            confirmLabel="Eliminar"
            destructive
            onConfirm={() => void borrar()}
            onClose={() => setConfirmar(false)}
          />
        </>
      )}
    </div>
  )
}

function VistoPor({ storyId }: { storyId: number }) {
  const { data } = useAsync(() => storiesApi.vistasDeStory(storyId), [storyId])
  return <span>Visto por {data?.length ?? 0}</span>
}

/** Barra inferior para stories ajenas: responder por mensaje (o con una reacción), me gusta y enviar. */
function BarraRespuesta({
  story,
  autor,
  onFoco,
  onCompartir,
}: {
  story: Story
  autor: UsuarioResumen
  onFoco: (v: boolean) => void
  onCompartir: () => void
}) {
  const { meGusta, pop, alternar } = useLikeStory(story)
  const [texto, setTexto] = useState('')
  const [foco, setFoco] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const cambiarFoco = (v: boolean) => {
    setFoco(v)
    onFoco(v)
  }

  const responder = async (t: string) => {
    const limpio = t.trim()
    if (!limpio || enviando) return
    setEnviando(true)
    try {
      await enviarAUsuario(autor.id, { texto: limpio, story_id: story.id })
      vibrar('exito')
      snackbar(`Respuesta enviada a ${autor.username}`)
      setTexto('')
      inputRef.current?.blur()
    } catch (e) {
      snackbar(mensajeDeError(e))
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black/70 via-black/30 to-transparent px-3 pt-10 pb-[max(12px,env(safe-area-inset-bottom))]">
      {foco && texto === '' && (
        <div className="anim-slide-up mb-3 flex justify-around" role="group" aria-label="Reacciones rápidas">
          {RAPIDAS.map((e) => (
            <button
              key={e}
              type="button"
              className="spring-spatial-fast text-3xl transition-transform active:scale-125"
              aria-label={`Responder con ${e}`}
              // Que el toque no saque el foco del campo antes del click.
              onPointerDown={(ev) => ev.preventDefault()}
              onClick={() => void responder(e)}
            >
              {e}
            </button>
          ))}
        </div>
      )}
      <form
        className="flex items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          void responder(texto)
        }}
      >
        <input
          ref={inputRef}
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onFocus={() => cambiarFoco(true)}
          onBlur={() => cambiarFoco(false)}
          maxLength={1000}
          enterKeyHint="send"
          placeholder={`Responder a ${autor.username}…`}
          aria-label={`Responder a la story de ${autor.username}`}
          className="type-body-l h-11 min-w-0 flex-1 rounded-full border border-white/60 bg-black/20 px-4 text-white outline-none placeholder:text-white/80 focus:border-white"
        />
        {texto.trim() ? (
          <button type="submit" disabled={enviando} className="type-label-l emphasized anim-fade-in px-2 text-white disabled:opacity-60">
            Enviar
          </button>
        ) : (
          <>
            <IconButton
              key={pop}
              icon="favorite"
              label={meGusta ? 'Ya no me gusta' : 'Me gusta'}
              active={meGusta}
              aria-pressed={meGusta}
              className={cn(meGusta ? 'text-[var(--keepsy-coral)]' : 'text-white', meGusta && pop > 0 && 'pop')}
              activeClassName="text-[var(--keepsy-coral)]"
              onClick={() => void alternar()}
            />
            <IconButton icon="send" label="Enviar story" className="text-white" onClick={onCompartir} />
          </>
        )}
      </form>
    </div>
  )
}
