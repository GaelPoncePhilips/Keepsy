/** Contenido de las pestañas del perfil: publicaciones, reels y archivo de stories. */
import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { GridSkeleton, PostGrid } from '../../components/shared'
import { Button } from '../../components/ui/Button'
import { EmptyState, ErrorState } from '../../components/ui/Feedback'
import { useEventoRepost } from '../../lib/eventos'
import { useAsync, useInfinite, useIsDesktop } from '../../lib/hooks'
import * as postsApi from '../../services/posts'
import * as storiesApi from '../../services/stories'
import { repostsDeUsuario } from '../../services/temporal'
import type { Story } from '../../types/api'
import { HighlightEditor } from '../highlights/HighlightEditor'
import { StoryPickGrid } from '../highlights/StoryPickGrid'
import { StoryArchivada } from '../stories/StoryArchivada'

function useLinkState() {
  const location = useLocation()
  const desktop = useIsDesktop()
  return desktop ? { background: location } : undefined
}

export function PostsTab({ usuarioId, esPropio }: { usuarioId: number; esPropio: boolean }) {
  const navigate = useNavigate()
  const linkState = useLinkState()
  const { items, error, loading, done, reload, sentinelRef } = useInfinite(
    (offset, limit) => postsApi.postsDeUsuario(usuarioId, { offset, limit }),
    [usuarioId],
    12,
  )
  if (error && items.length === 0) return <ErrorState error={error} onRetry={reload} />
  if (loading && items.length === 0) return <GridSkeleton />
  if (done && items.length === 0) {
    return esPropio ? (
      <EmptyState
        icon="photo_camera"
        title="Comparte tu primera foto"
        text="Cuando compartas fotos, aparecerán en tu perfil."
        action={<Button onClick={() => navigate('/crear/publicacion')}>Comparte tu primera foto</Button>}
      />
    ) : (
      <EmptyState icon="photo_camera" title="Aún no hay publicaciones" />
    )
  }
  return <PostGrid posts={items} sentinelRef={done ? undefined : sentinelRef} linkState={linkState} />
}

export function ReelsTab({ usuarioId, esPropio }: { usuarioId: number; esPropio: boolean }) {
  const navigate = useNavigate()
  const linkState = useLinkState()
  const { items, error, loading, done, reload, sentinelRef } = useInfinite(
    (offset, limit) => postsApi.reelsDeUsuario(usuarioId, { offset, limit }),
    [usuarioId],
    12,
  )
  if (error && items.length === 0) return <ErrorState error={error} onRetry={reload} />
  if (loading && items.length === 0) return <GridSkeleton aspect="reel" />
  return (
    <>
      {done && items.length === 0 ? (
        esPropio ? (
          <EmptyState
            icon="movie"
            title="Compartí tu primer reel"
            text="Los reels que publiques aparecen acá."
            action={<Button onClick={() => navigate('/crear/reel')}>Nuevo reel</Button>}
          />
        ) : (
          <EmptyState icon="movie" title="Aún no hay reels" />
        )
      ) : (
        <PostGrid posts={items} aspect="reel" sentinelRef={done ? undefined : sentinelRef} linkState={linkState} />
      )}
    </>
  )
}

/** TEMPORAL (hueco 13): publicaciones y reels que el usuario republicó. */
export function RepostsTab({ usuarioId, esPropio }: { usuarioId: number; esPropio: boolean }) {
  const linkState = useLinkState()
  const { items, error, loading, done, reload, sentinelRef, setItems } = useInfinite(
    (offset, limit) => repostsDeUsuario(usuarioId, { offset, limit }),
    [usuarioId],
    12,
  )
  // Republicar o quitar desde el modal / el feed actualiza la pestaña sin recargar.
  useEventoRepost((d) => {
    if (!esPropio) return
    if (d.republicado) reload()
    else setItems((prev) => prev.filter((p) => p.id !== d.postId))
  })
  if (error && items.length === 0) return <ErrorState error={error} onRetry={reload} />
  if (loading && items.length === 0) return <GridSkeleton />
  if (done && items.length === 0) {
    return (
      <EmptyState
        icon="repeat"
        title={esPropio ? 'Todavía no republicaste nada' : 'Aún no hay republicaciones'}
        text={esPropio ? 'Tocá el ícono de republicar en una publicación para mostrarla en tu perfil.' : undefined}
      />
    )
  }
  return <PostGrid posts={items} sentinelRef={done ? undefined : sentinelRef} linkState={linkState} />
}

export function ArchivoTab({ usuarioId, onDestacada }: { usuarioId: number; onDestacada?: () => void }) {
  const { data, error, loading, reload } = useAsync(() => storiesApi.archivoStories(usuarioId), [usuarioId])
  const [seleccionando, setSeleccionando] = useState(false)
  const [sel, setSel] = useState<number[]>([])
  const [viendo, setViendo] = useState<Story | null>(null)
  const [creando, setCreando] = useState(false)

  if (error) return <ErrorState error={error} onRetry={reload} />
  if (loading) return <GridSkeleton aspect="reel" />
  const stories = data ?? []
  return (
    <div>
      <div className="flex items-center justify-between gap-2 px-4 py-3">
        <p className="type-body-m text-on-surface-variant">Solo vos ves tu archivo. Tocá una story para ver quién la vio, sus me gusta o destacarla.</p>
        {stories.length > 0 &&
          (seleccionando ? (
            <span className="flex gap-2">
              <Button
                size="xs"
                variant="text"
                onClick={() => {
                  setSeleccionando(false)
                  setSel([])
                }}
              >
                Cancelar
              </Button>
              <Button size="xs" disabled={sel.length === 0} onClick={() => setCreando(true)}>
                Siguiente
              </Button>
            </span>
          ) : (
            <Button size="xs" variant="tonal" icon="add" onClick={() => setSeleccionando(true)}>
              Nueva destacada
            </Button>
          ))}
      </div>
      {stories.length === 0 ? (
        <EmptyState icon="history" title="Tu archivo está vacío" text="Las stories que publiques se guardan acá, incluso después de vencer." />
      ) : (
        <StoryPickGrid
          stories={stories}
          seleccion={sel}
          seleccionable={seleccionando}
          onClick={(s) => {
            if (seleccionando) setSel((p) => (p.includes(s.id) ? p.filter((x) => x !== s.id) : [...p, s.id]))
            else setViendo(s)
          }}
        />
      )}
      <StoryArchivada story={viendo} onClose={() => setViendo(null)} onBorrada={() => reload()} />
      <HighlightEditor
        open={creando}
        seleccionInicial={sel}
        onClose={() => setCreando(false)}
        onSaved={() => {
          onDestacada?.()
          setSeleccionando(false)
          setSel([])
        }}
      />
    </div>
  )
}
