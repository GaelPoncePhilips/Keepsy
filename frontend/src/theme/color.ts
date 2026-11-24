/**
 * Esquema de color dinámico M3 Expressive (HCT) a partir del color semilla.
 * Se expone como variables CSS --md-sys-color-<rol> que consume Tailwind (ver index.css).
 */
import {
  Hct,
  MaterialDynamicColors,
  SchemeTonalSpot,
  argbFromHex,
  hexFromArgb,
} from '@material/material-color-utilities'

/** Rojo de marca. Tonal Spot da superficies cálidas y tranquilas (Expressive viraba a marrón + cian). */
export const SEED = '#D12C23'

export type Tema = 'claro' | 'oscuro' | 'sistema'

function schemeCss(dark: boolean): string {
  const scheme = new SchemeTonalSpot(Hct.fromInt(argbFromHex(SEED)), dark, 0, '2025')
  const mdc = new MaterialDynamicColors()
  const lines: string[] = []
  for (const color of mdc.allColors) {
    const name = color.name.replace(/_/g, '-')
    lines.push(`--md-sys-color-${name}: ${hexFromArgb(color.getArgb(scheme))};`)
  }
  return lines.join('\n')
}

let styleEl: HTMLStyleElement | null = null

/** Inyecta ambos esquemas una vez; el tema activo lo decide data-tema en <html>. */
export function instalarEsquema(): void {
  if (styleEl) return
  styleEl = document.createElement('style')
  styleEl.id = 'md-sys-color'
  const light = schemeCss(false)
  const dark = schemeCss(true)
  styleEl.textContent = `
:root, :root[data-tema="claro"] { ${light} color-scheme: light; }
:root[data-tema="oscuro"] { ${dark} color-scheme: dark; }
@media (prefers-color-scheme: dark) { :root:not([data-tema="claro"]) { ${dark} color-scheme: dark; } }
`
  document.head.appendChild(styleEl)
}

export function aplicarTema(tema: Tema): void {
  const root = document.documentElement
  if (tema === 'sistema') root.removeAttribute('data-tema')
  else root.setAttribute('data-tema', tema)
  sincronizarBarras()
}

/**
 * Barra de estado y de navegación del sistema (PWA instalada): mismo color que el fondo de la app.
 * El <meta theme-color> se actualiza con el valor real de --md-sys-color-surface del tema activo.
 */
export function sincronizarBarras(): void {
  const color = getComputedStyle(document.documentElement).getPropertyValue('--md-sys-color-surface').trim()
  if (!color) return
  document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.remove())
  const meta = document.createElement('meta')
  meta.name = 'theme-color'
  meta.content = color
  document.head.appendChild(meta)
}

export function vigilarEsquemaSistema(): void {
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', sincronizarBarras)
}
