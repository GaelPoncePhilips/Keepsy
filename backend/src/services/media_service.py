"""EXTRA: subida de imágenes y videos a disco local.

Se valida el tipo por los primeros bytes del archivo (no por la extensión ni el Content-Type,
que los manda el cliente) y el tamaño. Para pasar a S3/Cloudinary alcanza con reemplazar `guardar`.
"""
import uuid
from pathlib import Path

from fastapi import UploadFile

from src.config.env import settings
from src.utils.errors import BadRequestError

MB = 1024 * 1024
MARCAS_HEIF = {b"heic", b"heix", b"hevc", b"hevx", b"heim", b"heis", b"mif1", b"msf1", b"avif"}


def heic_a_jpeg(origen: Path) -> Path:
    """Convierte HEIC/HEIF/AVIF a JPEG (los navegadores, salvo Safari, no muestran HEIC). Respeta la orientación EXIF."""
    try:
        from PIL import Image, ImageOps
        from pillow_heif import register_heif_opener
    except ImportError as e:  # dependencia opcional en desarrollo
        origen.unlink(missing_ok=True)
        raise BadRequestError("Este servidor todavía no puede convertir fotos HEIC") from e
    register_heif_opener()
    destino = origen.with_suffix(".jpg")
    try:
        with Image.open(origen) as img:
            ImageOps.exif_transpose(img).convert("RGB").save(destino, "JPEG", quality=88, optimize=True)
    except Exception as e:
        destino.unlink(missing_ok=True)
        raise BadRequestError("No se pudo leer la foto HEIC") from e
    finally:
        origen.unlink(missing_ok=True)
    return destino
LIMITES = {"imagen": 10 * MB, "video": 100 * MB}


def detectar_tipo(cabecera: bytes) -> tuple[str, str] | None:
    """(categoría, extensión) según la firma del archivo."""
    if cabecera.startswith(b"\xff\xd8\xff"):
        return "imagen", "jpg"
    if cabecera.startswith(b"\x89PNG\r\n\x1a\n"):
        return "imagen", "png"
    if cabecera[:4] == b"RIFF" and cabecera[8:12] == b"WEBP":
        return "imagen", "webp"
    if cabecera[:6] in (b"GIF87a", b"GIF89a"):
        return "imagen", "gif"
    if cabecera[4:8] == b"ftyp":
        # HEIC/HEIF (fotos de iPhone) comparten el contenedor ISO-BMFF con MP4: se distinguen por la marca.
        if cabecera[8:12] in MARCAS_HEIF:
            return "imagen", "heic"
        return "video", "mov" if cabecera[8:10] == b"qt" else "mp4"
    if cabecera.startswith(b"\x1a\x45\xdf\xa3"):
        return "video", "webm"
    return None


class MediaService:
    def __init__(self, carpeta: str | None = None):
        self.carpeta = Path(carpeta or settings.MEDIA_DIR)

    async def guardar(self, archivo: UploadFile, usuario_id: int) -> dict:
        cabecera = await archivo.read(16)
        tipo = detectar_tipo(cabecera)
        if tipo is None:
            raise BadRequestError("Formato no soportado: imágenes JPG/PNG/WEBP/GIF/HEIC o videos MP4/MOV/WEBM")
        categoria, ext = tipo
        nombre = f"{usuario_id}/{uuid.uuid4().hex}.{ext}"
        destino = self.carpeta / nombre
        destino.parent.mkdir(parents=True, exist_ok=True)
        tamano = len(cabecera)
        try:
            with destino.open("wb") as f:
                f.write(cabecera)
                while bloque := await archivo.read(MB):
                    tamano += len(bloque)
                    if tamano > LIMITES[categoria]:
                        raise BadRequestError(f"El archivo supera el máximo de {LIMITES[categoria] // MB} MB")
                    f.write(bloque)
        except BadRequestError:
            destino.unlink(missing_ok=True)
            raise
        if ext == "heic":
            destino = heic_a_jpeg(destino)
            nombre = nombre.rsplit(".", 1)[0] + ".jpg"
            tamano = destino.stat().st_size
        return {"url": f"{settings.MEDIA_URL.rstrip('/')}/{nombre}", "tipo": categoria, "tamano_bytes": tamano}
