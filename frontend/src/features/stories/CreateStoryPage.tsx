import { useState } from 'react'
import { navegarConZoom } from '../../lib/transicion'
import { useNavigate } from 'react-router'
import { ScreenHeader } from '../../components/shared'
import { Button } from '../../components/ui/Button'
import { Switch } from '../../components/ui/Controls'
import { MentionField } from '../../components/ui/MentionField'
import { mensajeDeError } from '../../services/client'
import * as storiesApi from '../../services/stories'
import { snackbar } from '../../stores/ui'
import { EtiquetarSheet } from '../create/EtiquetarSheet'
import { MediaPicker, type MediaElegida } from '../create/MediaPicker'
import { TextoStory } from './StorySocial'

const MAX_TEXTO = 200

export function CreateStoryPage() {
  const navigate = useNavigate()
  const [media, setMedia] = useState<MediaElegida | null>(null)
  const [amigos, setAmigos] = useState(false)
  const [texto, setTexto] = useState('')
  const [etiquetar, setEtiquetar] = useState(false)
  const [busy, setBusy] = useState(false)

  const compartir = async () => {
    if (!media) return
    setBusy(true)
    try {
      await storiesApi.crearStory({ url_imagen: media.url_imagen, solo_mejores_amigos: amigos, texto: texto.trim() || null })
      snackbar(amigos ? 'Story compartida con Mejores amigos' : 'Story compartida')
      navigate('/')
    } catch (e) {
      snackbar(mensajeDeError(e))
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto w-full max-w-[420px] pb-8">
      <ScreenHeader
        title="Nueva story"
        onBack={() => navegarConZoom(navigate, -1)}
        action={
          <Button size="sm" disabled={!media || busy} onClick={() => void compartir()}>
            Compartir
          </Button>
        }
      />
      <div className="space-y-4 px-4 pt-2">
        <div className="relative overflow-hidden rounded-lg">
          <MediaPicker accept="foto" aspect="9 / 16" value={media} onChange={setMedia} />
          {/* Vista previa del texto tal como se verá en el visor */}
          {media && texto.trim() && <TextoStory texto={texto} preview />}
        </div>
        <MentionField
          label="Texto sobre la story (opcional)"
          value={texto}
          onChange={setTexto}
          maxLength={MAX_TEXTO}
          multiline
          lado="arriba"
          hint="Arrobá con @ para mencionar: les llega una notificación"
        />
        <Button variant="tonal" icon="person_add" size="sm" onClick={() => setEtiquetar(true)}>
          Mencionar personas
        </Button>
        <Switch
          checked={amigos}
          onChange={setAmigos}
          icon="crown"
          label="Solo mejores amigos"
          description="Solo la verán las personas de tu lista de mejores amigos"
        />
        <Button full disabled={!media || busy} onClick={() => void compartir()}>
          Compartir
        </Button>
      </div>
      <EtiquetarSheet
        open={etiquetar}
        onClose={() => setEtiquetar(false)}
        onElegir={(u) =>
          setTexto((t) => (t.includes(`@${u.username}`) ? t : `${t}${t && !/\s$/.test(t) ? ' ' : ''}@${u.username} `).slice(0, MAX_TEXTO))
        }
      />
    </div>
  )
}
