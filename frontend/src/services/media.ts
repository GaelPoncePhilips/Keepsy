/** Subida de imágenes y videos (POST /media). */
import { env } from '../config/env'
import { request } from './client'

export interface MediaSubida {
  url: string
  tipo: 'imagen' | 'video'
  tamano_bytes: number
}

/**
 * POST /media — multipart, campo `archivo` → {url, tipo, tamano_bytes}. 400 si el formato no es
 * JPG/PNG/WEBP/GIF/MP4/MOV/WEBM o supera 10 MB (imagen) / 100 MB (video).
 * Con el mock no hay servidor de archivos: se usa una URL de objeto (vive mientras la pestaña esté abierta).
 */
export async function subirArchivo(archivo: Blob, nombre = 'archivo'): Promise<string> {
  if (env.useMock) return URL.createObjectURL(archivo)
  const form = new FormData()
  form.append('archivo', archivo, archivo instanceof File ? archivo.name : nombre)
  const r = await request<MediaSubida>('POST', '/media', { body: form })
  return r.url
}

/** Convierte un data: URL (p. ej. la portada capturada de un video) en Blob para subirlo. */
export async function dataUrlABlob(dataUrl: string): Promise<Blob> {
  return (await fetch(dataUrl)).blob()
}
