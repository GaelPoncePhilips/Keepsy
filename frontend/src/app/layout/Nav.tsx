import { useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'
import { Avatar } from '../../components/ui/Avatar'
import { Icon } from '../../components/ui/Icon'
import { cn } from '../../lib/hooks'
import { useBadges } from '../../stores/badges'
import { useYo } from '../../stores/session'
import { useUi } from '../../stores/ui'
import { DevSwitcherDialog } from './DevSwitcher'
import { MoreMenu } from './MoreMenu'
import { NavBlob } from './NavBlob'
import { RadialCreate } from './RadialCreate'
import { activoDesdeRuta, DESKTOP_ITEMS, ICONOS, LABELS, MOBILE_TABS, RUTAS, type NavId } from './navItems'

function Wordmark({ className }: { className?: string }) {
  return <span className={cn('wordmark text-[28px] leading-none text-on-surface', className)}>keepsy</span>
}

export function Logo({ size = 28 }: { size?: number }) {
  return <img src="/logo.svg" alt="Keepsy" width={size} height={size} />
}

/**
 * Barra inferior móvil (diseño de Figma): 5 destinos con ícono + etiqueta. El activo no lleva píldora:
 * la gota del blob lo envuelve y el foco principal de luz nace de su ícono. "Crear" abre el menú radial.
 */
export function BottomNav() {
  const yo = useYo()
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const panel = useUi((s) => s.panel)
  const activo = panel ? null : activoDesdeRuta(pathname, yo.username)
  const click = (id: NavId) => {
    if (id === 'perfil') navigate(`/${yo.username}`)
    else navigate(RUTAS[id] ?? '/')
  }
  // Fuera de una pestaña (p. ej. /p/123) la gota se queda donde estaba.
  const ultimo = useRef(0)
  const i = activo ? MOBILE_TABS.indexOf(activo) : -1
  if (i >= 0) ultimo.current = i
  return (
    <>
      {/* Fondo sólido de la barra; la gota del blob se dibuja encima y los íconos encima de ella */}
      <div id="nav-barra-fondo" aria-hidden="true" className="barra-fija fixed inset-x-0 bottom-0 z-30 h-[calc(var(--nav-h)+env(safe-area-inset-bottom))] rounded-t-[28px] bg-surface-container md:hidden" />
      <NavBlob index={ultimo.current} count={MOBILE_TABS.length} lamina={!pathname.startsWith('/reels')} />
      <nav aria-label="Navegación principal" className="barra-fija fixed inset-x-0 bottom-0 z-[32] pb-[env(safe-area-inset-bottom)] md:hidden">
        <ul className="relative z-10 flex h-[var(--nav-h)] items-stretch justify-around">
          {MOBILE_TABS.map((id) => {
            const on = activo === id
            if (id === 'crear')
              return (
                <li key={id} className="flex flex-1 justify-center">
                  <RadialCreate label={LABELS[id]} />
                </li>
              )
            return (
              <li key={id} className="flex flex-1 justify-center">
                <button
                  type="button"
                  aria-label={LABELS[id]}
                  aria-current={on ? 'page' : undefined}
                  onClick={() => click(id)}
                  className={cn(
                    'nav-dest flex h-full min-w-12 flex-1 flex-col items-center justify-center gap-1 transition-colors',
                    on ? 'text-on-surface' : 'text-on-surface-variant',
                  )}
                >
                  {id === 'perfil' ? (
                    <span className={cn('rounded-full p-[2px]', on ? 'ring-2 ring-on-surface' : '')}>
                      <Avatar username={yo.username} size={24} alt="" />
                    </span>
                  ) : (
                    <span key={String(on)} className={on ? 'select-pop' : undefined}>
                      <Icon name={ICONOS[id]} fill={on} size={26} />
                    </span>
                  )}
                  <span className={cn('type-label-s', on ? 'font-bold text-on-surface' : '')}>{LABELS[id]}</span>
                </button>
              </li>
            )
          })}
        </ul>
      </nav>
    </>
  )
}

/**
 * Barra lateral de escritorio al estilo Instagram. ≥1024px: 244px con texto;
 * 768–1023px (o con un panel abierto): 72px solo íconos. Activo = negrita + ícono relleno, sin píldora.
 */
export function SideNav() {
  const yo = useYo()
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const { panel, setPanel, setCrear } = useUi()
  const notifs = useBadges((s) => s.notificaciones)
  const msgs = useBadges((s) => s.mensajes)
  const [masAbierto, setMasAbierto] = useState(false)
  const [switcher, setSwitcher] = useState(false)
  const colapsada = panel !== null || pathname.startsWith('/direct')
  const activoRuta = activoDesdeRuta(pathname, yo.username)
  const activo: NavId | null = panel === 'buscar' ? 'buscar' : panel === 'notificaciones' ? 'notificaciones' : activoRuta

  const click = (id: NavId) => {
    if (id === 'buscar' || id === 'notificaciones') {
      setPanel(id)
      return
    }
    setPanel(null)
    if (id === 'crear') setCrear(true)
    else if (id === 'perfil') navigate(`/${yo.username}`)
    else navigate(RUTAS[id] ?? '/')
  }

  return (
    <nav
      aria-label="Navegación principal"
      className={cn(
        'fixed inset-y-0 left-0 z-40 hidden flex-col border-r border-outline-variant bg-surface px-3 pt-6 pb-5 md:flex',
        'transition-[width] spring-spatial',
        colapsada ? 'w-[var(--sidebar-w-collapsed)]' : 'w-[var(--sidebar-w-collapsed)] lg:w-[var(--sidebar-w)]',
      )}
    >
      <Link to="/" onClick={() => setPanel(null)} aria-label="Keepsy, inicio" className="mb-6 flex h-12 items-center px-3">
        <span className={cn('hidden', !colapsada && 'lg:inline')}>
          <Wordmark />
        </span>
        <span className={cn(!colapsada && 'lg:hidden')}>
          <Logo size={26} />
        </span>
      </Link>
      <ul className="flex flex-1 flex-col gap-1">
        {DESKTOP_ITEMS.map((item) => {
          const on = activo === item.id
          const badge = item.id === 'mensajes' ? msgs : item.id === 'notificaciones' ? notifs : 0
          return (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => click(item.id)}
                aria-label={item.label}
                aria-current={on ? 'page' : undefined}
                className="state group flex h-12 w-full items-center gap-4 rounded-md px-3 text-left"
              >
                <span className="relative flex size-7 shrink-0 items-center justify-center transition-transform spring-spatial-fast group-hover:scale-105">
                  {item.id === 'perfil' ? (
                    <span className={cn('rounded-full p-[2px]', on && 'ring-2 ring-on-surface')}>
                      <Avatar username={yo.username} size={24} alt="" />
                    </span>
                  ) : (
                    <Icon name={item.icon} fill={on} size={26} />
                  )}
                  {badge > 0 && (
                    <span className="absolute -top-1.5 -right-2 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-error px-1 text-on-error type-label-s ring-2 ring-surface">
                      {badge > 9 ? '9+' : badge}
                    </span>
                  )}
                </span>
                <span className={cn('type-body-l hidden truncate', !colapsada && 'lg:inline', on && 'font-bold')}>{item.label}</span>
              </button>
            </li>
          )
        })}
      </ul>
      <div className="relative">
        <button
          type="button"
          onClick={() => setMasAbierto((v) => !v)}
          aria-expanded={masAbierto}
          aria-label="Más"
          className="state flex h-12 w-full items-center gap-4 rounded-md px-3"
        >
          <Icon name="menu" fill={masAbierto} size={26} />
          <span className={cn('type-body-l hidden', !colapsada && 'lg:inline', masAbierto && 'font-bold')}>Más</span>
        </button>
        {masAbierto && <MoreMenu onClose={() => setMasAbierto(false)} onSwitch={() => setSwitcher(true)} />}
      </div>
      <DevSwitcherDialog open={switcher} onClose={() => setSwitcher(false)} />
    </nav>
  )
}
