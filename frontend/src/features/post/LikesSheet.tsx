import { Link } from 'react-router'
import { UserRow } from '../../components/shared'
import { CenteredLoader, EmptyState, ErrorState } from '../../components/ui/Feedback'
import { Sheet } from '../../components/ui/Overlay'
import { useAsync } from '../../lib/hooks'
import * as postsApi from '../../services/posts'
import { useYo } from '../../stores/session'
import type { UsuarioResumen } from '../../types/api'

/** Lista de usuarios que dieron like. */
export function LikesSheet({
  postId,
  open,
  onClose,
  cargar,
}: {
  postId: number
  open: boolean
  onClose: () => void
  /** Fuente alternativa (ítems de álbum). */
  cargar?: () => Promise<UsuarioResumen[]>
}) {
  const yo = useYo()
  const { data, error, loading, reload } = useAsync(
    () => (open ? (cargar ? cargar() : postsApi.likesDePost(postId, { limit: 50 })) : Promise.resolve([])),
    [postId, open, cargar ? 'item' : 'post'],
  )
  return (
    <Sheet open={open} onClose={onClose} title="Me gusta">
      {loading && !data ? (
        <CenteredLoader />
      ) : error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : !data || data.length === 0 ? (
        <EmptyState icon="favorite" title="Todavía no hay Me gusta" />
      ) : (
        <div className="py-2">
          {data.map((u) => (
            <UserRow
              key={u.id}
              usuario={u}
              onClick={onClose}
              action={
                u.id === yo.id ? undefined : (
                  <Link
                    to={`/${u.username}`}
                    onClick={onClose}
                    className="state type-label-l inline-flex h-8 items-center rounded-full bg-secondary-container px-3 text-on-secondary-container"
                  >
                    Ver perfil
                  </Link>
                )
              }
            />
          ))}
        </div>
      )}
    </Sheet>
  )
}
