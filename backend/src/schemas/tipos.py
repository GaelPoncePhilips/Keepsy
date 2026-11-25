"""Tipos de entrada compartidos por los schemas."""
from typing import Annotated
from urllib.parse import urlsplit

from pydantic import AfterValidator, Field


def _validar_url(url: str) -> str:
    """Solo http(s) o rutas sin esquema (p. ej. /media/...): evita javascript:, data:, etc. (XSS)."""
    url = url.strip()
    esquema = urlsplit(url).scheme.lower()
    if esquema not in ("", "http", "https") or any(ord(c) < 32 for c in url):
        raise ValueError("La URL tiene que ser http(s) o una ruta del servidor")
    return url


UrlMedia = Annotated[str, Field(min_length=1, max_length=2048), AfterValidator(_validar_url)]
