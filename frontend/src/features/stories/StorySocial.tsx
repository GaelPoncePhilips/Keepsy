/** Piezas sociales de las stories: texto con menciones, me gusta, vistas/likes, destacar y descargar. */
import { useRef, useState } from 'react'
import { UserRow } from '../../components/shared'
import { Tabs } from '../../components/ui/Controls'
import { CenteredLoader, EmptyState, ErrorState } from '../../components/ui/Feedback'
import { Icon } from '../../components/ui/Icon'
import { Sheet } from '../../components/ui/Overlay'
import { vibrar } from '../../lib/haptics'
import { cn, useAsync } from '../../lib/hooks'
import { tiempoCorto } from '../../lib/time'
import { mensajeDeError } from '../../services/client'
import * as storiesApi from '../../services/stories'
import { useYo } from '../../stores/session'
import { snackbar } from '../../stores/ui'
import type { Story } from '../../types/api'
import { HighlightEditor } from '../highlights/HighlightEditor'
import { RichText } from '../post/RichText'

/** Texto de la story sobre la imagen (cartel centrado, legible sobre cualquier foto). */
export function TextoStory({ texto, preview }: { texto: string; preview?: boolean }) {
  return (
    <div className="pointer-events-none absolute inset-x-4 top-[58%] z-[5] flex justify-center">
      <p
        className={cn(
          'type-title-m emphasized max-w-full rounded-lg bg-black/55 px-3 py-1.5 text-center break-words whitespace-pre-line text-white',
          !preview && 'anim-scale-in',
        )}
      >
        {preview ? texto : <RichText text={texto} className="[&_a]:pointer-events-auto [&_a]:text-[var(--keepsy-rosa)] [&_a]:underline-offset-2 [&_a]:hover:underline" />}
      </p>
    </div>
  )
}

/** Me gusta de una story, optimista con rollback. */
export function useLikeStory(story: Story) {
  const [meGusta, setMeGusta] = useState(story.me_gusta ?? false)
  const [pop, setPop] = useState(0)
  const busy = useRef(false)
  const alternar = async () => {
    if (busy.current) return
    busy.current = true
    const quiere = !meGusta
    setMeGusta(quiere)
    if (quiere) setPop((n) => n + 1)
    vibrar(quiere ? 'click' : 'tick')
    try {
      const r = quiere ? await storiesApi.darLikeStory(story.id) : await storiesApi.quitarLikeStory(story.id)
      setMeGusta(r.me_gusta)
    } catch (e) {
      setMeGusta(!quiere)
      snackbar(mensajeDeError(e))
    } finally {
      busy.current = false
    }
  }
  return { meGusta, pop, alternar }
}

/** Hoja del dueño: quién la vio (con corazón si además le gustó) y a quién le gustó. */
export function VistasSheet({
  storyId,
  open,
  onClose,
  inicial = 'vistas',
}: {
  storyId: number
  open: boolean
  onClose: () => void
  inicial?: 'vistas' | 'likes'
}) {
  const [tab, setTab] = useState<'vistas' | 'likes'>(inicial)
  const vistas = useAsync(() => (open ? storiesApi.vistasDeStory(storyId) : Promise.resolve([])), [storyId, open])
  const likes = useAsync(() => (open ? storiesApi.likesDeStory(storyId) : Promise.resolve([])), [storyId, open])
  const actual = tab === 'vistas' ? vistas : likes
  return (
    <Sheet open={open} onClose={onClose} title="Actividad de la story">
      <div className="text-on-surface">
        <Tabs
          value={tab}
          onChange={(id) => setTab(id === 'likes' ? 'likes' : 'vistas')}
          items={[
            { id: 'vistas', label: `Vistas${vistas.data ? ` · ${vistas.data.length}` : ''}`, icon: 'visibility' },
            { id: 'likes', label: `Me gusta${likes.data ? ` · ${likes.data.length}` : ''}`, icon: 'favorite', tone: 'tertiary' },
          ]}
        />
        {actual.loading && !actual.data ? (
          <CenteredLoader />
        ) : actual.error ? (
          <ErrorState error={actual.error} onRetry={actual.reload} />
        ) : !actual.data || actual.data.length === 0 ? (
          tab === 'vistas' ? (
            <EmptyState icon="visibility" title="Todavía nadie vio esta story" />
          ) : (
            <EmptyState icon="favorite" title="Todavía no tiene me gusta" text="Cuando a alguien le guste, aparece acá." />
          )
        ) : (
          <div className="anim-fade-in py-2">
            {actual.data.map((v) => (
              <UserRow
                key={v.id}
                usuario={v}
                subtitle={`${v.nombre} • ${tiempoCorto(v.fecha)}`}
                onClick={onClose}
                action={
                  tab === 'likes' || ('me_gusta' in v && v.me_gusta) ? (
                    <span className="text-[var(--keepsy-coral)]" role="img" aria-label="Le gustó">
                      <Icon name="favorite" fill size={22} />
                    </span>
                  ) : undefined
                }
              />
            ))}
          </div>
        )}
      </div>
    </Sheet>
  )
}

/** Agregar una story a una destacada existente o crear una nueva con ella. */
export function DestacarSheet({ story, open, onClose }: { story: Story; open: boolean; onClose: () => void }) {
  const yo = useYo()
  const [nueva, setNueva] = useState(false)
  const [busy, setBusy] = useState<number | null>(null)
  const { data, error, loading, reload } = useAsync(
    () => (open ? storiesApi.destacadasDe(yo.id) : Promise.resolve([])),
    [yo.id, open],
  )
  const agregar = async (destacadaId: number, titulo: string, yaEsta: boolean) => {
    if (yaEsta || busy !== null) return
    setBusy(destacadaId)
    try {
      await storiesApi.agregarStoryADestacada(destacadaId, story.id)
      vibrar('exito')
      snackbar(`Agregada a «${titulo}»`)
      onClose()
    } catch (e) {
      snackbar(mensajeDeError(e))
    } finally {
      setBusy(null)
    }
  }
  return (
    <>
      <Sheet open={open && !nueva} onClose={onClose} title="Destacar">
        <div className="text-on-surface">
          <button type="button" className="state flex w-full items-center gap-3 px-4 py-3 text-left" onClick={() => setNueva(true)}>
            <span className="flex size-14 items-center justify-center rounded-full border-2 border-dashed border-outline">
              <Icon name="add" size={26} />
            </span>
            <span className="type-title-s emphasized">Nueva destacada</span>
          </button>
          {loading && !data ? (
            <CenteredLoader />
          ) : error ? (
            <ErrorState error={error} onRetry={reload} />
          ) : (
            (data ?? []).map((d) => {
              const yaEsta = d.stories.some((s) => s.id === story.id)
              const portada = d.portada_url ?? d.stories[0]?.url_imagen
              return (
                <button
                  key={d.id}
                  type="button"
                  disabled={yaEsta || busy !== null}
                  className="state flex w-full items-center gap-3 px-4 py-2 text-left disabled:opacity-60"
                  onClick={() => void agregar(d.id, d.titulo, yaEsta)}
                >
                  <span className="size-14 shrink-0 overflow-hidden rounded-full bg-surface-container-highest">
                    {portada && <img src={portada} alt="" className="size-full object-cover" loading="lazy" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="type-title-s emphasized block truncate">{d.titulo}</span>
                    <span className="type-body-s block text-on-surface-variant">
                      {d.stories.length} {d.stories.length === 1 ? 'story' : 'stories'}
                    </span>
                  </span>
                  {yaEsta ? (
                    <span className="type-label-m flex items-center gap-1 text-on-surface-variant">
                      <Icon name="check" size={18} /> Ya está
                    </span>
                  ) : busy === d.id ? (
                    <Icon name="progress_activity" className="animate-spin" size={20} />
                  ) : null}
                </button>
              )
            })
          )}
        </div>
      </Sheet>
      <HighlightEditor
        open={open && nueva}
        seleccionInicial={[story.id]}
        onClose={() => {
          setNueva(false)
          onClose()
        }}
        onSaved={() => {
          setNueva(false)
          onClose()
        }}
      />
    </>
  )
}

/** Descarga la imagen de la story; si el servidor no permite leerla (CORS), la abre en otra pestaña. */
export async function descargarStory(story: Story): Promise<void> {
  const nombre = `keepsy-story-${story.id}.jpg`
  try {
    const r = await fetch(story.url_imagen)
    if (!r.ok) throw new Error(String(r.status))
    const url = URL.createObjectURL(await r.blob())
    const a = document.createElement('a')
    a.href = url
    a.download = nombre
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 2000)
    snackbar('Story descargada')
  } catch {
    window.open(story.url_imagen, '_blank', 'noopener')
  }
}
