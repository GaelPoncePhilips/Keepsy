import { cn } from '../../lib/hooks'

/**
 * Filtros SVG "gooey" (metaballs): desenfoca y vuelve a endurecer el alfa, de modo que las formas
 * cercanas se fusionan como líquido. Se monta una sola vez (AppLayout / AuthShell).
 * Uso: clase `goo` (más fluido) o `goo-sm` (para formas chicas).
 */
export function GooFilters() {
  return (
    <svg width="0" height="0" className="pointer-events-none absolute" aria-hidden="true" focusable="false">
      <defs>
        <filter id="goo-filter" x="-20%" y="-20%" width="140%" height="140%" colorInterpolationFilters="sRGB">
          <feGaussianBlur in="SourceGraphic" stdDeviation="9" result="blur" />
          <feColorMatrix in="blur" mode="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 22 -10" />
        </filter>
        <filter id="goo-sm-filter" x="-30%" y="-100%" width="160%" height="300%" colorInterpolationFilters="sRGB">
          <feGaussianBlur in="SourceGraphic" stdDeviation="3.5" result="blur" />
          <feColorMatrix in="blur" mode="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 20 -9" />
        </filter>
      </defs>
    </svg>
  )
}

/**
 * Fondo decorativo: tres manchas orgánicas que se deforman y derivan despacio, fusionadas con el filtro goo.
 * Va detrás del contenido (aria-hidden, pointer-events-none). Pensado para pantallas de entrada y encabezados.
 */
export function BlobBackdrop({ className }: { className?: string }) {
  return (
    <div aria-hidden="true" className={cn('pointer-events-none absolute inset-0 -z-10 overflow-hidden', className)}>
      <div className="absolute inset-0 opacity-50 blur-2xl">
      <div className="goo absolute inset-0">
        <span className="blob blob-drift-a absolute top-[8%] left-[6%] size-[46%] bg-primary-container" />
        <span className="blob blob-drift-b absolute top-[22%] right-[4%] size-[42%] bg-tertiary-container" />
        <span className="blob blob-drift-c absolute bottom-[4%] left-[30%] size-[38%] bg-secondary-container" />
      </div>
      </div>
    </div>
  )
}

/** Contenedor de ícono con forma de mancha que respira (estados vacíos, tiles). */
export function BlobIcon({ children, className }: { children: React.ReactNode; className?: string }) {
  return <span className={cn('blob flex items-center justify-center', className)}>{children}</span>
}
