// Selector de varias fotos para una publicación (carrusel): elegir del dispositivo (varias a la vez),
// pegar desde el portapapeles (Ctrl/Cmd+V en cualquier parte de la pantalla) o, con el mock, usar muestras.
import { useCallback, useEffect, useRef, useState } from 'react'
import { Button } from '../../components/ui/Button'
import { Encuadre, esHeic } from '../../components/ui/Encuadre'
import { Icon } from '../../components/ui/Icon'
import { IconButton } from '../../components/ui/IconButton'
import { env } from '../../config/env'
import { mensajeDeError } from '../../services/client'
import { subirArchivo } from '../../services/media'
import { urlAleatoria } from '../../services/temporal/local'
import { snackbar } from '../../stores/ui'

export const MAX_FOTOS = 10

export function FotosPicker({ value, onChange }: { value: string[]; onChange: (fotos: string[]) => void }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [subiendo, setSubiendo] = useState(0)
  const [actual, setActual] = useState(0)
  const [encuadre, setEncuadre] = useState<{ i: number; aspecto: number } | null>(null)
  const recortar = async (i: number, b: Blob) => {
    setSubiendo((n) => n + 1)
    try {
      const url = await subirArchivo(b, 'recorte.jpg')
      const n = [...lista.current]
      n[i] = url
      lista.current = n
      onChange(n)
    } catch (e) {
      snackbar(`No se pudo guardar el encuadre: ${mensajeDeError(e)}`)
    } finally {
      setSubiendo((n) => n - 1)
    }
  }
  // Ref con la lista vigente: las subidas terminan en desorden y no deben pisarse entre sí.
  const lista = useRef(value)
  useEffect(() => {
    lista.current = value
  }, [value])

  const agregar = useCallback(
    async (archivos: File[]) => {
      const imgs = archivos.filter((f) => f.type.startsWith('image/') || esHeic(f))
      if (imgs.length === 0) return
      const lugar = MAX_FOTOS - lista.current.length
      if (lugar <= 0) {
        snackbar(`Podés subir hasta ${MAX_FOTOS} fotos`)
        return
      }
      if (imgs.length > lugar) snackbar(`Solo se agregaron ${lugar} (máximo ${MAX_FOTOS} fotos)`)
      const elegidas = imgs.slice(0, lugar)
      setSubiendo((n) => n + elegidas.length)
      for (const f of elegidas) {
        try {
          const url = await subirArchivo(f, f.name || 'imagen.png')
          const nueva = [...lista.current, url]
          lista.current = nueva
          onChange(nueva)
          setActual(nueva.length - 1)
        } catch (e) {
          snackbar(`No se pudo subir una imagen: ${mensajeDeError(e)}`)
        } finally {
          setSubiendo((n) => n - 1)
        }
      }
    },
    [onChange],
  )

  // Pegar imágenes (captura, copiar imagen del navegador, etc.).
  useEffect(() => {
    const h = (e: ClipboardEvent) => {
      const archivos = [...(e.clipboardData?.items ?? [])]
        .filter((it) => it.kind === 'file' && it.type.startsWith('image/'))
        .map((it) => it.getAsFile())
        .filter((f): f is File => f !== null)
      if (archivos.length === 0) return
      e.preventDefault()
      void agregar(archivos)
    }
    window.addEventListener('paste', h)
    return () => window.removeEventListener('paste', h)
  }, [agregar])

  const quitar = (i: number) => {
    const n = value.filter((_, k) => k !== i)
    onChange(n)
    setActual((a) => Math.max(0, Math.min(a, n.length - 1)))
  }
  const mover = (i: number, d: -1 | 1) => {
    const j = i + d
    if (j < 0 || j >= value.length) return
    const n = [...value]
    ;[n[i], n[j]] = [n[j], n[i]]
    onChange(n)
    setActual(j)
  }

  const input = (
    <input
      ref={inputRef}
      type="file"
      accept="image/*,.heic,.heif"
      multiple
      hidden
      onChange={(e) => {
        const fs = [...(e.target.files ?? [])]
        e.target.value = ''
        void agregar(fs)
      }}
    />
  )

  if (value.length === 0) {
    return (
      <div
        className="relative flex aspect-square w-full flex-col items-center justify-center gap-3 overflow-hidden rounded-lg bg-surface-container-high p-4 text-center"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault()
          void agregar([...e.dataTransfer.files])
        }}
      >
        <Icon name="add_photo_alternate" size={48} className="text-on-surface-variant" />
        <p className="type-title-m">Elegí una o varias fotos</p>
        <p className="type-body-s text-on-surface-variant">También podés pegarlas o arrastrarlas acá</p>
        {input}
        <Button icon="upload" disabled={subiendo > 0} onClick={() => inputRef.current?.click()}>
          {subiendo > 0 ? 'Subiendo…' : 'Desde tu dispositivo'}
        </Button>
        {env.useMock && (
          <Button variant="tonal" disabled={subiendo > 0} onClick={() => onChange([urlAleatoria(1080, 1080)])}>
            Usar una de muestra
          </Button>
        )}
      </div>
    )
  }

  const sel = Math.min(actual, value.length - 1)
  return (
    <div className="flex flex-col gap-2">
      <div className="relative aspect-square w-full overflow-hidden rounded-lg bg-surface-container-high">
        <img src={value[sel]} alt={`Foto ${sel + 1} de ${value.length}`} className="size-full bg-black object-contain" />
        <span className="type-label-s absolute top-2 left-2 rounded-full bg-black/60 px-2 py-0.5 text-white">
          {sel + 1}/{value.length}
        </span>
        <IconButton icon="close" label="Quitar esta foto" variant="filled" size={20} className="absolute top-2 right-2" onClick={() => quitar(sel)} />
        <div className="absolute bottom-2 left-2 flex gap-1">
          {(
            [
              ['1:1', 1],
              ['4:5', 4 / 5],
              ['16:9', 16 / 9],
            ] as const
          ).map(([label, aspecto]) => (
            <button
              key={label}
              type="button"
              disabled={subiendo > 0}
              onClick={() => setEncuadre({ i: sel, aspecto })}
              className="type-label-m flex h-8 items-center gap-1 rounded-full bg-black/60 px-3 text-white disabled:opacity-50"
              aria-label={`Encuadrar en ${label}`}
            >
              {label === '1:1' && <Icon name="crop" size={16} />}
              {label}
            </button>
          ))}
        </div>
      </div>
      <Encuadre
        src={encuadre ? (value[encuadre.i] ?? null) : null}
        aspecto={encuadre?.aspecto ?? 1}
        titulo="Encuadrar foto"
        onCancelar={() => setEncuadre(null)}
        onListo={(b) => {
          const i = encuadre?.i ?? sel
          setEncuadre(null)
          void recortar(i, b)
        }}
      />
      <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
        {value.map((url, i) => (
          <div key={`${i}-${url}`} className="relative shrink-0">
            <button
              type="button"
              onClick={() => setActual(i)}
              aria-label={`Ver foto ${i + 1}`}
              className={`block size-16 overflow-hidden rounded-sm ${i === sel ? 'ring-2 ring-primary' : 'opacity-80'}`}
            >
              <img src={url} alt="" className="size-full object-cover" />
            </button>
            {i === sel && value.length > 1 && (
              <span className="absolute inset-x-0 -bottom-0.5 flex justify-between">
                <button type="button" aria-label="Mover a la izquierda" disabled={i === 0} onClick={() => mover(i, -1)} className="rounded-full bg-black/60 text-white disabled:opacity-0">
                  <Icon name="chevron_left" size={16} />
                </button>
                <button type="button" aria-label="Mover a la derecha" disabled={i === value.length - 1} onClick={() => mover(i, 1)} className="rounded-full bg-black/60 text-white disabled:opacity-0">
                  <Icon name="chevron_right" size={16} />
                </button>
              </span>
            )}
          </div>
        ))}
        {value.length < MAX_FOTOS && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={subiendo > 0}
            aria-label="Agregar más fotos"
            className="state flex size-16 shrink-0 items-center justify-center rounded-sm border border-dashed border-outline text-on-surface-variant"
          >
            <Icon name={subiendo > 0 ? 'hourglass_top' : 'add'} />
          </button>
        )}
        {input}
      </div>
    </div>
  )
}
