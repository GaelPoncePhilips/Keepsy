import { useLocation, useNavigate } from 'react-router'
import { GridSkeleton, PostGrid } from '../../components/shared'
import { SearchBar } from '../../components/ui/Controls'
import { EmptyState, ErrorState, LoadingShape } from '../../components/ui/Feedback'
import { Link } from 'react-router'
import { Icon } from '../../components/ui/Icon'
import { useAsync, useInfinite, useIsDesktop, useIsMobile } from '../../lib/hooks'
import { albumsRecomendados } from '../../services/albums'
import { explorar } from '../../services/posts'
import { useYo } from '../../stores/session'

/** Grilla de posts recomendados (reutilizada por la búsqueda en escritorio). */
export function ExploreGrid() {
  const yo = useYo()
  const location = useLocation()
  const desktop = useIsDesktop()
  const { items, error, loading, done, reload, sentinelRef } = useInfinite((offset, limit) => explorar(yo.id, { offset, limit }), [yo.id], 24)

  if (error && items.length === 0) return <ErrorState error={error} onRetry={reload} />
  if (loading && items.length === 0) return <GridSkeleton n={12} />
  if (done && items.length === 0) return <EmptyState icon="explore" title="Nada para explorar todavía" text="Seguí a más gente para ver publicaciones recomendadas." />
  return (
    <>
      <DeAlbumes />
      <PostGrid posts={items} sentinelRef={sentinelRef} linkState={desktop ? { background: location } : undefined} />
      {loading && (
        <div className="flex justify-center py-6">
          <LoadingShape />
        </div>
      )}
      {error && <ErrorState error={error} onRetry={reload} />}
    </>
  )
}

/** Fotos y videos de álbumes compartidos que podés ver (de cuentas que seguís), como recomendados. */
function DeAlbumes() {
  const { data } = useAsync(() => albumsRecomendados({ limit: 20 }).catch(() => []), [])
  if (!data || data.length === 0) return null
  return (
    <section aria-label="Recomendados de álbumes" className="pb-3">
      <h2 className="type-title-s emphasized flex items-center gap-1.5 px-3 pb-2 md:px-0">
        <Icon name="photo_album" size={18} />
        De álbumes compartidos
      </h2>
      <ul className="no-scrollbar flex snap-x gap-1 overflow-x-auto px-3 md:px-0">
        {data.map((it) => (
          <li key={it.id} className="shrink-0 snap-start">
            <Link
              to={`/albumes/${it.album_id}?item=${it.id}`}
              state={{ visor: true }}
              className="relative block size-28 overflow-hidden rounded-xs bg-surface-container-highest md:size-36"
              aria-label="Ver foto del álbum"
            >
              <img src={it.url_imagen} alt={it.descripcion ?? ''} loading="lazy" className="size-full object-cover" />
              {it.tipo === 'video' && (
                <span className="absolute top-1.5 right-1.5 text-white drop-shadow">
                  <Icon name="play_arrow" fill size={18} />
                </span>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}

export function ExplorePage() {
  const mobile = useIsMobile()
  const navigate = useNavigate()
  return (
    <div className="mx-auto w-full max-w-[935px] px-0 md:px-4 md:py-6">
      {mobile && (
        <div className="sticky top-0 z-20 bg-surface px-3 pt-[calc(8px+env(safe-area-inset-top))] pb-2">
          <SearchBar value="" onChange={() => undefined} onFocus={() => navigate('/buscar')} placeholder="Buscar" />
        </div>
      )}
      <ExploreGrid />
    </div>
  )
}
