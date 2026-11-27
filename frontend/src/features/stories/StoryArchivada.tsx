/** Story del archivo: verla, ver quién la vio / le dio me gusta, destacarla, enviarla, descargarla o borrarla. */
import { useState } from 'react'
import { useNavigate } from 'react-router'
import { Button } from '../../components/ui/Button'
import { Icon } from '../../components/ui/Icon'
import { Confirm, Dialog } from '../../components/ui/Overlay'
import { useAsync } from '../../lib/hooks'
import { mensajeDeError } from '../../services/client'
import * as storiesApi from '../../services/stories'
import { snackbar } from '../../stores/ui'
import type { Story } from '../../types/api'
import { fechaStory } from '../highlights/StoryPickGrid'
import { ShareSheet } from '../post/ShareSheet'
import { DestacarSheet, descargarStory, TextoStory, VistasSheet } from './StorySocial'

export function StoryArchivada({ story, onClose, onBorrada }: { story: Story | null; onClose: () => void; onBorrada: (id: number) => void }) {
  return (
    <Dialog open={!!story} onClose={onClose} title={story ? fechaStory(story.fecha_publicacion) : ''} width={440} fullscreenMobile>
      {story && <Detalle key={story.id} story={story} onClose={onClose} onBorrada={onBorrada} />}
    </Dialog>
  )
}

function Detalle({ story, onClose, onBorrada }: { story: Story; onClose: () => void; onBorrada: (id: number) => void }) {
  const navigate = useNavigate()
  const [hoja, setHoja] = useState<'vistas' | 'likes' | 'destacar' | 'enviar' | 'borrar' | null>(null)
  const vistas = useAsync(() => storiesApi.vistasDeStory(story.id), [story.id])
  const [vigente] = useState(() => new Date(story.fecha_vencimiento).getTime() > Date.now())
  const likes = story.cantidad_likes ?? 0

  const borrar = async () => {
    try {
      await storiesApi.borrarStory(story.id)
      snackbar('Story eliminada')
      onBorrada(story.id)
      onClose()
    } catch (e) {
      snackbar(mensajeDeError(e))
    }
  }

  return (
    <div className="space-y-3 pb-2">
      <button
        type="button"
        className="relative mx-auto block max-w-full overflow-hidden rounded-md bg-surface-container-highest"
        style={{ aspectRatio: '9 / 16', height: 'min(58dvh, 640px)' }}
        onClick={() => navigate(`/story/${story.id}`)}
        aria-label="Ver la story en pantalla completa"
      >
        <img src={story.url_imagen} alt={`Story del ${fechaStory(story.fecha_publicacion)}`} className="size-full object-cover" />
        {story.texto && <TextoStory texto={story.texto} preview />}
        <span className="type-label-s emphasized absolute top-2 left-2 flex items-center gap-1 rounded-full bg-black/50 px-2 py-1 text-white">
          <Icon name={vigente ? 'schedule' : 'history'} size={14} />
          {vigente ? 'Activa' : 'Vencida'}
        </span>
        {story.solo_mejores_amigos && (
          <span className="absolute top-2 right-2 flex size-7 items-center justify-center rounded-full bg-amigos text-white" role="img" aria-label="Mejores amigos">
            <Icon name="crown" fill size={16} />
          </span>
        )}
      </button>

      {/* Actividad */}
      <div className="grid grid-cols-2 gap-2">
        <button type="button" className="state flex items-center gap-2 rounded-lg bg-surface-container-high px-3 py-2.5 text-left" onClick={() => setHoja('vistas')}>
          <Icon name="visibility" size={22} className="text-on-surface-variant" />
          <span>
            <span className="type-title-m emphasized block">{vistas.data?.length ?? '–'}</span>
            <span className="type-label-m block text-on-surface-variant">Vistas</span>
          </span>
        </button>
        <button type="button" className="state flex items-center gap-2 rounded-lg bg-surface-container-high px-3 py-2.5 text-left" onClick={() => setHoja('likes')}>
          <Icon name="favorite" fill={likes > 0} size={22} className={likes > 0 ? 'text-[var(--keepsy-coral)]' : 'text-on-surface-variant'} />
          <span>
            <span className="type-title-m emphasized block">{likes}</span>
            <span className="type-label-m block text-on-surface-variant">Me gusta</span>
          </span>
        </button>
      </div>

      {/* Acciones */}
      <div className="grid grid-cols-4 gap-1">
        <Accion icon="bookmark_add" label="Destacar" onClick={() => setHoja('destacar')} />
        <Accion icon="send" label="Enviar" onClick={() => setHoja('enviar')} />
        <Accion icon="download" label="Descargar" onClick={() => void descargarStory(story)} />
        <Accion icon="delete" label="Eliminar" destructive onClick={() => setHoja('borrar')} />
      </div>
      <Button full variant="tonal" icon="play_arrow" onClick={() => navigate(`/story/${story.id}`)}>
        Ver story
      </Button>

      <VistasSheet
        key={hoja ?? 'cerrada'}
        storyId={story.id}
        open={hoja === 'vistas' || hoja === 'likes'}
        inicial={hoja === 'likes' ? 'likes' : 'vistas'}
        onClose={() => setHoja(null)}
      />
      <DestacarSheet story={story} open={hoja === 'destacar'} onClose={() => setHoja(null)} />
      <ShareSheet storyId={story.id} open={hoja === 'enviar'} onClose={() => setHoja(null)} />
      <Confirm
        open={hoja === 'borrar'}
        title="¿Eliminar story?"
        text="Se borra del archivo y de las destacadas donde esté. No se puede deshacer."
        confirmLabel="Eliminar"
        destructive
        onConfirm={() => void borrar()}
        onClose={() => setHoja(null)}
      />
    </div>
  )
}

function Accion({ icon, label, onClick, destructive }: { icon: string; label: string; onClick: () => void; destructive?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`state ripple flex flex-col items-center gap-1 rounded-lg py-2 ${destructive ? 'text-error' : 'text-on-surface'}`}
    >
      <span className={`flex size-11 items-center justify-center rounded-full ${destructive ? 'bg-error-container' : 'bg-secondary-container'}`}>
        <Icon name={icon} size={22} />
      </span>
      <span className="type-label-m">{label}</span>
    </button>
  )
}
