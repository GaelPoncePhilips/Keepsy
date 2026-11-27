import { useState } from 'react'
import { navegarConZoom } from '../../lib/transicion'
import { useNavigate } from 'react-router'
import { ScreenHeader } from '../../components/shared'
import { Icon } from '../../components/ui/Icon'
import { MentionField } from '../../components/ui/MentionField'
import { useIsMobile } from '../../lib/hooks'
import { mensajeDeError } from '../../services/client'
import { crearPost } from '../../services/posts'
import { snackbar } from '../../stores/ui'
import { EtiquetarSheet } from './EtiquetarSheet'
import { FotosPicker } from './FotosPicker'
import { MediaPicker, type MediaElegida } from './MediaPicker'

/** Formulario común de "Nueva publicación" y "Nuevo reel". */
export function CreateForm({
  tipo,
  titulo,
  destino,
  mensaje,
}: {
  tipo: 'foto' | 'reel'
  titulo: string
  destino: string
  mensaje: string
}) {
  const navigate = useNavigate()
  const mobile = useIsMobile()
  const [media, setMedia] = useState<MediaElegida | null>(null)
  const [fotos, setFotos] = useState<string[]>([])
  const [texto, setTexto] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [etiquetar, setEtiquetar] = useState(false)

  const compartir = async () => {
    if ((tipo === 'foto' ? fotos.length === 0 : !media) || enviando) return
    setEnviando(true)
    try {
      const descripcion = texto.trim() || null
      await crearPost(
        tipo === 'foto'
          ? { tipo: 'foto', url_imagen: fotos[0], imagenes_extra: fotos.slice(1), descripcion }
          : {
              tipo: 'reel',
              url_imagen: media?.url_imagen ?? '',
              url_video: media?.url_video ?? null,
              duracion_seg: media?.duracion_seg ?? null,
              descripcion,
            },
      )
      snackbar(mensaje)
      navigate(destino)
    } catch (e) {
      snackbar(mensajeDeError(e))
      setEnviando(false)
    }
  }

  const puede = (tipo === 'foto' ? fotos.length > 0 : !!media) && !enviando
  return (
    <div>
      <ScreenHeader
        title={titulo}
        onBack={mobile ? () => navegarConZoom(navigate, -1) : undefined}
        action={
          <button
            type="button"
            disabled={!puede}
            onClick={() => void compartir()}
            className="state h-10 rounded-full px-3 type-label-l emphasized text-primary disabled:text-on-surface/40"
          >
            {enviando ? 'Enviando…' : 'Compartir'}
          </button>
        }
      />
      <div className="mx-auto grid max-w-[900px] gap-4 p-4 lg:grid-cols-2 lg:gap-8 lg:py-8">
        <div className={tipo === 'reel' ? 'mx-auto w-full max-w-[360px] lg:max-w-none' : undefined}>
          {tipo === 'foto' ? (
            <FotosPicker value={fotos} onChange={setFotos} />
          ) : (
            <MediaPicker accept="video" aspect="9 / 16" value={media} onChange={setMedia} />
          )}
        </div>
        <div>
          <MentionField
            label="Escribí una descripción…"
            value={texto}
            onChange={setTexto}
            multiline
            maxLength={2200}
            hint="Los #hashtags y las @menciones se detectan solos"
          />
          <button
            type="button"
            onClick={() => setEtiquetar(true)}
            className="state mt-3 flex h-12 w-full items-center gap-3 rounded-md px-3 type-body-l text-on-surface"
          >
            <Icon name="person_add" />
            <span className="flex-1 text-left">Etiquetar personas</span>
            <Icon name="chevron_right" className="text-on-surface-variant" />
          </button>
          <EtiquetarSheet
            open={etiquetar}
            onClose={() => setEtiquetar(false)}
            onElegir={(u) => setTexto((t) => (t.includes(`@${u.username}`) ? t : `${t}${t && !/\s$/.test(t) ? ' ' : ''}@${u.username} `))}
          />
        </div>
      </div>
    </div>
  )
}
