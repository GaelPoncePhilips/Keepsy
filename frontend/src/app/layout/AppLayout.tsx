import { useEffect, useMemo } from 'react'
import { Outlet, useLocation } from 'react-router'
import { ErrorBoundary } from '../../components/ErrorBoundary'
import { GooFilters } from '../../components/ui/Blobs'
import { Snackbars } from '../../components/ui/Feedback'
import { IconButton } from '../../components/ui/IconButton'
import { NotificationsList } from '../../features/notifications/NotificationsList'
import { SearchPanelContent } from '../../features/search/SearchPanel'
import { cn, useEscape } from '../../lib/hooks'
import { useBadges } from '../../stores/badges'
import { useUi } from '../../stores/ui'
import { CreateMenu } from './CreateMenu'
import { BottomNav, SideNav } from './Nav'
import { MobileTopBar } from './TopBar'

/** Panel deslizable de escritorio (Buscar / Notificaciones), como Instagram web. */
function SidePanel() {
  const panel = useUi((s) => s.panel)
  const setPanel = useUi((s) => s.setPanel)
  const cerrar = () => {
    if (panel) setPanel(panel)
  }
  useEscape(cerrar, panel !== null)
  if (!panel) return null
  return (
    <>
      <div className="fixed inset-0 z-30 hidden md:block" onClick={cerrar} aria-hidden="true" />
      <aside
        aria-label={panel === 'buscar' ? 'Buscar' : 'Notificaciones'}
        className="anim-slide-left fixed inset-y-0 left-[var(--sidebar-w-collapsed)] z-30 hidden w-[var(--panel-w)] flex-col rounded-r-xl border-r border-outline-variant bg-surface shadow-xl md:flex"
      >
        <div className="flex items-center justify-between px-6 pt-6 pb-4">
          <h2 className="type-headline-s emphasized">{panel === 'buscar' ? 'Buscar' : 'Notificaciones'}</h2>
          <IconButton icon="close" label="Cerrar panel" onClick={cerrar} />
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {panel === 'buscar' ? <SearchPanelContent onNavigate={cerrar} /> : <NotificationsList onNavigate={cerrar} />}
        </div>
      </aside>
    </>
  )
}

const RESERVADAS = new Set(['buscar', 'explorar', 'hashtags', 'reels', 'p', 'stories', 'destacadas', 'direct', 'notificaciones', 'crear', 'albumes', 'cuenta'])

/** Entre pestañas de un mismo perfil la pantalla no se remonta: solo cambia el contenido de la pestaña. */
function claveRuta(pathname: string): string {
  const m = /^\/([^/]+)(?:\/(?:reels|albumes|republicaciones|archivo))?$/.exec(pathname)
  return m && !RESERVADAS.has(m[1]) ? `/${m[1]}` : pathname
}

/** Marco de la app autenticada: barra lateral (≥768), barra inferior (<768), paneles, "Crear" y snackbars. */
export function AppLayout() {
  const { pathname } = useLocation()
  const refrescar = useBadges((s) => s.refrescar)
  const setPanel = useUi((s) => s.setPanel)
  const panel = useUi((s) => s.panel)

  useEffect(() => {
    void refrescar()
    const t = window.setInterval(() => void refrescar(), 20_000)
    return () => window.clearInterval(t)
  }, [refrescar])

  // Navegar cierra el panel y refresca contadores.
  useEffect(() => {
    if (useUi.getState().panel) setPanel(useUi.getState().panel)
    void refrescar()
  }, [pathname, refrescar, setPanel])

  // Sentido del zoom leído una vez por página (useMemo por ruta): si cambiara después, la animación se repetiría.
  const clave = claveRuta(pathname)
  const dirAlMontar = useMemo(() => (clave ? document.documentElement.dataset.dir : undefined), [clave])
  const esInicio = pathname === '/'
  const sinBarraInferior = pathname.startsWith('/direct/') || pathname.startsWith('/stories') || pathname.startsWith('/destacadas')
  const colapsada = panel !== null || pathname.startsWith('/direct')

  return (
    <div className="min-h-svh md:bg-surface">
      <GooFilters />
      <SideNav />
      <SidePanel />
      <main
        id="contenido-blob"
        className={cn(
          'relative z-10 min-h-svh md:pl-[var(--sidebar-w-collapsed)]',
          !colapsada && 'lg:pl-[var(--sidebar-w)]',
          !sinBarraInferior && 'pb-[calc(var(--nav-h)+env(safe-area-inset-bottom))] md:pb-0',
        )}
      >
        {esInicio && <MobileTopBar />}
        <ErrorBoundary key={claveRuta(pathname)}>
          <div key={claveRuta(pathname)} className={cn(!sinBarraInferior && 'anim-page', !sinBarraInferior && dirAlMontar === 'atras' && 'anim-page-atras')}>
            <Outlet />
          </div>
        </ErrorBoundary>
      </main>
      {!sinBarraInferior && <BottomNav />}
      <CreateMenu />
      <Snackbars />
    </div>
  )
}
