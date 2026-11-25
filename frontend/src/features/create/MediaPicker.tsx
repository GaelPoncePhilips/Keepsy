// Selector de foto/video: sube el archivo con POST /media (con el mock, URL de objeto) o usa una muestra.
import { useRef, useState } from 'react'
import { Button } from '../../components/ui/Button'
import { Icon } from '../../components/ui/Icon'
import { IconButton } from '../../components/ui/IconButton'
import { VIDEOS } from '../../mocks/seed'
import { env } from '../../config/env'
import { mensajeDeError } from '../../services/client'
import { dataUrlABlob, subirArchivo } from '../../services/media'
import { urlAleatoria } from '../../services/temporal/local'
import { snackbar } from '../../stores/ui'

export type TipoMedia = 'foto' | 'video'

export interface MediaElegida {
  /** URL de la imagen (o portada si es video). */
  url_imagen: string
  /** URL del video si tipo === 'video'. */
  url_video: string | null
  tipo: TipoMedia
  /** Duración en segundos si es video (si se pudo leer). */
  duracion_seg: number | null
}

/**
 * Portada de respaldo si no se puede capturar un frame del video. Con el mock, una imagen aleatoria;
 * con el backend real, un fondo liso generado (se sube como cualquier portada): nada de fotos ajenas.
 */
function portadaDeRespaldo(): string {
  if (env.useMock) return urlAleatoria(1080, 1920)
  const c = document.createElement('canvas')
  c.width = 540
  c.height = 960
  const g = c.getContext('2d')
  if (g) {
    g.fillStyle = '#1c1b1f'
    g.fillRect(0, 0, c.width, c.height)
  }
  return c.toDataURL('image/jpeg', 0.8)
}

/** Lee duración y captura un frame como portada. Si falla, devuelve una portada de respaldo. */
function analizarVideo(url: string): Promise<{ duracion: number | null; portada: string }> {
  return new Promise((resolve) => {
    const v = document.createElement('video')
    v.muted = true
    v.preload = 'auto'
    v.playsInline = true
    let listo = false
    let timer = 0
    const fin = (duracion: number | null, portada: string) => {
      if (listo) return
      listo = true
      window.clearTimeout(timer)
      v.removeAttribute('src')
      v.load()
      resolve({ duracion, portada })
    }
    timer = window.setTimeout(() => fin(Number.isFinite(v.duration) ? Math.round(v.duration) : null, portadaDeRespaldo()), 6000)
    v.onerror = () => fin(null, portadaDeRespaldo())
    v.onloadedmetadata = () => {
      v.currentTime = Math.min(0.5, (v.duration || 1) / 2)
    }
    v.onseeked = () => {
      const dur = Number.isFinite(v.duration) ? Math.round(v.duration) : null
      try {
        const c = document.createElement('canvas')
        c.width = Math.min(v.videoWidth || 540, 720)
        c.height = Math.round(c.width * ((v.videoHeight || 960) / (v.videoWidth || 540)))
        c.getContext('2d')?.drawImage(v, 0, 0, c.width, c.height)
        fin(dur, c.toDataURL('image/jpeg', 0.8))
      } catch {
        fin(dur, portadaDeRespaldo())
      }
    }
    v.src = url
  })
}

/**
 * Selector de archivo (se sube con POST /media) o imagen/video de muestra.
 * accept: 'foto' | 'video' | 'ambos'. aspect: proporción de la vista previa (CSS aspect-ratio).
 */
export function MediaPicker({
  accept,
  value,
  onChange,
  aspect = '1 / 1',
}: {
  accept: 'foto' | 'video' | 'ambos'
  value: MediaElegida | null
  onChange: (m: MediaElegida | null) => void
  aspect?: string
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [cargando, setCargando] = useState(false)
  const mime = accept === 'foto' ? 'image/*' : accept === 'video' ? 'video/*' : 'image/*,video/*'

  const elegirArchivo = async (file: File) => {
    setCargando(true)
    try {
      if (file.type.startsWith('video/')) {
        // Duración y portada se sacan del archivo local; después se suben video y portada.
        const local = URL.createObjectURL(file)
        const { duracion, portada } = await analizarVideo(local)
        URL.revokeObjectURL(local)
        const [urlVideo, urlPortada] = await Promise.all([
          subirArchivo(file),
          portada.startsWith('data:') ? dataUrlABlob(portada).then((b) => subirArchivo(b, 'portada.jpg')) : Promise.resolve(portada),
        ])
        onChange({ tipo: 'video', url_imagen: urlPortada, url_video: urlVideo, duracion_seg: duracion })
      } else {
        onChange({ tipo: 'foto', url_imagen: await subirArchivo(file), url_video: null, duracion_seg: null })
      }
    } catch (e) {
      snackbar(`No se pudo subir el archivo: ${mensajeDeError(e)}`)
    } finally {
      setCargando(false)
    }
  }

  const muestra = () => {
    if (accept === 'foto') {
      onChange({ tipo: 'foto', url_imagen: urlAleatoria(1080, 1080), url_video: null, duracion_seg: null })
      return
    }
    const lista = Object.values(VIDEOS)
    onChange({
      tipo: 'video',
      url_imagen: urlAleatoria(1080, 1920),
      url_video: lista[Math.floor(Math.random() * lista.length)],
      duracion_seg: 10,
    })
  }

  return (
    <div className="relative w-full overflow-hidden rounded-lg bg-surface-container-high" style={{ aspectRatio: aspect }}>
      {value ? (
        <>
          {value.tipo === 'video' && value.url_video ? (
            <video src={value.url_video} poster={value.url_imagen} muted loop autoPlay playsInline className="size-full object-cover" />
          ) : (
            <img src={value.url_imagen} alt="Vista previa de lo elegido" className="size-full object-cover" />
          )}
          <IconButton
            icon="close"
            label="Quitar"
            variant="filled"
            size={20}
            className="absolute top-2 right-2"
            onClick={() => onChange(null)}
          />
        </>
      ) : (
        <div className="flex size-full flex-col items-center justify-center gap-3 p-4 text-center">
          <Icon name={accept === 'video' ? 'movie' : 'add_photo_alternate'} size={48} className="text-on-surface-variant" />
          <p className="type-title-m">{accept === 'video' ? 'Elegí un video' : 'Elegí una foto o video'}</p>
          <input
            ref={inputRef}
            type="file"
            accept={mime}
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0]
              e.target.value = ''
              if (f) void elegirArchivo(f)
            }}
          />
          <Button icon="upload" disabled={cargando} onClick={() => inputRef.current?.click()}>
            {cargando ? 'Subiendo…' : 'Desde tu dispositivo'}
          </Button>
          {/* Muestras (picsum / videos de prueba) solo con el mock: con el backend real se publicaría contenido ajeno. */}
          {env.useMock && (
            <Button variant="tonal" disabled={cargando} onClick={muestra}>
              Usar una de muestra
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
