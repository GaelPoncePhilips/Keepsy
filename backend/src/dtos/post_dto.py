from datetime import datetime

from pydantic import BaseModel

from src.dtos.usuario_dto import UsuarioResumenDTO


class CreatePostDTO(BaseModel):
    usuario_id: int
    tipo: str = "foto"
    url_imagen: str
    url_video: str | None = None
    duracion_seg: int | None = None
    descripcion: str | None = None
    imagenes_extra: list[str] = []


class PostResponseDTO(BaseModel):
    id: int
    usuario_id: int
    tipo: str
    url_imagen: str
    url_video: str | None
    duracion_seg: int | None
    descripcion: str | None
    fecha_publicacion: datetime

    model_config = {"from_attributes": True}


class PostDetalleDTO(BaseModel):
    """Post con autor y contadores (HU6). `motivo` solo en recomendaciones."""
    id: int
    usuario_id: int
    autor_username: str
    autor_nombre: str
    tipo: str
    url_imagen: str
    url_video: str | None
    duracion_seg: int | None
    descripcion: str | None
    fecha_publicacion: datetime
    cantidad_likes: int
    cantidad_comentarios: int
    me_gusta: bool
    fecha_edicion: datetime | None = None
    imagenes_extra: list[str] = []
    motivo: str | None = None
    cantidad_reposts: int = 0
    me_republique: bool = False
    # Solo en listas de republicaciones: quién lo republicó y cuándo.
    repostado_por: UsuarioResumenDTO | None = None
    fecha_repost: datetime | None = None


class ComentarioDTO(BaseModel):
    id: int
    post_id: int
    usuario_id: int
    autor_username: str
    texto: str
    fecha: datetime
    fecha_edicion: datetime | None = None
