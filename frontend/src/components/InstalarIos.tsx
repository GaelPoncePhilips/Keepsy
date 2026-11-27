import { useEffect } from 'react'
import type { ReactNode } from 'react'
import { esIOS, esSafariIOS, estaEnStandalone, usePwa } from '../pwa'
import { Button } from './ui/Button'
import { Icon } from './ui/Icon'
import { Sheet } from './ui/Overlay'

const CLAVE = 'keepsy.iosInstall.descartado'
const DIAS_SIN_MOLESTAR = 14
const DEMORA_MS = 6000

function descartadoRecientemente(): boolean {
  try {
    const guardado = localStorage.getItem(CLAVE)
    if (!guardado) return false
    const t = Date.parse(guardado)
    return Number.isFinite(t) && Date.now() - t < DIAS_SIN_MOLESTAR * 86_400_000
  } catch {
    return false
  }
}

function recordarDescarte(): void {
  try {
    localStorage.setItem(CLAVE, new Date().toISOString())
  } catch {
    /* modo privado o almacenamiento bloqueado */
  }
}

function Paso({ n, children }: { n: number; children: ReactNode }) {
  return (
    <li className="flex items-center gap-4 rounded-lg bg-surface-container-high px-4 py-3">
      <span className="type-label-l emphasized flex size-8 shrink-0 items-center justify-center rounded-full bg-primary-container text-on-primary-container">
        {n}
      </span>
      <span className="type-body-l flex flex-wrap items-center gap-x-1.5 text-on-surface">{children}</span>
    </li>
  )
}

/** Ayuda para instalar la PWA en iOS (no existe beforeinstallprompt): se muestra sola cada tanto y a demanda. */
export function InstalarIos() {
  const abierta = usePwa((s) => s.mostrarAyudaIos)
  const instalada = usePwa((s) => s.instalada)
  const abrir = usePwa((s) => s.abrirAyudaIos)
  const cerrar = usePwa((s) => s.cerrarAyudaIos)

  useEffect(() => {
    if (!esIOS() || estaEnStandalone() || descartadoRecientemente()) return
    const t = window.setTimeout(abrir, DEMORA_MS)
    return () => window.clearTimeout(t)
  }, [abrir])

  const cerrarYRecordar = () => {
    recordarDescarte()
    cerrar()
  }

  if (!esIOS() || instalada || estaEnStandalone()) return null
  const safari = esSafariIOS()

  return (
    <Sheet open={abierta} onClose={cerrarYRecordar} title="Instalá Keepsy en tu iPhone" side="bottom">
      <div className="flex flex-col gap-4 px-6 pt-2 pb-6">
        <p className="type-body-m text-on-surface-variant">
          Agregala a tu pantalla de inicio y abrila como una app, a pantalla completa.
          {!safari && ' Si no ves la opción, abrí Keepsy desde Safari.'}
        </p>
        <ol className="flex flex-col gap-2">
          <Paso n={1}>
            Tocá el ícono Compartir
            <Icon name="ios_share" className="text-primary" />
            {safari ? 'en la barra de Safari.' : 'del navegador.'}
          </Paso>
          <Paso n={2}>
            Elegí <strong className="emphasized">Agregar a inicio</strong>
            <Icon name="add_box" className="text-primary" />
          </Paso>
          <Paso n={3}>
            Tocá <strong className="emphasized">Agregar</strong> y listo.
          </Paso>
        </ol>
        <Button variant="tonal" full onClick={cerrarYRecordar}>
          Entendido
        </Button>
      </div>
    </Sheet>
  )
}
