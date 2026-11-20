import { cn } from '../../lib/hooks'

/**
 * Luz ambiente: una copia borrosa y saturada del contenido que "se derrama" detrás.
 * Pensada para contenido expandido (reels, historias, detalle de publicación, ítems de álbum).
 * Va detrás: el contenido real debe tener `relative z-10`. Usa la portada (no el video) para ser barata.
 */
export function Ambient({ src, active = true, className }: { src: string; active?: boolean; className?: string }) {
  return (
    <div aria-hidden="true" className={cn('pointer-events-none absolute inset-0 z-0 overflow-hidden', className)}>
      <img
        src={src}
        alt=""
        draggable={false}
        className={cn(
          '-left-[20%] -top-[20%] absolute h-[140%] w-[140%] max-w-none object-cover blur-[64px] saturate-[1.8] transition-opacity duration-700',
          active ? 'opacity-55' : 'opacity-0',
        )}
      />
      <div className="absolute inset-0 bg-black/25" />
    </div>
  )
}
