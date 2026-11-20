import { useState } from 'react'
import { CenteredLoader, EmptyState, ErrorState } from '../../components/ui/Feedback'
import { Sheet } from '../../components/ui/Overlay'
import { useAsync } from '../../lib/hooks'
import { useYo } from '../../stores/session'
import type { Comentario } from '../../types/api'
import { CajaComentario, fuenteDePost, HilosComentarios, type FuenteComentarios } from './comentarios'

/** Comentarios de un post (o de un ítem de álbum, con `fuente`) en bottom sheet (móvil) / side sheet (escritorio). */
export function CommentsSheet({
  postId,
  postOwnerId,
  open,
  onClose,
  onCountChange,
  fuente,
}: {
  postId: number
  postOwnerId: number
  open: boolean
  onClose: () => void
  onCountChange?: (delta: number) => void
  fuente?: FuenteComentarios
}) {
  const yo = useYo()
  const origen = fuente ?? fuenteDePost(postId)
  const [respondiendo, setRespondiendo] = useState<Comentario | null>(null)
  const { data, error, loading, reload, setData } = useAsync(
    () => (open ? origen.listar() : Promise.resolve([] as Comentario[])),
    [postId, open, fuente ? 'item' : 'post'],
  )
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Comentarios"
      footer={
        <CajaComentario
          fuente={origen}
          className="border-t border-outline-variant px-4 py-2"
          respondiendoA={respondiendo}
          onCancelarRespuesta={() => setRespondiendo(null)}
          onComentado={(c) => {
            setData((prev) => [...(prev ?? []), c])
            onCountChange?.(1)
          }}
        />
      }
    >
      {loading && !data ? (
        <CenteredLoader />
      ) : error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : !data || data.length === 0 ? (
        <EmptyState icon="chat_bubble" title="Todavía no hay comentarios" text="Iniciá la conversación." />
      ) : (
        <div className="py-2">
          <HilosComentarios
            comentarios={data}
            borrar={origen.borrar}
            onResponder={setRespondiendo}
            puedeBorrar={(c) => c.usuario_id === yo.id || postOwnerId === yo.id}
            onBorrado={(id) => {
              setData((prev) => (prev ?? []).filter((x) => x.id !== id))
              onCountChange?.(-1)
            }}
          />
        </div>
      )}
    </Sheet>
  )
}
